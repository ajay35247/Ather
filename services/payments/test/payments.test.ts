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

describe('payments-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET, internalSecret: INTERNAL });
    expect((await request(app).get('/health')).body.service).toBe('payments');
  });

  it('create intent + webhook confirm', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET, internalSecret: INTERNAL });
    const c = await request(app)
      .post('/payments/intents')
      .set('authorization', `Bearer ${tok('alice')}`)
      .send({ amount: 50000, currency: 'INR', provider: 'razorpay' });
    expect(c.status).toBe(201);
    expect(c.body.intent.status).toBe('requires_action');

    await request(app)
      .post('/payments/webhooks/confirm')
      .send({ id: c.body.intent.id, success: true })
      .expect(401);

    const w = await request(app)
      .post('/payments/webhooks/confirm')
      .set('x-internal-secret', INTERNAL)
      .send({ id: c.body.intent.id, success: true });
    expect(w.body.intent.status).toBe('succeeded');
  });
});
