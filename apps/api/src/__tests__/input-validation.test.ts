/**
 * Input-validation hardening for /api/posts.
 *
 * The 256kb global JSON limit is too coarse to bound individual fields,
 * and an open `visibility`/`type` field lets bad data leak through to the
 * renderer. These tests pin the per-field rules so a future refactor can't
 * silently regress them.
 */
import express from 'express';
import request from 'supertest';
import authRouter from '../routes/auth';
import postsRouter from '../routes/posts';
import { errorHandler } from '../middleware/errorHandler';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/posts', postsRouter);
  app.use(errorHandler);
  return app;
}

describe('Posts input validation', () => {
  const app = makeApp();
  let token: string;

  beforeAll(async () => {
    const r = await request(app).post('/api/auth/register').send({
      username: 'ivuser',
      displayName: 'IV User',
      email: 'iv@example.com',
      password: 'Password123',
    });
    token = r.body.data.accessToken;
  });

  it('rejects unknown post type', async () => {
    const r = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'hi', type: 'malware' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/type/i);
  });

  it('rejects unknown visibility', async () => {
    const r = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'hi', visibility: 'world-readable-leak' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/visibility/i);
  });

  it('rejects content exceeding the length cap', async () => {
    const r = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'x'.repeat(10_001) });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/exceeds/i);
  });

  it('rejects non-string content', async () => {
    const r = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: { evil: true } });
    expect(r.status).toBe(400);
  });

  it('rejects non-array tags', async () => {
    const r = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'hi', tags: 'not-an-array' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/tags/i);
  });

  it('rejects tags array containing non-strings', async () => {
    const r = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'hi', tags: ['ok', 42, { bad: true }] });
    expect(r.status).toBe(400);
  });

  it('rejects too many tags', async () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
    const r = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'hi', tags });
    expect(r.status).toBe(400);
  });

  it('rejects an oversized tag', async () => {
    const r = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'hi', tags: ['a'.repeat(65)] });
    expect(r.status).toBe(400);
  });

  it('accepts valid post and dedupes/trims tags', async () => {
    const r = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'hello',
        type: 'text',
        visibility: 'public',
        tags: ['  a  ', 'b', 'a', '   '],
      });
    expect(r.status).toBe(201);
    expect(r.body.data.tags).toEqual(['a', 'b']);
  });

  it('rejects oversized comment content', async () => {
    const created = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'host post' });
    const postId = created.body.data.id;

    const r = await request(app)
      .post(`/api/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'x'.repeat(4_001) });
    expect(r.status).toBe(400);
  });

  it('rejects non-string comment content', async () => {
    const created = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'host post 2' });
    const postId = created.body.data.id;

    const r = await request(app)
      .post(`/api/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: { html: '<script>' } });
    expect(r.status).toBe(400);
  });
});
