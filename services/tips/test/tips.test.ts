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

describe('tips-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    expect((await request(app).get('/health')).body.service).toBe('tips');
  });

  it('cannot tip self (409)', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    await request(app)
      .post('/tips')
      .set('authorization', `Bearer ${tok('alice')}`)
      .send({ toUserId: 'alice', amount: 100 })
      .expect(409);
  });

  it('send + list received', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    await request(app)
      .post('/tips')
      .set('authorization', `Bearer ${tok('alice')}`)
      .send({ toUserId: 'bob', amount: 200 })
      .expect(201);
    const r = await request(app).get('/tips/received/bob');
    expect(r.body.items).toHaveLength(1);
    expect(r.body.items[0].amount).toBe(200);
  });
});
