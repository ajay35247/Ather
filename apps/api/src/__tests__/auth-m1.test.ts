import express from 'express';
import request from 'supertest';
import authRouter from '../routes/auth';
import { errorHandler } from '../middleware/errorHandler';
import { setGoogleVerifier, resetGoogleVerifier } from '../lib/googleVerifier';
import { generateTotp } from '../lib/totp';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use(errorHandler);
  return app;
}

describe('Auth M1 — Google OAuth', () => {
  const app = makeApp();

  beforeAll(() => {
    setGoogleVerifier(async (idToken: string) => {
      if (idToken === 'BAD') throw new Error('bad token');
      if (idToken === 'UNVERIFIED') {
        return {
          email: 'unverified@example.com',
          emailVerified: false,
          sub: 'g-unv',
        };
      }
      return {
        email: 'gtest@example.com',
        emailVerified: true,
        sub: 'g-12345',
        name: 'G Test',
      };
    });
  });
  afterAll(() => resetGoogleVerifier());

  it('rejects an invalid Google id token', async () => {
    const res = await request(app).post('/api/auth/google').send({ idToken: 'BAD' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects a Google account whose email is not verified', async () => {
    const res = await request(app).post('/api/auth/google').send({ idToken: 'UNVERIFIED' });
    expect(res.status).toBe(401);
  });

  it('provisions a new user on first Google sign-in', async () => {
    const res = await request(app).post('/api/auth/google').send({ idToken: 'GOOD' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('gtest@example.com');
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('returns the same user on subsequent Google sign-ins', async () => {
    const first = await request(app).post('/api/auth/google').send({ idToken: 'GOOD' });
    const second = await request(app).post('/api/auth/google').send({ idToken: 'GOOD' });
    expect(second.body.data.user.id).toBe(first.body.data.user.id);
  });
});

describe('Auth M1 — Email OTP', () => {
  const app = makeApp();
  const email = `otp-${Date.now()}@example.com`;

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({
      email,
      password: 'Password123',
      username: `otpuser${Date.now().toString().slice(-6)}`,
      displayName: 'OTP User',
    });
  });

  it('issues an OTP and returns it in dev (NODE_ENV=test)', async () => {
    const res = await request(app).post('/api/auth/otp/request').send({ email });
    expect(res.status).toBe(200);
    expect(res.body.data.sent).toBe(true);
    expect(res.body.data.devCode).toMatch(/^\d{6}$/);
  });

  it('does not enumerate accounts: returns 200 for unknown email too', async () => {
    const res = await request(app)
      .post('/api/auth/otp/request')
      .send({ email: 'nobody-here@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.data.sent).toBe(true);
  });

  it('rejects a wrong code', async () => {
    await request(app).post('/api/auth/otp/request').send({ email });
    const res = await request(app)
      .post('/api/auth/otp/verify')
      .send({ email, code: '000000' });
    expect(res.status).toBe(401);
  });

  it('logs in with a valid code', async () => {
    const issued = await request(app).post('/api/auth/otp/request').send({ email });
    const code = issued.body.data.devCode;
    const res = await request(app).post('/api/auth/otp/verify').send({ email, code });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('cannot reuse a consumed code', async () => {
    const issued = await request(app).post('/api/auth/otp/request').send({ email });
    const code = issued.body.data.devCode;
    await request(app).post('/api/auth/otp/verify').send({ email, code });
    const second = await request(app).post('/api/auth/otp/verify').send({ email, code });
    expect(second.status).toBe(401);
  });
});

describe('Auth M1 — Forgot / Reset password', () => {
  const app = makeApp();
  const email = `reset-${Date.now()}@example.com`;
  const password = 'Password123';
  let accessToken = '';
  let refreshToken = '';

  beforeAll(async () => {
    const r = await request(app).post('/api/auth/register').send({
      email,
      password,
      username: `reset${Date.now().toString().slice(-6)}`,
      displayName: 'Reset User',
    });
    accessToken = r.body.data.accessToken;
    refreshToken = r.body.data.refreshToken;
  });

  it('always returns 200 for /password/forgot', async () => {
    const known = await request(app).post('/api/auth/password/forgot').send({ email });
    const unknown = await request(app)
      .post('/api/auth/password/forgot')
      .send({ email: 'ghost@example.com' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.data.devResetToken).toBeDefined();
    expect(unknown.body.data.devResetToken).toBeUndefined();
  });

  it('rejects an invalid reset token', async () => {
    const res = await request(app)
      .post('/api/auth/password/reset')
      .send({ token: 'not-a-jwt', password: 'NewPassword456' });
    expect(res.status).toBe(401);
  });

  it('resets the password and revokes existing sessions', async () => {
    const forgot = await request(app).post('/api/auth/password/forgot').send({ email });
    const token = forgot.body.data.devResetToken;

    const res = await request(app)
      .post('/api/auth/password/reset')
      .send({ token, password: 'NewPassword456' });
    expect(res.status).toBe(200);

    // old refresh token must be revoked
    const ref = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(ref.status).toBe(401);

    // old password must fail; new one must work
    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'NewPassword456' });
    expect(newLogin.status).toBe(200);
  });

  it('rejects a reset token that has already been consumed (passwordVersion bumped)', async () => {
    const forgot = await request(app).post('/api/auth/password/forgot').send({ email });
    const token = forgot.body.data.devResetToken;
    // first use succeeds
    const first = await request(app)
      .post('/api/auth/password/reset')
      .send({ token, password: 'AnotherPass789' });
    expect(first.status).toBe(200);
    // second use is rejected
    const second = await request(app)
      .post('/api/auth/password/reset')
      .send({ token, password: 'ShouldNotWork123' });
    expect(second.status).toBe(401);
  });

  // Keep accessToken referenced so the test file has at least one consumer.
  it('still permits /me with a fresh login', async () => {
    expect(typeof accessToken).toBe('string');
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'AnotherPass789' });
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(me.status).toBe(200);
  });
});

describe('Auth M1 — 2FA (TOTP)', () => {
  const app = makeApp();
  const email = `mfa-${Date.now()}@example.com`;
  const password = 'Password123';
  let accessToken = '';
  let secret = '';

  beforeAll(async () => {
    const r = await request(app).post('/api/auth/register').send({
      email,
      password,
      username: `mfa${Date.now().toString().slice(-6)}`,
      displayName: 'MFA User',
    });
    accessToken = r.body.data.accessToken;
  });

  it('/2fa/setup returns a secret + otpauth URL', async () => {
    const res = await request(app)
      .post('/api/auth/2fa/setup')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.secret).toMatch(/^[A-Z2-7]+$/);
    expect(res.body.data.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    secret = res.body.data.secret;
  });

  it('/2fa/enable rejects a wrong code', async () => {
    const res = await request(app)
      .post('/api/auth/2fa/enable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ otp: '000000' });
    expect(res.status).toBe(401);
  });

  it('/2fa/enable accepts a valid code and turns on MFA', async () => {
    const otp = generateTotp(secret);
    const res = await request(app)
      .post('/api/auth/2fa/enable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ otp });
    expect(res.status).toBe(200);
    expect(res.body.data.mfaEnabled).toBe(true);
  });

  it('login with MFA enabled returns mfaRequired + mfaToken (no tokens yet)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.data.mfaRequired).toBe(true);
    expect(res.body.data.accessToken).toBeUndefined();
    expect(res.body.data.mfaToken).toBeDefined();
  });

  it('/2fa/verify exchanges mfaToken+otp for tokens', async () => {
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const otp = generateTotp(secret);
    const res = await request(app)
      .post('/api/auth/2fa/verify')
      .send({ mfaToken: login.body.data.mfaToken, otp });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('login accepts inline `otp` when MFA is enabled', async () => {
    const otp = generateTotp(secret);
    const res = await request(app).post('/api/auth/login').send({ email, password, otp });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('/2fa/disable requires a valid code and turns off MFA', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password, otp: generateTotp(secret) });
    const fresh = login.body.data.accessToken;

    const bad = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${fresh}`)
      .send({ otp: '000000' });
    expect(bad.status).toBe(401);

    const ok = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${fresh}`)
      .send({ otp: generateTotp(secret) });
    expect(ok.status).toBe(200);
    expect(ok.body.data.mfaEnabled).toBe(false);

    // Subsequent login no longer demands MFA.
    const after = await request(app).post('/api/auth/login').send({ email, password });
    expect(after.body.data.accessToken).toBeDefined();
  });
});

describe('Auth M1 — Sessions / device management', () => {
  const app = makeApp();
  const email = `dev-${Date.now()}@example.com`;
  const password = 'Password123';
  let firstAccess = '';
  let firstRefresh = '';

  beforeAll(async () => {
    const r = await request(app)
      .post('/api/auth/register')
      .set('User-Agent', 'JestDevice/Alpha')
      .send({
        email,
        password,
        username: `dev${Date.now().toString().slice(-6)}`,
        displayName: 'Device User',
      });
    firstAccess = r.body.data.accessToken;
    firstRefresh = r.body.data.refreshToken;
  });

  it('GET /sessions lists active families with device metadata', async () => {
    // Add a second session from a "different device".
    await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'JestDevice/Beta')
      .send({ email, password });

    const res = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${firstAccess}`)
      .set('X-Refresh-Token', firstRefresh);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    const current = res.body.data.find((s: any) => s.current);
    expect(current).toBeDefined();
    expect(current.userAgent).toBe('JestDevice/Alpha');
  });

  it('DELETE /sessions/:fid revokes one device', async () => {
    const list = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${firstAccess}`)
      .set('X-Refresh-Token', firstRefresh);
    const other = list.body.data.find((s: any) => !s.current);
    expect(other).toBeDefined();

    const del = await request(app)
      .delete(`/api/auth/sessions/${other.fid}`)
      .set('Authorization', `Bearer ${firstAccess}`);
    expect(del.status).toBe(200);

    const after = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${firstAccess}`)
      .set('X-Refresh-Token', firstRefresh);
    expect(after.body.data.find((s: any) => s.fid === other.fid)).toBeUndefined();
  });

  it('DELETE /sessions revokes all-but-current', async () => {
    // Create two more sessions.
    await request(app).post('/api/auth/login').send({ email, password });
    await request(app).post('/api/auth/login').send({ email, password });

    const before = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${firstAccess}`)
      .set('X-Refresh-Token', firstRefresh);
    expect(before.body.data.length).toBeGreaterThanOrEqual(2);

    const del = await request(app)
      .delete('/api/auth/sessions')
      .set('Authorization', `Bearer ${firstAccess}`)
      .set('X-Refresh-Token', firstRefresh);
    expect(del.status).toBe(200);
    expect(del.body.data.revoked).toBeGreaterThanOrEqual(1);

    const after = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${firstAccess}`)
      .set('X-Refresh-Token', firstRefresh);
    expect(after.body.data.length).toBe(1);
    expect(after.body.data[0].current).toBe(true);
  });

  it('DELETE /sessions/:fid 404s on someone else’s session', async () => {
    const other = await request(app).post('/api/auth/register').send({
      email: `other-${Date.now()}@example.com`,
      password,
      username: `other${Date.now().toString().slice(-6)}`,
      displayName: 'Other',
    });
    const otherList = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${other.body.data.accessToken}`);
    const someoneElsesFid = otherList.body.data[0].fid;

    const res = await request(app)
      .delete(`/api/auth/sessions/${someoneElsesFid}`)
      .set('Authorization', `Bearer ${firstAccess}`);
    expect(res.status).toBe(404);
  });
});
