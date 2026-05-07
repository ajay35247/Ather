import {
  rankSlate,
  scoreOne,
  freshness,
  engagementProb,
  interestAffinity,
  creatorQuality,
  policyFilter,
  mmrRerank,
  type PostSignals,
  type ViewerSignals,
  type ScoredPost
} from '../src/ranker';

const NOW = Date.parse('2026-01-01T00:00:00Z');

function post(over: Partial<PostSignals> = {}): PostSignals {
  return {
    postId: over.postId ?? 'p',
    authorId: over.authorId ?? 'a',
    freshnessHalfLifeH: over.freshnessHalfLifeH ?? 24,
    createdAt: over.createdAt ?? new Date(NOW).toISOString(),
    metrics: over.metrics ?? { views: 0, likes: 0, comments: 0, shares: 0, watchTimeMs: 0 },
    tags: over.tags ?? [],
    authorEngagementZ: over.authorEngagementZ ?? 0,
    authorGated: over.authorGated ?? false
  };
}

const viewer: ViewerSignals = {
  userId: 'u1',
  interests: ['ai', 'design'],
  mutedTags: ['politics'],
  blockedAuthorIds: ['blocked']
};

describe('ranker.engagementProb', () => {
  it('is 0 when nothing happened', () => {
    expect(engagementProb({ views: 100, likes: 0, comments: 0, shares: 0, watchTimeMs: 0 })).toBe(0);
  });

  it('rewards watch time', () => {
    const low = engagementProb({ views: 100, likes: 0, comments: 0, shares: 0, watchTimeMs: 100 * 5_000 });
    const hi = engagementProb({ views: 100, likes: 0, comments: 0, shares: 0, watchTimeMs: 100 * 15_000 });
    expect(hi).toBeGreaterThan(low);
    expect(hi).toBeLessThanOrEqual(1);
  });
});

describe('ranker.interestAffinity', () => {
  it('returns 0 for empty intersection', () => {
    expect(interestAffinity(viewer, post({ tags: ['cooking'] }))).toBe(0);
  });
  it('rises with overlapping tags', () => {
    expect(interestAffinity(viewer, post({ tags: ['ai'] }))).toBeGreaterThan(0);
    expect(
      interestAffinity(viewer, post({ tags: ['ai', 'design'] }))
    ).toBeGreaterThan(interestAffinity(viewer, post({ tags: ['ai'] })));
  });
});

describe('ranker.freshness', () => {
  it('decays with age', () => {
    const fresh = freshness(post({ createdAt: new Date(NOW - 60_000).toISOString() }), NOW);
    const stale = freshness(post({ createdAt: new Date(NOW - 1000 * 3600 * 72).toISOString() }), NOW);
    expect(fresh).toBeGreaterThan(stale);
  });
});

describe('ranker.creatorQuality', () => {
  it('gates banned creators to 0', () => {
    expect(creatorQuality(post({ authorEngagementZ: 2, authorGated: true }))).toBe(0);
  });
  it('clips z to [-2, 2]', () => {
    expect(creatorQuality(post({ authorEngagementZ: 10 }))).toBe(1);
    expect(creatorQuality(post({ authorEngagementZ: -10 }))).toBe(0);
  });
});

describe('ranker.scoreOne weights', () => {
  it('combines components with the prompt weights', () => {
    const p = post({
      tags: ['ai'],
      createdAt: new Date(NOW).toISOString(),
      authorEngagementZ: 2,
      metrics: { views: 100, likes: 100, comments: 100, shares: 100, watchTimeMs: 100 * 15_000 }
    });
    const s = scoreOne(viewer, p, NOW);
    // engagement≈1, interest=1/2 (ai matches; design doesn't), freshness=1, creator=1
    // score = 0.4 + 0.3*0.5 + 0.15 + 0.1 = 0.8
    expect(s.components.engagement).toBeCloseTo(1, 5);
    expect(s.components.interest).toBeCloseTo(0.5, 5);
    expect(s.components.freshness).toBeCloseTo(1, 5);
    expect(s.components.creator).toBeCloseTo(1, 5);
    expect(s.score).toBeCloseTo(0.8, 5);
  });
});

describe('ranker.policyFilter', () => {
  it('removes blocked, gated, muted', () => {
    const cands = [
      post({ postId: '1', authorId: 'blocked' }),
      post({ postId: '2', authorGated: true }),
      post({ postId: '3', tags: ['politics', 'ai'] }),
      post({ postId: '4', tags: ['ai'] })
    ];
    const out = policyFilter(viewer, cands).map((p) => p.postId);
    expect(out).toEqual(['4']);
  });
});

describe('ranker.mmrRerank', () => {
  it('penalizes same-author duplicates', () => {
    const a1: ScoredPost = {
      ...post({ postId: 'a1', authorId: 'A' }),
      score: 0.9,
      components: { engagement: 0, interest: 0, freshness: 0, creator: 0 }
    };
    const a2: ScoredPost = {
      ...post({ postId: 'a2', authorId: 'A' }),
      score: 0.85,
      components: { engagement: 0, interest: 0, freshness: 0, creator: 0 }
    };
    const b1: ScoredPost = {
      ...post({ postId: 'b1', authorId: 'B' }),
      score: 0.7,
      components: { engagement: 0, interest: 0, freshness: 0, creator: 0 }
    };
    const out = mmrRerank([a1, a2, b1], 3, 0.6);
    // a1 (top), then b1 (different author beats a2 even with lower score)
    expect(out[0].postId).toBe('a1');
    expect(out[1].postId).toBe('b1');
    expect(out[2].postId).toBe('a2');
  });
});

describe('ranker.rankSlate end-to-end', () => {
  it('applies filter+score+mmr together and respects k', () => {
    const cands: PostSignals[] = [
      post({ postId: '1', tags: ['ai'], authorId: 'A', createdAt: new Date(NOW).toISOString() }),
      post({ postId: '2', tags: ['ai'], authorId: 'A', createdAt: new Date(NOW - 1000).toISOString() }),
      post({ postId: '3', tags: ['design'], authorId: 'B', createdAt: new Date(NOW).toISOString() }),
      post({ postId: '4', tags: ['politics', 'ai'], authorId: 'C' }), // muted
      post({ postId: '5', authorId: 'blocked' }) // blocked
    ];
    const out = rankSlate(viewer, cands, 3, NOW);
    expect(out).toHaveLength(3);
    expect(out.map((p) => p.postId)).not.toContain('4');
    expect(out.map((p) => p.postId)).not.toContain('5');
    // No two consecutive items from author A
    for (let i = 1; i < out.length; i++) {
      if (out[i].authorId === 'A') expect(out[i - 1].authorId).not.toBe('A');
    }
  });
});
