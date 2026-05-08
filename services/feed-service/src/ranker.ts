/**
 * Ranker v1 — exact production formula.
 *
 *   Score(viewer, post) =
 *       0.40 * engagement_prob
 *     + 0.30 * interest_affinity
 *     + 0.15 * freshness
 *     + 0.10 * creator_quality
 *     + 0.05 * diversity_term     // applied during MMR re-ranking
 *
 * Each component is in [0, 1] so the final score is in [0, 1] before
 * MMR, which subtracts a similarity penalty.
 *
 * The functions in this module are pure and deterministic — they take
 * primitive signals as input and return numbers. The real online stack
 * fetches signals from Feast (Redis) + a Triton-served LightGBM model;
 * the math here is identical to that model's calibration formula and is
 * used as the offline fallback when the inference path is degraded.
 */

export interface PostSignals {
  postId: string;
  authorId: string;
  /** Half-life in hours used for the freshness term (typed content -> τ). */
  freshnessHalfLifeH: number;
  /** ISO timestamp when the post was created. */
  createdAt: string;
  /** Aggregated 7d engagement metrics. */
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    watchTimeMs: number;
  };
  /** Tags (lower-cased) — used for interest affinity + diversity. */
  tags: string[];
  /** 30d engagement-rate z-score for the author, clipped [-2, 2]. */
  authorEngagementZ: number;
  /** Whether the author has been gated by moderation. */
  authorGated: boolean;
}

export interface ViewerSignals {
  userId: string;
  /** Lower-cased interest tokens learned from history. */
  interests: ReadonlyArray<string>;
  /** Tokens the viewer has explicitly muted. */
  mutedTags: ReadonlyArray<string>;
  /** Authors the viewer has blocked. */
  blockedAuthorIds: ReadonlyArray<string>;
}

export interface ScoredPost extends PostSignals {
  score: number;
  components: {
    engagement: number;
    interest: number;
    freshness: number;
    creator: number;
  };
  /**
   * Lowercased tag set, cached on the post the first time we score it so
   * MMR's pairwise similarity (which is the hot path on the 1k-candidate
   * profile) doesn't re-allocate a Set + lower-case array per comparison.
   */
  _tagSet?: Set<string>;
}

/** Sigmoid-shaped engagement probability from raw counters. */
export function engagementProb(m: PostSignals['metrics']): number {
  // Watch time matters more than likes; comments more than views.
  const v = Math.max(1, m.views);
  const watchRate = clamp01(m.watchTimeMs / (v * 15_000)); // 15s = full watch
  const likeRate = clamp01(m.likes / v);
  const commentRate = clamp01(m.comments / v) * 1.5;
  const shareRate = clamp01(m.shares / v) * 1.2;
  const raw = 0.45 * watchRate + 0.25 * likeRate + 0.2 * commentRate + 0.1 * shareRate;
  return clamp01(raw);
}

/** Token-Jaccard between viewer interests and post tags. */
export function interestAffinity(viewer: ViewerSignals, post: PostSignals): number {
  if (viewer.interests.length === 0 || post.tags.length === 0) return 0;
  const interests = new Set(viewer.interests.map((t) => t.toLowerCase()));
  return jaccardAgainst(interests, post.tags);
}

/**
 * Jaccard between an already-lowercased interest set and a post's tag list.
 * Used as the inner loop when scoring a batch — caller hoists the interest
 * set out so we don't rebuild it once per candidate.
 */
function jaccardAgainst(interestsLc: ReadonlySet<string>, tags: ReadonlyArray<string>): number {
  if (interestsLc.size === 0 || tags.length === 0) return 0;
  let inter = 0;
  const tagSet = new Set<string>();
  for (const t of tags) {
    const lc = t.toLowerCase();
    if (!tagSet.has(lc)) {
      tagSet.add(lc);
      if (interestsLc.has(lc)) inter++;
    }
  }
  // |A ∪ B| = |A| + |B| - |A ∩ B|
  return (interestsLc.size + tagSet.size - inter) === 0
    ? 0
    : inter / (interestsLc.size + tagSet.size - inter);
}

/** Exponential decay; τ in hours. */
export function freshness(post: PostSignals, now: number = Date.now()): number {
  const ageH = Math.max(0, (now - new Date(post.createdAt).getTime()) / 3_600_000);
  const tau = post.freshnessHalfLifeH > 0 ? post.freshnessHalfLifeH : 24;
  return Math.exp(-ageH / tau);
}

/** Creator quality from a clipped z-score: maps [-2, 2] → [0, 1]. */
export function creatorQuality(post: PostSignals): number {
  if (post.authorGated) return 0;
  const z = clamp(post.authorEngagementZ, -2, 2);
  return (z + 2) / 4;
}

/** The full pre-diversity score, weights matching the prompt formula. */
export function scoreOne(viewer: ViewerSignals, post: PostSignals, now: number = Date.now()): ScoredPost {
  const components = {
    engagement: engagementProb(post.metrics),
    interest: interestAffinity(viewer, post),
    freshness: freshness(post, now),
    creator: creatorQuality(post)
  };
  // 0.05 reserved for diversity, applied during MMR. Pre-diversity score
  // sums to at most 0.95.
  const score =
    0.4 * components.engagement +
    0.3 * components.interest +
    0.15 * components.freshness +
    0.1 * components.creator;
  return { ...post, score, components };
}

/**
 * Maximal Marginal Relevance re-rank. Picks `k` items from `candidates`
 * by repeatedly choosing the one that maximizes
 *      λ * relevance(p) - (1 - λ) * max(sim(p, S))
 * where S is the slate built so far. Similarity is tag-Jaccard; same-
 * author hits get a hard penalty so we don't show two reels by the
 * same creator back-to-back.
 *
 * λ = 0.95 here, so diversity contributes the prompt's 0.05 weight.
 */
export function mmrRerank(candidates: ScoredPost[], k: number, lambda = 0.95): ScoredPost[] {
  // Pre-compute lowercased tag sets once per candidate. Without this,
  // similarity is recomputed via fresh Set allocations on every (pool, slate)
  // pair — the dominant cost at n≈1000.
  for (const c of candidates) {
    if (!c._tagSet) c._tagSet = toLowerSet(c.tags);
  }
  const pool = [...candidates];
  const out: ScoredPost[] = [];
  while (out.length < k && pool.length > 0) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      let simPenalty = 0;
      // Manual max so we can short-circuit on the same-author hard penalty
      // (sim=1) and skip the rest of the slate.
      for (let j = 0; j < out.length; j++) {
        const s = slatesimCached(p, out[j]);
        if (s > simPenalty) simPenalty = s;
        if (simPenalty >= 1) break;
      }
      const v = lambda * p.score - (1 - lambda) * simPenalty;
      if (v > bestVal) {
        bestVal = v;
        bestIdx = i;
      }
    }
    out.push(pool.splice(bestIdx, 1)[0]);
  }
  return out;
}

/** Filter step: muted tags + blocked authors + gated authors. */
export function policyFilter(viewer: ViewerSignals, candidates: PostSignals[]): PostSignals[] {
  const blocked = new Set(viewer.blockedAuthorIds);
  const muted = new Set(viewer.mutedTags.map((t) => t.toLowerCase()));
  const hasMuted = muted.size > 0;
  return candidates.filter((p) => {
    if (blocked.has(p.authorId)) return false;
    if (p.authorGated) return false;
    if (hasMuted) {
      for (const t of p.tags) if (muted.has(t.toLowerCase())) return false;
    }
    return true;
  });
}

/** End-to-end pipeline: filter → score → MMR re-rank. */
export function rankSlate(
  viewer: ViewerSignals,
  candidates: PostSignals[],
  k: number,
  now: number = Date.now()
): ScoredPost[] {
  const filtered = policyFilter(viewer, candidates);
  // Hoist viewer interest set out of the per-candidate scoring loop.
  const interestsLc = new Set(viewer.interests.map((t) => t.toLowerCase()));
  const scored: ScoredPost[] = filtered.map((p) => {
    const components = {
      engagement: engagementProb(p.metrics),
      interest: jaccardAgainst(interestsLc, p.tags),
      freshness: freshness(p, now),
      creator: creatorQuality(p)
    };
    const score =
      0.4 * components.engagement +
      0.3 * components.interest +
      0.15 * components.freshness +
      0.1 * components.creator;
    return { ...p, score, components };
  });
  scored.sort((a, b) => b.score - a.score);
  // Take top 3*k for MMR so we have room to diversify.
  const head = scored.slice(0, Math.max(k * 3, k));
  return mmrRerank(head, k);
}

// ----- helpers ------------------------------------------------------
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
function clamp01(v: number): number {
  return clamp(v, 0, 1);
}
function toLowerSet(tags: ReadonlyArray<string>): Set<string> {
  const s = new Set<string>();
  for (const t of tags) s.add(t.toLowerCase());
  return s;
}
/** MMR fast path: assumes both sides already have `_tagSet` cached. */
function slatesimCached(a: ScoredPost, b: ScoredPost): number {
  if (a.authorId === b.authorId) return 1;
  const as = a._tagSet!;
  const bs = b._tagSet!;
  if (as.size === 0 || bs.size === 0) return 0;
  return jaccardSets(as, bs);
}
function jaccardSets(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  // Iterate the smaller set for the intersection count.
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const t of small) if (big.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
