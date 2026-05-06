import jwt from 'jsonwebtoken';
import request from 'supertest';
import { makeApp } from '../src/app';
import { FeedStore } from '../src/routes';

const SECRET = 'test-access-secret-please-ignore-32';
const tok = (sub: string) =>
  jwt.sign({ sub, handle: sub, type: 'access' }, SECRET, {
    algorithm: 'HS256',
    issuer: 'ather.auth',
    expiresIn: 300
  });

function seed(store: FeedStore, userId: string) {
  const base = Date.now();
  for (let i = 0; i < 5; i++) {
    store.push({
      id: `p${i}`,
      userId,
      postId: `p${i}`,
      authorId: 'someone',
      score: i * 0.1,
      reason: i % 2 === 0 ? 'following' : 'recommended',
      createdAt: new Date(base + i * 1000).toISOString()
    });
  }
}

describe('feed-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const r = await request(app).get('/health');
    expect(r.body.service).toBe('feed');
  });

  it('returns ranked feed for user', async () => {
    const store = new FeedStore();
    seed(store, 'alice');
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET, store });
    const r = await request(app)
      .get('/feed/home?mode=for_you&limit=10')
      .set('authorization', `Bearer ${tok('alice')}`);
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(5);
    // Highest score first
    expect(r.body.items[0].score).toBe(0.4);
  });

  it('following mode filters by reason', async () => {
    const store = new FeedStore();
    seed(store, 'alice');
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET, store });
    const r = await request(app)
      .get('/feed/home?mode=following&limit=10')
      .set('authorization', `Bearer ${tok('alice')}`);
    expect(r.body.items.every((e: { reason: string }) => e.reason === 'following')).toBe(true);
  });

  it('report endpoint validates input', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const t = tok('alice');
    await request(app)
      .post('/feed/report')
      .set('authorization', `Bearer ${t}`)
      .send({ targetId: 'p1', reason: 'spam' })
      .expect(202);

    const bad = await request(app)
      .post('/feed/report')
      .set('authorization', `Bearer ${t}`)
      .send({ targetId: 'p1', reason: 'invalid' });
    expect(bad.status).toBe(400);
  });
});
