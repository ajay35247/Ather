import jwt from 'jsonwebtoken';
import request from 'supertest';
import { makeApp } from '../src/app';

const SECRET = 'test-access-secret-please-ignore-32';
const INTERNAL = 'test-internal';
const tok = (sub: string) =>
  jwt.sign({ sub, handle: sub, type: 'access' }, SECRET, {
    algorithm: 'HS256',
    issuer: 'ather.auth',
    expiresIn: 300
  });

describe('wallet-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET, internalSecret: INTERNAL });
    expect((await request(app).get('/health')).body.service).toBe('wallet');
  });

  it('default balance is 0/INR', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET, internalSecret: INTERNAL });
    const r = await request(app).get('/wallet/me').set('authorization', `Bearer ${tok('alice')}`);
    expect(r.body.wallet).toEqual({ balance: 0, currency: 'INR' });
  });

  it('internal set updates balance', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET, internalSecret: INTERNAL });
    await request(app)
      .post('/wallet/internal/set')
      .set('x-internal-secret', INTERNAL)
      .send({ userId: 'alice', balance: 10000 })
      .expect(204);
    const r = await request(app).get('/wallet/me').set('authorization', `Bearer ${tok('alice')}`);
    expect(r.body.wallet.balance).toBe(10000);
  });
});
