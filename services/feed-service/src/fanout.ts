/**
 * Fanout engine — hybrid push/pull.
 *
 * On `post.created`:
 *   * If the author has ≤ CELEBRITY_THRESHOLD followers, we push a
 *     `feed.entries` row to every follower (fanout-on-write).
 *   * Otherwise we *don't* push; readers of a celebrity follow them via
 *     the pull lane at read time.
 *
 * This keeps both publishing (cheap for normal users) and reading
 * (cheap for users who follow celebrities) bounded.
 *
 * The functions here are pure: they take a graph snapshot + author and
 * return the list of entries to insert. The actual SQL/Redis writes are
 * done by the caller.
 */

export const CELEBRITY_THRESHOLD = 5_000;

export interface NewPostEvent {
  postId: string;
  authorId: string;
  createdAt: string;
  /** Initial recency score; ranker overwrites this on read. */
  seedScore: number;
  /** "following" for normal fanout, "community" if community fanout. */
  reason: 'following' | 'community';
}

export interface FollowerGraph {
  /** Total number of followers for `authorId`. */
  followerCount(authorId: string): number;
  /**
   * Stream the followers of `authorId` in pages of `pageSize`.
   * Implementations should be cursor-based to avoid loading 5M ids in RAM.
   */
  followersOf(authorId: string, pageSize: number): AsyncIterable<string[]>;
}

export interface FanoutEntry {
  viewerId: string;
  postId: string;
  authorId: string;
  reason: NewPostEvent['reason'];
  score: number;
  createdAt: string;
}

export interface FanoutResult {
  /** Entries to insert. Empty when author is a celebrity. */
  entries: FanoutEntry[];
  /** Why we chose this lane — useful for ops dashboards. */
  lane: 'push' | 'pull';
  followerCount: number;
}

/**
 * Decide which lane this post takes and, if push, build the entry list.
 * The caller is responsible for the actual write.
 */
export async function planFanout(
  ev: NewPostEvent,
  graph: FollowerGraph,
  threshold: number = CELEBRITY_THRESHOLD,
  pageSize: number = 1000
): Promise<FanoutResult> {
  const total = graph.followerCount(ev.authorId);
  if (total > threshold) {
    return { entries: [], lane: 'pull', followerCount: total };
  }
  const entries: FanoutEntry[] = [];
  for await (const page of graph.followersOf(ev.authorId, pageSize)) {
    for (const viewerId of page) {
      entries.push({
        viewerId,
        postId: ev.postId,
        authorId: ev.authorId,
        reason: ev.reason,
        score: ev.seedScore,
        createdAt: ev.createdAt
      });
    }
  }
  return { entries, lane: 'push', followerCount: total };
}

/**
 * Read-side merge: combine the materialized push entries (`pushed`)
 * with posts pulled live from celebrity creators (`pulled`), then
 * truncate to `limit`. De-dupes on postId.
 */
export interface Mergeable {
  postId: string;
  createdAt: string;
  score: number;
}
export function mergeLanes<T extends Mergeable>(pushed: T[], pulled: T[], limit: number): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const it of [...pushed, ...pulled]) {
    if (seen.has(it.postId)) continue;
    seen.add(it.postId);
    merged.push(it);
  }
  // Highest score first; ties broken by recency.
  merged.sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.createdAt < b.createdAt ? 1 : -1
  );
  return merged.slice(0, limit);
}
