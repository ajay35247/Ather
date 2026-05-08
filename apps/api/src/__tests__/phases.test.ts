import express from 'express';
import request from 'supertest';
import authRouter from '../routes/auth';
import aiRouter from '../routes/ai';
import monetizationRouter from '../routes/monetization';
import miniAppsRouter from '../routes/miniapps';
import identityRouter from '../routes/identity';
import wellbeingRouter from '../routes/wellbeing';
import liveRouter from '../routes/live';
import { errorHandler } from '../middleware/errorHandler';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/ai', aiRouter);
app.use('/api/monetization', monetizationRouter);
app.use('/api/mini-apps', miniAppsRouter);
app.use('/api/identity', identityRouter);
app.use('/api/wellbeing', wellbeingRouter);
app.use('/api/live', liveRouter);
app.use(errorHandler);

async function register(username: string, email: string) {
  const r = await request(app).post('/api/auth/register').send({
    username,
    displayName: username,
    email,
    password: 'Password123',
  });
  return { token: r.body.data.accessToken as string, userId: r.body.data.user.id as string };
}

describe('Phase 2-5 Routes', () => {
  let alice: { token: string; userId: string };
  let bob: { token: string; userId: string };

  beforeAll(async () => {
    alice = await register('phasealice', 'alice@phases.com');
    bob = await register('phasebob', 'bob@phases.com');
  });

  // ── AI ─────────────────────────────────────────────────────────────────────
  describe('AI', () => {
    it('POST /api/ai/chat returns a reply and history', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ message: 'hello' });
      expect(res.status).toBe(200);
      expect(typeof res.body.data.reply).toBe('string');
      expect(res.body.data.history.length).toBe(2);
    });

    it('POST /api/ai/chat rejects empty message', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ message: '' });
      expect(res.status).toBe(400);
    });

    it('POST /api/ai/smart-replies returns 3 suggestions', async () => {
      const res = await request(app)
        .post('/api/ai/smart-replies')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ message: 'Want to meet for coffee?' });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
    });

    it('POST /api/ai/moderate flags banned terms', async () => {
      const res = await request(app)
        .post('/api/ai/moderate')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ content: 'this is spam content' });
      expect(res.status).toBe(200);
      expect(res.body.data.safe).toBe(false);
      expect(res.body.data.flags.some((f: string) => f.includes('spam'))).toBe(true);
    });

    it('POST /api/ai/moderate accepts safe content', async () => {
      const res = await request(app)
        .post('/api/ai/moderate')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ content: 'Hello world, this is a friendly post.' });
      expect(res.status).toBe(200);
      expect(res.body.data.safe).toBe(true);
    });
  });

  // ── Monetization ───────────────────────────────────────────────────────────
  describe('Monetization', () => {
    it('GET /api/monetization/wallet returns zero balance for new user', async () => {
      const res = await request(app)
        .get('/api/monetization/wallet')
        .set('Authorization', `Bearer ${alice.token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.balance).toBe(0);
    });

    it('POST /api/monetization/wallet/topup adds balance', async () => {
      const res = await request(app)
        .post('/api/monetization/wallet/topup')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ amount: 5000 });
      expect(res.status).toBe(201);
      expect(res.body.data.wallet.balance).toBe(5000);
    });

    it('POST /api/monetization/wallet/topup rejects non-positive amounts', async () => {
      const res = await request(app)
        .post('/api/monetization/wallet/topup')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ amount: -10 });
      expect(res.status).toBe(400);
    });

    it('POST /api/monetization/tip transfers funds between users', async () => {
      const res = await request(app)
        .post('/api/monetization/tip')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ toUserId: bob.userId, amount: 1000, note: 'great post!' });
      expect(res.status).toBe(201);
      expect(res.body.data.wallet.balance).toBe(4000);
    });

    it('POST /api/monetization/tip blocks self-tipping', async () => {
      const res = await request(app)
        .post('/api/monetization/tip')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ toUserId: alice.userId, amount: 100 });
      expect(res.status).toBe(400);
    });

    it('POST /api/monetization/tip blocks insufficient funds', async () => {
      // bob has 1000 from the prior test; amount must exceed his balance
      // (and stay within the new ≤1,000,000 hardening cap).
      const res = await request(app)
        .post('/api/monetization/tip')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ toUserId: alice.userId, amount: 500_000 });
      expect(res.status).toBe(402);
    });

    it('POST /api/monetization/subscriptions creates and cancels a subscription', async () => {
      const create = await request(app)
        .post('/api/monetization/subscriptions')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ creatorId: bob.userId, tier: 'premium' });
      expect(create.status).toBe(201);
      expect(create.body.data.amountPerMonth).toBeGreaterThan(0);

      const cancel = await request(app)
        .delete(`/api/monetization/subscriptions/${create.body.data.id}`)
        .set('Authorization', `Bearer ${alice.token}`);
      expect(cancel.status).toBe(200);
      expect(cancel.body.data.active).toBe(false);
    });
  });

  // ── Mini-apps ──────────────────────────────────────────────────────────────
  describe('Mini-apps', () => {
    it('GET /api/mini-apps returns the catalog', async () => {
      const res = await request(app).get('/api/mini-apps');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('install / uninstall flow', async () => {
      const inst = await request(app)
        .post('/api/mini-apps/polls/install')
        .set('Authorization', `Bearer ${alice.token}`);
      expect(inst.status).toBe(200);

      const list = await request(app)
        .get('/api/mini-apps/installed')
        .set('Authorization', `Bearer ${alice.token}`);
      expect(list.body.data.find((a: any) => a.id === 'polls')).toBeTruthy();

      const uninst = await request(app)
        .delete('/api/mini-apps/polls/install')
        .set('Authorization', `Bearer ${alice.token}`);
      expect(uninst.status).toBe(200);
    });

    it('install rejects unknown app', async () => {
      const res = await request(app)
        .post('/api/mini-apps/no-such-app/install')
        .set('Authorization', `Bearer ${alice.token}`);
      expect(res.status).toBe(404);
    });
  });

  // ── Identity ───────────────────────────────────────────────────────────────
  describe('Identity', () => {
    it('switch persona', async () => {
      const res = await request(app)
        .post('/api/identity/persona')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ persona: 'professional' });
      expect(res.status).toBe(200);
      expect(res.body.data.activePersona).toBe('professional');
    });

    it('rejects invalid persona', async () => {
      const res = await request(app)
        .post('/api/identity/persona')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ persona: 'evil' });
      expect(res.status).toBe(400);
    });

    it('link a valid DID', async () => {
      const res = await request(app)
        .post('/api/identity/did')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ did: 'did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH' });
      expect(res.status).toBe(200);
      expect(res.body.data.didMethod).toBe('key');
    });

    it('rejects malformed DID', async () => {
      const res = await request(app)
        .post('/api/identity/did')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ did: 'not-a-did' });
      expect(res.status).toBe(400);
    });

    it('blocks duplicate DID across accounts', async () => {
      const res = await request(app)
        .post('/api/identity/did')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ did: 'did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH' });
      expect(res.status).toBe(409);
    });
  });

  // ── Wellbeing ──────────────────────────────────────────────────────────────
  describe('Wellbeing', () => {
    it('set daily limit', async () => {
      const res = await request(app)
        .put('/api/wellbeing/limit')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ minutes: 60 });
      expect(res.status).toBe(200);
      expect(res.body.data.dailyLimitMinutes).toBe(60);
    });

    it('rejects out-of-range limit', async () => {
      const res = await request(app)
        .put('/api/wellbeing/limit')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ minutes: 99999 });
      expect(res.status).toBe(400);
    });

    it('track usage and detect over-limit', async () => {
      const res = await request(app)
        .post('/api/wellbeing/track')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ minutes: 60 });
      expect(res.status).toBe(200);
      expect(res.body.data.overLimit).toBe(true);
    });

    it('set legacy contacts', async () => {
      const res = await request(app)
        .put('/api/wellbeing/legacy')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ contactIds: [bob.userId], inactivityDays: 365 });
      expect(res.status).toBe(200);
      expect(res.body.data.legacyContactIds).toEqual([bob.userId]);
      expect(res.body.data.legacyInactivityDays).toBe(365);
    });

    it('rejects self as legacy contact', async () => {
      const res = await request(app)
        .put('/api/wellbeing/legacy')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ contactIds: [alice.userId] });
      expect(res.status).toBe(400);
    });
  });

  // ── Live ───────────────────────────────────────────────────────────────────
  describe('Live', () => {
    let streamId: string;

    it('start, join, end stream', async () => {
      const start = await request(app)
        .post('/api/live')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ title: 'My first stream', category: 'gaming' });
      expect(start.status).toBe(201);
      streamId = start.body.data.id;

      const join = await request(app)
        .post(`/api/live/${streamId}/join`)
        .set('Authorization', `Bearer ${bob.token}`);
      expect(join.status).toBe(200);
      expect(join.body.data.viewerCount).toBe(1);

      const end = await request(app)
        .post(`/api/live/${streamId}/end`)
        .set('Authorization', `Bearer ${alice.token}`);
      expect(end.status).toBe(200);
      expect(end.body.data.status).toBe('ended');
    });

    it('only host can end stream', async () => {
      const start = await request(app)
        .post('/api/live')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ title: 'Another' });
      const id = start.body.data.id;
      const res = await request(app)
        .post(`/api/live/${id}/end`)
        .set('Authorization', `Bearer ${bob.token}`);
      expect(res.status).toBe(403);
    });

    it('cannot start stream without title', async () => {
      const res = await request(app)
        .post('/api/live')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });
});
