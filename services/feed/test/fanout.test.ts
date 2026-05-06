import { planFanout, mergeLanes, CELEBRITY_THRESHOLD, type FollowerGraph } from '../src/fanout';

function buildGraph(authorId: string, followerCount: number): FollowerGraph {
  return {
    followerCount: (a) => (a === authorId ? followerCount : 0),
    async *followersOf(a: string, pageSize: number) {
      if (a !== authorId) return;
      let i = 0;
      while (i < followerCount) {
        const page: string[] = [];
        for (let j = 0; j < pageSize && i < followerCount; j++, i++) page.push(`u${i}`);
        yield page;
      }
    }
  };
}

describe('fanout.planFanout', () => {
  it('pushes when follower count <= threshold', async () => {
    const graph = buildGraph('A', 10);
    const r = await planFanout(
      { postId: 'p', authorId: 'A', createdAt: '2026-01-01T00:00:00Z', seedScore: 0.5, reason: 'following' },
      graph
    );
    expect(r.lane).toBe('push');
    expect(r.entries).toHaveLength(10);
    expect(r.entries[0]).toMatchObject({ postId: 'p', authorId: 'A', viewerId: 'u0', reason: 'following' });
  });

  it('pulls (no entries) above threshold', async () => {
    const graph = buildGraph('A', CELEBRITY_THRESHOLD + 1);
    const r = await planFanout(
      { postId: 'p', authorId: 'A', createdAt: '2026-01-01T00:00:00Z', seedScore: 0.5, reason: 'following' },
      graph
    );
    expect(r.lane).toBe('pull');
    expect(r.entries).toHaveLength(0);
    expect(r.followerCount).toBe(CELEBRITY_THRESHOLD + 1);
  });

  it('pages followers to bound memory', async () => {
    const graph = buildGraph('A', 2500);
    const pages: number[] = [];
    const wrapped: FollowerGraph = {
      followerCount: graph.followerCount,
      async *followersOf(a, ps) {
        for await (const page of graph.followersOf(a, ps)) {
          pages.push(page.length);
          yield page;
        }
      }
    };
    const r = await planFanout(
      { postId: 'p', authorId: 'A', createdAt: '2026-01-01T00:00:00Z', seedScore: 0, reason: 'following' },
      wrapped,
      CELEBRITY_THRESHOLD,
      1000
    );
    expect(r.entries).toHaveLength(2500);
    expect(pages).toEqual([1000, 1000, 500]);
  });
});

describe('fanout.mergeLanes', () => {
  it('dedupes and orders by score desc, recency desc', () => {
    const out = mergeLanes(
      [
        { postId: 'a', score: 0.5, createdAt: '2026-01-01T00:00:00Z' },
        { postId: 'b', score: 0.9, createdAt: '2026-01-01T00:00:00Z' }
      ],
      [
        { postId: 'b', score: 0.9, createdAt: '2026-01-01T00:00:00Z' }, // dup
        { postId: 'c', score: 0.5, createdAt: '2026-01-02T00:00:00Z' }  // ties with a but newer
      ],
      10
    );
    expect(out.map((x) => x.postId)).toEqual(['b', 'c', 'a']);
  });

  it('respects limit', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      postId: String(i),
      score: i * 0.1,
      createdAt: '2026-01-01T00:00:00Z'
    }));
    const out = mergeLanes(items, [], 3);
    expect(out).toHaveLength(3);
    expect(out[0].postId).toBe('4');
  });
});
