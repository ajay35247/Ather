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

  it('ranker=v1 uses the production formula and reports it', async () => {
    const store = new FeedStore();
    const now = Date.now();
    // Three posts: A spammy (no engagement), B fresh+matching interest, C old.
    const seed = [
      {
        postId: 'pA',
        authorId: 'creatorA',
        score: 0.9, // legacy score is highest, but ranker should de-prioritize
        reason: 'recommended',
        ageMs: 1000
      },
      {
        postId: 'pB',
        authorId: 'creatorB',
        score: 0.1,
        reason: 'following',
        ageMs: 60_000
      },
      {
        postId: 'pC',
        authorId: 'creatorC',
        score: 0.2,
        reason: 'recommended',
        ageMs: 1000 * 60 * 60 * 48 // 48h old
      }
    ];
    for (const s of seed) {
      store.push({
        id: s.postId,
        userId: 'alice',
        postId: s.postId,
        authorId: s.authorId,
        score: s.score,
        reason: s.reason,
        createdAt: new Date(now - s.ageMs).toISOString()
      });
      store.setPostSignals({
        postId: s.postId,
        authorId: s.authorId,
        freshnessHalfLifeH: 24,
        createdAt: new Date(now - s.ageMs).toISOString(),
        metrics:
          s.postId === 'pB'
            ? { views: 100, likes: 80, comments: 30, shares: 20, watchTimeMs: 100 * 12_000 }
            : { views: 100, likes: 0, comments: 0, shares: 0, watchTimeMs: 0 },
        tags: s.postId === 'pB' ? ['ai', 'design'] : ['random'],
        authorEngagementZ: s.postId === 'pB' ? 1.5 : 0,
        authorGated: false
      });
    }
    store.setViewerSignals({
      userId: 'alice',
      interests: ['ai', 'design'],
      mutedTags: [],
      blockedAuthorIds: []
    });
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET, store });
    const r = await request(app)
      .get('/feed/home?mode=for_you&ranker=v1&limit=10')
      .set('authorization', `Bearer ${tok('alice')}`);
    expect(r.status).toBe(200);
    expect(r.body.ranker).toBe('v1');
    expect(r.body.items[0].postId).toBe('pB'); // ranker v1 surfaces interest+engagement
  });
});
