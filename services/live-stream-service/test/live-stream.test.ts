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

describe('live-stream-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    expect((await request(app).get('/health')).body.service).toBe('live-stream');
  });

  it('only host can end session (403 otherwise)', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const c = await request(app)
      .post('/live/start')
      .set('authorization', `Bearer ${tok('alice')}`)
      .send({ title: 'hi' })
      .expect(201);
    await request(app)
      .post(`/live/${c.body.session.id}/end`)
      .set('authorization', `Bearer ${tok('eve')}`)
      .expect(403);
    await request(app)
      .post(`/live/${c.body.session.id}/end`)
      .set('authorization', `Bearer ${tok('alice')}`)
      .expect(200);
  });
});
