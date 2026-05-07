import { PgFeedStore, type PgClient } from '../src/pgStore';

function memClient(): { client: PgClient; calls: { sql: string; params: unknown[] }[] } {
  const calls: { sql: string; params: unknown[] }[] = [];
  // tiny in-memory DB just for verifying SQL shape + INSERT/DELETE accounting
  const rows: any[] = [];
  const client: PgClient = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      const norm = sql.trim().toLowerCase();
      if (norm.startsWith('insert')) {
        // Each row has 6 placeholders
        const inserted: any[] = [];
        for (let i = 0; i < params.length; i += 6) {
          inserted.push({
            viewer_id: params[i],
            post_id: params[i + 1],
            author_id: params[i + 2],
            reason: params[i + 3],
            score: params[i + 4],
            created_at: params[i + 5]
          });
        }
        for (const r of inserted) {
          if (!rows.find((e) => e.viewer_id === r.viewer_id && e.post_id === r.post_id)) {
            rows.push(r);
          }
        }
        return { rows: [], rowCount: inserted.length };
      }
      if (norm.startsWith('select')) {
        const viewerId = params[0];
        const limit = params[1] as number;
        let out = rows.filter((r) => r.viewer_id === viewerId);
        if (norm.includes("reason = 'following'")) out = out.filter((r) => r.reason === 'following');
        if (norm.includes('order by score desc'))
          out.sort((a, b) => (b.score - a.score) || (a.created_at < b.created_at ? 1 : -1));
        else
          out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        return { rows: out.slice(0, limit) };
      }
      if (norm.startsWith('delete')) {
        const viewerId = params[0];
        const keep = params[1] as number;
        const mine = rows
          .filter((r) => r.viewer_id === viewerId)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        const keepers = new Set(mine.slice(0, keep).map((r) => r.post_id));
        let removed = 0;
        for (let i = rows.length - 1; i >= 0; i--) {
          if (rows[i].viewer_id === viewerId && !keepers.has(rows[i].post_id)) {
            rows.splice(i, 1);
            removed++;
          }
        }
        return { rows: [], rowCount: removed };
      }
      return { rows: [], rowCount: 0 };
    }
  };
  return { client, calls };
}

describe('PgFeedStore', () => {
  it('inserts in batches and dedupes via ON CONFLICT', async () => {
    const { client } = memClient();
    const s = new PgFeedStore(client);
    const entries = Array.from({ length: 10 }, (_, i) => ({
      viewerId: 'v',
      postId: `p${i}`,
      authorId: 'a',
      reason: 'following' as const,
      score: i / 10,
      createdAt: new Date(Date.now() + i).toISOString()
    }));
    const n = await s.pushBatch(entries);
    expect(n).toBe(10);
    // Re-insert: ON CONFLICT means no duplicates land
    await s.pushBatch(entries);
    const rows = await s.forUser('v', 'chronological', 100);
    expect(rows).toHaveLength(10);
  });

  it('forUser respects mode ordering', async () => {
    const { client } = memClient();
    const s = new PgFeedStore(client);
    await s.pushBatch([
      { viewerId: 'v', postId: 'p1', authorId: 'a', reason: 'following', score: 0.1, createdAt: '2026-01-01T00:00:00Z' },
      { viewerId: 'v', postId: 'p2', authorId: 'a', reason: 'recommended', score: 0.9, createdAt: '2026-01-02T00:00:00Z' }
    ]);
    const fy = await s.forUser('v', 'for_you', 10);
    expect(fy[0].postId).toBe('p2');
    const foll = await s.forUser('v', 'following', 10);
    expect(foll.map((r) => r.postId)).toEqual(['p1']);
  });

  it('prune keeps newest', async () => {
    const { client } = memClient();
    const s = new PgFeedStore(client);
    const entries = Array.from({ length: 5 }, (_, i) => ({
      viewerId: 'v',
      postId: `p${i}`,
      authorId: 'a',
      reason: 'following' as const,
      score: 0,
      createdAt: new Date(2026, 0, 1 + i).toISOString()
    }));
    await s.pushBatch(entries);
    const removed = await s.prune('v', 2);
    expect(removed).toBe(3);
    const rows = await s.forUser('v', 'chronological', 10);
    expect(rows.map((r) => r.postId)).toEqual(['p4', 'p3']);
  });
});
