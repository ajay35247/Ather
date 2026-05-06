import jwt from 'jsonwebtoken';
import request from 'supertest';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';

const SECRET = 'test-access-secret-please-ignore-32';

function makeApp() {
  const config = loadConfig({
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: SECRET,
    PORT: '0'
  } as NodeJS.ProcessEnv);
  return buildApp({ config });
}

function tokenFor(userId: string, handle: string) {
  return jwt.sign({ sub: userId, handle, type: 'access' }, SECRET, {
    algorithm: 'HS256',
    issuer: 'ather.auth',
    expiresIn: 300
  });
}

describe('profile-service', () => {
  it('responds to /health', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'profile' });
  });

  it('rejects /profile/me without auth', async () => {
    const { app } = makeApp();
    await request(app).get('/profile/me').expect(401);
  });

  it('lazy-projects a profile from token on first /profile/me', async () => {
    const { app } = makeApp();
    const token = tokenFor('user-1', 'alice_01');
    const res = await request(app)
      .get('/profile/me')
      .set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.profile.userId).toBe('user-1');
    expect(res.body.profile.handle).toBe('alice_01');
  });

  it('updates and looks up by handle', async () => {
    const { app } = makeApp();
    const token = tokenFor('user-2', 'bob_02');

    await request(app).get('/profile/me').set('authorization', `Bearer ${token}`).expect(200);

    const upd = await request(app)
      .patch('/profile/me')
      .set('authorization', `Bearer ${token}`)
      .send({ displayName: 'Bob the Builder', bio: 'Hi.' });
    expect(upd.status).toBe(200);
    expect(upd.body.profile.displayName).toBe('Bob the Builder');

    const byHandle = await request(app).get('/profile/by-handle/bob_02');
    expect(byHandle.status).toBe(200);
    expect(byHandle.body.profile.displayName).toBe('Bob the Builder');

    const missing = await request(app).get('/profile/by-handle/ghost');
    expect(missing.status).toBe(404);
  });

  it('rejects invalid update payloads', async () => {
    const { app } = makeApp();
    const token = tokenFor('user-3', 'cara_03');
    const res = await request(app)
      .patch('/profile/me')
      .set('authorization', `Bearer ${token}`)
      .send({ avatarUrl: 'not-a-url' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation_failed');
  });
});
