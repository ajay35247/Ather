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

describe('ads-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    expect((await request(app).get('/health')).body.service).toBe('ads');
  });

  it('only advertiser can change status (403 otherwise)', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const c = await request(app)
      .post('/ads/campaigns')
      .set('authorization', `Bearer ${tok('alice')}`)
      .send({ name: 'c1', dailyBudget: 10000 })
      .expect(201);
    await request(app)
      .patch(`/ads/campaigns/${c.body.campaign.id}`)
      .set('authorization', `Bearer ${tok('eve')}`)
      .send({ status: 'active' })
      .expect(403);
    await request(app)
      .patch(`/ads/campaigns/${c.body.campaign.id}`)
      .set('authorization', `Bearer ${tok('alice')}`)
      .send({ status: 'active' })
      .expect(200);
  });
});
