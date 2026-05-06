import request from 'supertest';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';

function makeApp() {
  const config = loadConfig({
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: 'test-access-secret-please-ignore-32',
    JWT_REFRESH_SECRET: 'test-refresh-secret-please-ignore-32',
    JWT_ACCESS_TTL_SECONDS: '300',
    JWT_REFRESH_TTL_SECONDS: '600',
    PORT: '0'
  } as NodeJS.ProcessEnv);
  return buildApp({ config });
}

const validUser = {
  handle: 'alice_01',
  email: 'alice@example.com',
  password: 'correct horse battery staple',
  displayName: 'Alice'
};

describe('auth-service', () => {
  it('responds to /health', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'auth' });
  });

  it('rejects invalid registration input', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/auth/register')
      .send({ handle: 'A!', email: 'nope', password: 'short', displayName: '' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation_failed');
  });

  it('registers, returns tokens, and /me works', async () => {
    const { app } = makeApp();
    const reg = await request(app).post('/auth/register').send(validUser);
    expect(reg.status).toBe(201);
    expect(reg.body.user.handle).toBe(validUser.handle);
    expect(reg.body.accessToken).toBeTruthy();
    expect(reg.body.refreshToken).toBeTruthy();

    const me = await request(app)
      .get('/auth/me')
      .set('authorization', `Bearer ${reg.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.handle).toBe(validUser.handle);
  });

  it('rejects duplicate handle/email with 409', async () => {
    const { app } = makeApp();
    await request(app).post('/auth/register').send(validUser).expect(201);
    const dup = await request(app).post('/auth/register').send(validUser);
    expect(dup.status).toBe(409);
  });

  it('logs in, refreshes (single-use), and rejects reuse', async () => {
    const { app } = makeApp();
    await request(app).post('/auth/register').send(validUser).expect(201);

    const login = await request(app).post('/auth/login').send({
      handleOrEmail: validUser.email,
      password: validUser.password
    });
    expect(login.status).toBe(200);
    const refreshToken = login.body.refreshToken as string;

    const r1 = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(r1.status).toBe(200);
    expect(r1.body.refreshToken).not.toBe(refreshToken);

    // Old refresh must be revoked (single-use rotation).
    const reuse = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(reuse.status).toBe(401);
  });

  it('rejects bad password', async () => {
    const { app } = makeApp();
    await request(app).post('/auth/register').send(validUser).expect(201);
    const res = await request(app).post('/auth/login').send({
      handleOrEmail: validUser.handle,
      password: 'wrong wrong wrong wrong'
    });
    expect(res.status).toBe(401);
  });

  it('logout revokes refresh token', async () => {
    const { app } = makeApp();
    const reg = await request(app).post('/auth/register').send(validUser).expect(201);
    const refreshToken = reg.body.refreshToken as string;
    await request(app).post('/auth/logout').send({ refreshToken }).expect(204);
    const after = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(after.status).toBe(401);
  });

  it('/me rejects missing or invalid token', async () => {
    const { app } = makeApp();
    await request(app).get('/auth/me').expect(401);
    await request(app)
      .get('/auth/me')
      .set('authorization', 'Bearer not-a-jwt')
      .expect(401);
  });
});
