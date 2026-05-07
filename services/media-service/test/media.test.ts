import jwt from 'jsonwebtoken';
import request from 'supertest';
import { makeApp } from '../src/app';

const SECRET = 'test-access-secret-please-ignore-32';
const tok = (sub: string) =>
  jwt.sign({ sub, handle: sub, type: 'access' }, SECRET, {
    algorithm: 'HS256',
    issuer: 'ather.auth',
    expiresIn: 300
  });

describe('media-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const r = await request(app).get('/health');
    expect(r.body.service).toBe('media');
  });

  it('upload-url + finalize + get', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const t = tok('alice');
    const u = await request(app)
      .post('/media/upload-url')
      .set('authorization', `Bearer ${t}`)
      .send({ kind: 'image', contentType: 'image/png' });
    expect(u.status).toBe(201);
    expect(u.body.uploadUrl).toMatch(/^https:\/\//);
    const id = u.body.id;

    const f = await request(app)
      .post(`/media/${id}/finalize`)
      .set('authorization', `Bearer ${t}`)
      .send({
        dims: { w: 100, h: 200 },
        variants: [{ label: 'original', url: 'https://cdn.test/x.png', mime: 'image/png' }]
      });
    expect(f.status).toBe(200);
    expect(f.body.media.status).toBe('ready');

    const g = await request(app).get(`/media/${id}`);
    expect(g.body.media.dims).toEqual({ w: 100, h: 200 });
  });

  it('only owner can finalize (403 otherwise)', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const ta = tok('alice');
    const tb = tok('bob');
    const u = await request(app)
      .post('/media/upload-url')
      .set('authorization', `Bearer ${ta}`)
      .send({ kind: 'image', contentType: 'image/png' })
      .expect(201);
    await request(app)
      .post(`/media/${u.body.id}/finalize`)
      .set('authorization', `Bearer ${tb}`)
      .send({})
      .expect(403);
  });

  it('rejects unknown media id (404)', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    await request(app).get('/media/not-real').expect(404);
  });
});
