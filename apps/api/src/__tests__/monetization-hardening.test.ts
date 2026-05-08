import express from 'express';
import request from 'supertest';
import authRouter from '../routes/auth';
import monetizationRouter from '../routes/monetization';
import { errorHandler } from '../middleware/errorHandler';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/monetization', monetizationRouter);
  app.use(errorHandler);
  return app;
}

async function register(app: express.Express, suffix: string) {
  const r = await request(app).post('/api/auth/register').send({
    username: `mh${suffix}`,
    displayName: `MH ${suffix}`,
    email: `mh${suffix}@example.com`,
    password: 'Password123',
  });
  return { token: r.body.data.accessToken as string, userId: r.body.data.user.id as string };
}

describe('Monetization hardening', () => {
  let app: express.Express;
  let alice: { token: string; userId: string };
  let bob: { token: string; userId: string };

  beforeAll(async () => {
    app = buildApp();
    alice = await register(app, 'alice');
    bob = await register(app, 'bob');
    // Fund alice for tip tests.
    await request(app)
      .post('/api/monetization/wallet/topup')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ amount: 10000 });
  });

  it('topup rejects non-integer amounts', async () => {
    const res = await request(app)
      .post('/api/monetization/wallet/topup')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ amount: 1.5 });
    expect(res.status).toBe(400);
  });

  it('topup rejects amounts above 1,000,000', async () => {
    const res = await request(app)
      .post('/api/monetization/wallet/topup')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ amount: 1_000_001 });
    expect(res.status).toBe(400);
  });

  it('tip rejects non-integer amounts', async () => {
    const res = await request(app)
      .post('/api/monetization/tip')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ toUserId: bob.userId, amount: 1.5 });
    expect(res.status).toBe(400);
  });

  it('tip rejects amounts above 1,000,000', async () => {
    const res = await request(app)
      .post('/api/monetization/tip')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ toUserId: bob.userId, amount: 1_000_001 });
    expect(res.status).toBe(400);
  });

  it('tip rejects non-string note', async () => {
    const res = await request(app)
      .post('/api/monetization/tip')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ toUserId: bob.userId, amount: 100, note: { evil: true } });
    expect(res.status).toBe(400);
  });

  it('tip rejects non-string toUserId', async () => {
    const res = await request(app)
      .post('/api/monetization/tip')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ toUserId: { sub: 'pwned' }, amount: 100 });
    expect(res.status).toBe(400);
  });

  it('subscriptions reject prototype-chain tier names', async () => {
    // `__proto__` and `toString` exist on every object via the prototype chain.
    // Old `tier in TIER_PRICE` allowed this; hasOwnProperty must reject it.
    for (const tier of ['__proto__', 'toString', 'hasOwnProperty']) {
      const res = await request(app)
        .post('/api/monetization/subscriptions')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ creatorId: bob.userId, tier });
      expect(res.status).toBe(400);
    }
  });

  it('subscriptions reject non-string creatorId', async () => {
    const res = await request(app)
      .post('/api/monetization/subscriptions')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ creatorId: { id: bob.userId }, tier: 'basic' });
    expect(res.status).toBe(400);
  });

  it('GET /transactions clamps limit to [1, 200]', async () => {
    const big = await request(app)
      .get('/api/monetization/transactions?limit=999999')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(big.status).toBe(200);
    expect(big.body.data.length).toBeLessThanOrEqual(200);

    const negative = await request(app)
      .get('/api/monetization/transactions?limit=-5')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(negative.status).toBe(200);
    // No negative slice — should return at most a small positive page.
    expect(Array.isArray(negative.body.data)).toBe(true);
    expect(negative.body.data.length).toBeLessThanOrEqual(1);
  });

  it('subscriptions can still be created and cancelled with valid tier', async () => {
    const create = await request(app)
      .post('/api/monetization/subscriptions')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ creatorId: bob.userId, tier: 'basic' });
    expect(create.status).toBe(201);

    const cancel = await request(app)
      .delete(`/api/monetization/subscriptions/${create.body.data.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.active).toBe(false);
  });
});
