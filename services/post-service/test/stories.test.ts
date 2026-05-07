import jwt from 'jsonwebtoken';
import request from 'supertest';
import { makeApp } from '../src/app';
import { StoryStore } from '../src/stories';

const SECRET = 'test-access-secret-please-ignore-32';
const tok = (sub: string) =>
  jwt.sign({ sub, handle: sub, type: 'access' }, SECRET, {
    algorithm: 'HS256',
    issuer: 'ather.auth',
    expiresIn: 300
  });

describe('stories-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    expect((await request(app).get('/health')).body.service).toBe('post-service');
  });

  it('expired stories are filtered out', () => {
    const store = new StoryStore();
    const s = store.add('alice', '00000000-0000-0000-0000-000000000001', 1);
    const future = new Date(new Date(s.expiresAt).getTime() + 1000);
    expect(store.active(future)).toHaveLength(0);
  });

  it('create + active list', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    await request(app)
      .post('/stories')
      .set('authorization', `Bearer ${tok('alice')}`)
      .send({ mediaId: '00000000-0000-0000-0000-000000000001' })
      .expect(201);
    const r = await request(app).get('/stories/active');
    expect(r.body.items).toHaveLength(1);
  });
});
