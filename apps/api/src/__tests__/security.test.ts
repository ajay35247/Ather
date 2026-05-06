import express from 'express';
import request from 'supertest';
import authRouter from '../routes/auth';
import postsRouter from '../routes/posts';
import monetizationRouter from '../routes/monetization';
import { errorHandler } from '../middleware/errorHandler';

// Each app instance is fresh so the in-memory user/family stores don't leak
// across describes in unrelated suites.
function makeApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/posts', postsRouter);
  app.use('/api/monetization', monetizationRouter);
  app.use(errorHandler);
  return app;
}

describe('Security upgrades', () => {
  describe('Refresh-token rotation + reuse detection', () => {
    const app = makeApp();
    const creds = {
      username: 'rotuser',
      displayName: 'Rot User',
      email: 'rot@example.com',
      password: 'Password123',
    };

    let firstRefresh: string;

    beforeAll(async () => {
      const r = await request(app).post('/api/auth/register').send(creds);
      firstRefresh = r.body.data.refreshToken;
      expect(firstRefresh).toBeDefined();
    });

    it('rotates the refresh token on each successful refresh', async () => {
      const r = await request(app).post('/api/auth/refresh').send({ refreshToken: firstRefresh });
      expect(r.status).toBe(200);
      expect(r.body.data.refreshToken).toBeDefined();
      expect(r.body.data.refreshToken).not.toBe(firstRefresh);
    });

    it('detects reuse of a retired refresh token and revokes the family', async () => {
      // `firstRefresh` was already exchanged above → its jti is no longer current.
      const replay = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: firstRefresh });
      expect(replay.status).toBe(401);
      expect(replay.body.error).toMatch(/reuse/i);
    });

    it('rejects refresh-token reuse even via a freshly-rotated token after revocation', async () => {
      // After reuse was detected, the entire family is revoked. Any token
      // from that family — including ones we got after rotation — is dead.
      // We re-login to get a clean family.
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: creds.email, password: creds.password });
      expect(login.status).toBe(200);
      const r1 = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: login.body.data.refreshToken });
      expect(r1.status).toBe(200);
      const second = r1.body.data.refreshToken;
      // First rotation worked; the *previous* token is now retired.
      const reuse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: login.body.data.refreshToken });
      expect(reuse.status).toBe(401);
      // ... and the family is now revoked, so even the (otherwise-valid)
      // newer token is dead.
      const dead = await request(app).post('/api/auth/refresh').send({ refreshToken: second });
      expect(dead.status).toBe(401);
    });

    it('logout revokes the refresh-token family', async () => {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: creds.email, password: creds.password });
      const access = login.body.data.accessToken;
      const refresh = login.body.data.refreshToken;
      const logout = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${access}`)
        .send({ refreshToken: refresh });
      expect(logout.status).toBe(200);
      const post = await request(app).post('/api/auth/refresh').send({ refreshToken: refresh });
      expect(post.status).toBe(401);
    });
  });

  describe('Posts mediaUrls allowlist', () => {
    const app = makeApp();
    let token: string;

    beforeAll(async () => {
      const r = await request(app).post('/api/auth/register').send({
        username: 'mediauser',
        displayName: 'Media User',
        email: 'media@example.com',
        password: 'Password123',
      });
      token = r.body.data.accessToken;
    });

    it('accepts safe https URLs', async () => {
      const r = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          content: 'pic',
          mediaUrls: ['https://cdn.example.com/a.png'],
        });
      expect(r.status).toBe(201);
      expect(r.body.data.mediaUrls).toEqual(['https://cdn.example.com/a.png']);
    });

    it('rejects javascript: URLs (XSS)', async () => {
      const r = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'x', mediaUrls: ['javascript:alert(1)'] });
      expect(r.status).toBe(400);
    });

    it('rejects data: URLs', async () => {
      const r = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'x', mediaUrls: ['data:text/html,<script>alert(1)</script>'] });
      expect(r.status).toBe(400);
    });

    it('rejects RFC1918 hosts (SSRF)', async () => {
      const r = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'x', mediaUrls: ['http://10.0.0.1/secret'] });
      expect(r.status).toBe(400);
    });

    it('rejects localhost', async () => {
      const r = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'x', mediaUrls: ['http://localhost:6379/'] });
      expect(r.status).toBe(400);
    });

    it('rejects URLs with embedded userinfo (phishing)', async () => {
      const r = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'x', mediaUrls: ['https://attacker@evil.example/'] });
      expect(r.status).toBe(400);
    });
  });

  describe('Monetization idempotency', () => {
    const app = makeApp();
    let token: string;

    beforeAll(async () => {
      const r = await request(app).post('/api/auth/register').send({
        username: 'idemuser',
        displayName: 'Idem User',
        email: 'idem@example.com',
        password: 'Password123',
      });
      token = r.body.data.accessToken;
    });

    it('topup with same Idempotency-Key replays cached response (no double-credit)', async () => {
      const key = 'idem-test-key-0001';
      const first = await request(app)
        .post('/api/monetization/wallet/topup')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send({ amount: 1000 });
      expect(first.status).toBe(201);
      expect(first.body.data.wallet.balance).toBe(1000);

      const second = await request(app)
        .post('/api/monetization/wallet/topup')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send({ amount: 1000 });
      expect(second.status).toBe(201);
      expect(second.headers['idempotent-replay']).toBe('true');
      // Wallet balance must NOT have doubled.
      expect(second.body.data.wallet.balance).toBe(1000);

      const balance = await request(app)
        .get('/api/monetization/wallet')
        .set('Authorization', `Bearer ${token}`);
      expect(balance.body.data.balance).toBe(1000);
    });

    it('rejects malformed Idempotency-Key', async () => {
      const r = await request(app)
        .post('/api/monetization/wallet/topup')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'abc') // too short
        .send({ amount: 100 });
      expect(r.status).toBe(400);
    });

    it('different keys produce independent transactions', async () => {
      // Start fresh: balance is currently 1000 from the test above.
      const a = await request(app)
        .post('/api/monetization/wallet/topup')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'idem-test-key-aaa-1')
        .send({ amount: 500 });
      const b = await request(app)
        .post('/api/monetization/wallet/topup')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'idem-test-key-bbb-2')
        .send({ amount: 500 });
      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      expect(b.body.data.wallet.balance).toBe(2000);
    });
  });
});
