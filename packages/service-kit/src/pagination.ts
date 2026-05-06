/**
 * Opaque cursor pagination helpers. Cursors are base64url-encoded JSON of an
 * arbitrary marker (usually `{ ts, id }`). Clients treat them as opaque.
 */

export interface CursorPage<T, M = unknown> {
  items: T[];
  nextCursor?: string;
  marker?: M;
}

export function encodeCursor(marker: unknown): string {
  const json = JSON.stringify(marker);
  return Buffer.from(json, 'utf8').toString('base64url');
}

export function decodeCursor<M = unknown>(cursor: string | undefined): M | null {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    return JSON.parse(json) as M;
  } catch {
    return null;
  }
}

/**
 * Apply opaque-cursor pagination to a sorted array (newest-first).
 * Suitable for in-memory stores; production code should push pagination into
 * the persistence layer.
 */
export function paginateNewestFirst<T extends { id: string; createdAt: string }>(
  items: T[],
  cursor: string | undefined,
  limit: number
): CursorPage<T> {
  const sorted = [...items].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  );
  const decoded = decodeCursor<{ ts: string; id: string }>(cursor);
  const startIdx = decoded
    ? sorted.findIndex((x) => x.createdAt === decoded.ts && x.id === decoded.id) + 1
    : 0;
  const slice = sorted.slice(startIdx, startIdx + limit);
  const last = slice[slice.length - 1];
  return {
    items: slice,
    nextCursor:
      last && startIdx + limit < sorted.length
        ? encodeCursor({ ts: last.createdAt, id: last.id })
        : undefined
  };
}
