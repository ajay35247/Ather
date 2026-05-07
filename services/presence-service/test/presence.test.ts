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

describe('presence-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const r = await request(app).get('/health');
    expect(r.body.service).toBe('presence');
  });

  it('default presence is offline', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const r = await request(app).get('/presence/alice');
    expect(r.body.presence.state).toBe('offline');
  });

  it('heartbeat updates presence', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    await request(app)
      .post('/presence/heartbeat')
      .set('authorization', `Bearer ${tok('alice')}`)
      .send({ state: 'online' })
      .expect(200);
    const r = await request(app).get('/presence/alice');
    expect(r.body.presence.state).toBe('online');
  });

  it('bulk lookup', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    await request(app)
      .post('/presence/heartbeat')
      .set('authorization', `Bearer ${tok('alice')}`)
      .send({ state: 'online' })
      .expect(200);
    const r = await request(app).post('/presence/bulk').send({ userIds: ['alice', 'bob'] });
    expect(r.body.presence.alice.state).toBe('online');
    expect(r.body.presence.bob.state).toBe('offline');
  });
});
