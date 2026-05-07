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

describe('reels-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    expect((await request(app).get('/health')).body.service).toBe('post-service');
  });

  it('create + get + delete (author-only)', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const ta = tok('alice');
    const c = await request(app)
      .post('/reels')
      .set('authorization', `Bearer ${ta}`)
      .send({ mediaId: '00000000-0000-0000-0000-000000000001', durationMs: 30_000 });
    expect(c.status).toBe(201);
    const id = c.body.reel.id;

    await request(app).get(`/reels/${id}`).expect(200);

    await request(app)
      .delete(`/reels/${id}`)
      .set('authorization', `Bearer ${tok('eve')}`)
      .expect(403);

    await request(app)
      .delete(`/reels/${id}`)
      .set('authorization', `Bearer ${ta}`)
      .expect(204);
  });

  it('rejects too-long reel duration', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const r = await request(app)
      .post('/reels')
      .set('authorization', `Bearer ${tok('alice')}`)
      .send({ mediaId: '00000000-0000-0000-0000-000000000001', durationMs: 999_999 });
    expect(r.status).toBe(400);
  });
});
