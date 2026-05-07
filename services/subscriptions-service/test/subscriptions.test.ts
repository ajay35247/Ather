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

describe('subscriptions-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    expect((await request(app).get('/health')).body.service).toBe('subscriptions');
  });

  it('subscribe + cancel + cannot subscribe to self', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const t = tok('alice');
    await request(app)
      .post('/subscriptions')
      .set('authorization', `Bearer ${t}`)
      .send({ creatorId: 'alice', plan: 'plus' })
      .expect(409);

    const c = await request(app)
      .post('/subscriptions')
      .set('authorization', `Bearer ${t}`)
      .send({ creatorId: 'bob', plan: 'plus' });
    expect(c.status).toBe(201);

    const cancelled = await request(app)
      .delete(`/subscriptions/${c.body.subscription.id}`)
      .set('authorization', `Bearer ${t}`);
    expect(cancelled.body.subscription.status).toBe('cancelled');
  });
});
