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

describe('groups-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    expect((await request(app).get('/health')).body.service).toBe('groups');
  });

  it('create + add member', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const t = tok('alice');
    const c = await request(app).post('/groups').set('authorization', `Bearer ${t}`).send({ name: 'g1' }).expect(201);
    const r = await request(app)
      .post(`/groups/${c.body.group.id}/members`)
      .set('authorization', `Bearer ${t}`)
      .send({ userId: 'bob' });
    expect(r.body.group.memberIds.sort()).toEqual(['alice', 'bob']);
  });
});
