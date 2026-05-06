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

describe('creator-studio-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    expect((await request(app).get('/health')).body.service).toBe('creator-studio');
  });

  it('GET /me returns default stats for new creator', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const r = await request(app).get('/creator-studio/me').set('authorization', `Bearer ${tok('alice')}`);
    expect(r.body.stats.postsTotal).toBe(0);
  });
});
