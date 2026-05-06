/**
 * Postgres-backed feed store — adapter against a minimal `Pool`-shaped
 * interface so we can unit-test it without a live database. In
 * production we wire it to `pg.Pool` from the `pg` package.
 *
 * This implements the reader side of `feed.entries`:
 *   * `forUser(viewerId, mode, limit)` — returns up to `limit` rows.
 *   * `pushBatch(entries)` — bulk insert produced by the fanout engine
 *     OR by other writers (e.g. recommendations, sponsored placements).
 *   * `prune(viewerId, keep)` — keep only the newest `keep` entries.
 *
 * The schema is defined in `infra/postgres/migrations/0001_feed_pillar.sql`.
 */

export type FeedEntryReason = 'following' | 'recommended' | 'community' | 'sponsored';

export interface FeedEntryInput {
  viewerId: string;
  postId: string;
  authorId: string;
  reason: FeedEntryReason;
  score: number;
  createdAt: string;
}

export interface QueryFn {
  (text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount?: number }>;
}
export interface PgClient {
  query: QueryFn;
}

export type PgFeedMode = 'for_you' | 'following' | 'chronological';

export interface PgFeedRow {
  postId: string;
  authorId: string;
  reason: string;
  score: number;
  createdAt: string;
}

export class PgFeedStore {
  constructor(private readonly client: PgClient) {}

  async forUser(viewerId: string, mode: PgFeedMode, limit: number): Promise<PgFeedRow[]> {
    const lim = Math.min(Math.max(limit, 1), 200);
    let sql: string;
    const params: unknown[] = [viewerId, lim];
    if (mode === 'chronological') {
      sql = `
        SELECT post_id, author_id, reason, score, created_at
          FROM feed.entries
         WHERE viewer_id = $1
         ORDER BY created_at DESC
         LIMIT $2`;
    } else if (mode === 'following') {
      sql = `
        SELECT post_id, author_id, reason, score, created_at
          FROM feed.entries
         WHERE viewer_id = $1 AND reason = 'following'
         ORDER BY created_at DESC
         LIMIT $2`;
    } else {
      sql = `
        SELECT post_id, author_id, reason, score, created_at
          FROM feed.entries
         WHERE viewer_id = $1
         ORDER BY score DESC, created_at DESC
         LIMIT $2`;
    }
    const r = await this.client.query(sql, params);
    return r.rows.map(rowToFeed);
  }

  async pushBatch(entries: FeedEntryInput[]): Promise<number> {
    if (entries.length === 0) return 0;
    // Build a multi-row INSERT with parameter placeholders. Caps batch
    // size at 1000 to avoid pg parameter limit (max 65535 / 6 cols).
    const chunkSize = 1000;
    let inserted = 0;
    for (let off = 0; off < entries.length; off += chunkSize) {
      const chunk = entries.slice(off, off + chunkSize);
      const values: string[] = [];
      const params: unknown[] = [];
      chunk.forEach((e, i) => {
        const b = i * 6;
        values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`);
        params.push(e.viewerId, e.postId, e.authorId, e.reason, e.score, e.createdAt);
      });
      const sql = `
        INSERT INTO feed.entries
            (viewer_id, post_id, author_id, reason, score, created_at)
        VALUES ${values.join(',')}
        ON CONFLICT (viewer_id, post_id) DO NOTHING`;
      const r = await this.client.query(sql, params);
      inserted += r.rowCount ?? chunk.length;
    }
    return inserted;
  }

  /**
   * Keep at most `keep` newest entries for a viewer, delete the rest.
   * Run periodically by a maintenance worker — not on the hot path.
   */
  async prune(viewerId: string, keep: number): Promise<number> {
    const sql = `
      DELETE FROM feed.entries
       WHERE viewer_id = $1
         AND post_id NOT IN (
            SELECT post_id FROM feed.entries
             WHERE viewer_id = $1
             ORDER BY created_at DESC
             LIMIT $2
         )`;
    const r = await this.client.query(sql, [viewerId, keep]);
    return r.rowCount ?? 0;
  }
}

function rowToFeed(r: any): PgFeedRow {
  return {
    postId: r.post_id,
    authorId: r.author_id,
    reason: r.reason,
    score: typeof r.score === 'number' ? r.score : Number(r.score),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)
  };
}
