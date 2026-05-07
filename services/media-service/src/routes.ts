import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  defaultLimiters,
  paginateNewestFirst,
  requireBearerAuth,
  requireJwtSecret,
  type AuthedRequest,
  ForbiddenError,
  NotFoundError
} from '@ather/service-kit';

export type MediaKind = 'image' | 'video' | 'audio';
export type MediaStatus = 'pending' | 'ready' | 'failed';

export interface MediaRecord {
  id: string;
  ownerId: string;
  kind: MediaKind;
  status: MediaStatus;
  originalUrl: string;
  variants: { label: string; url: string; mime: string }[];
  durationMs?: number;
  dims?: { w: number; h: number };
  createdAt: string;
}

export class MediaStore {
  private items: MediaRecord[] = [];

  create(input: { ownerId: string; kind: MediaKind; originalUrl: string }): MediaRecord {
    const rec: MediaRecord = {
      id: uuidv4(),
      ownerId: input.ownerId,
      kind: input.kind,
      status: 'pending',
      originalUrl: input.originalUrl,
      variants: [],
      createdAt: new Date().toISOString()
    };
    this.items.push(rec);
    return rec;
  }

  finalize(
    id: string,
    by: string,
    patch: Partial<Pick<MediaRecord, 'durationMs' | 'dims' | 'variants'>>
  ): MediaRecord {
    const m = this.items.find((x) => x.id === id);
    if (!m) throw new NotFoundError('media not found');
    if (m.ownerId !== by) throw new ForbiddenError('not owner');
    m.status = 'ready';
    if (patch.durationMs !== undefined) m.durationMs = patch.durationMs;
    if (patch.dims !== undefined) m.dims = patch.dims;
    if (patch.variants !== undefined) m.variants = patch.variants;
    return m;
  }

  get(id: string): MediaRecord {
    const m = this.items.find((x) => x.id === id);
    if (!m) throw new NotFoundError('media not found');
    return m;
  }

  byOwner(ownerId: string): MediaRecord[] {
    return this.items.filter((m) => m.ownerId === ownerId);
  }
}

const UploadUrlSchema = z.object({
  kind: z.enum(['image', 'video', 'audio']),
  contentType: z.string().min(1).max(120)
});

const FinalizeSchema = z.object({
  durationMs: z.number().int().min(0).optional(),
  dims: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }).optional(),
  variants: z
    .array(
      z.object({ label: z.string(), url: z.string().url(), mime: z.string() })
    )
    .max(20)
    .optional()
});

/**
 * Phase 1 placeholder: returns a fake "signed URL" so clients can be wired.
 * Production wires this to S3 GetSignedUrl / GCS V4 signed URL.
 */
export function fakeSignedPutUrl(mediaId: string): string {
  return `https://uploads.local.test/media/${mediaId}?sig=fake`;
}

export function buildMediaRouter(store: MediaStore, jwtSecret: string, isTest: boolean) {
  const limiters = defaultLimiters(isTest);
  const router = Router();
  const auth = requireBearerAuth(jwtSecret);

  router.post('/upload-url', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const { kind } = UploadUrlSchema.parse(req.body);
      const rec = store.create({
        ownerId: req.claims!.sub,
        kind,
        originalUrl: '' // filled in on finalize
      });
      const uploadUrl = fakeSignedPutUrl(rec.id);
      // Phase 0 trick: also note the original URL where the client will land it.
      rec.originalUrl = uploadUrl;
      res.status(201).json({ id: rec.id, uploadUrl, expiresIn: 600 });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/finalize', limiters.write, auth, (req: AuthedRequest, res, next) => {
    try {
      const patch = FinalizeSchema.parse(req.body);
      const rec = store.finalize(String(req.params.id), req.claims!.sub, patch);
      res.json({ media: rec });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', limiters.read, (req, res, next) => {
    try {
      const m = store.get(String(req.params.id));
      res.json({ media: m });
    } catch (err) {
      next(err);
    }
  });

  router.get('/by-owner/:ownerId', limiters.read, (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const all = store.byOwner(String(req.params.ownerId));
    res.json(paginateNewestFirst(all, cursor, limit));
  });

  return router;
}

export function getJwtSecret(env = process.env): string {
  return requireJwtSecret(env);
}
