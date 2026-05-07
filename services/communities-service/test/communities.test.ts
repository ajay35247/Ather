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

describe('communities-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    expect((await request(app).get('/health')).body.service).toBe('communities');
  });

  it('create + duplicate slug rejected (409)', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const t = tok('alice');
    const c = await request(app)
      .post('/communities')
      .set('authorization', `Bearer ${t}`)
      .send({ slug: 'devs', name: 'Devs' });
    expect(c.status).toBe(201);
    const dupe = await request(app)
      .post('/communities')
      .set('authorization', `Bearer ${t}`)
      .send({ slug: 'devs', name: 'Devs Again' });
    expect(dupe.status).toBe(409);
  });

  it('join + role escalation (only owner/admin can promote)', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const ta = tok('alice');
    const tb = tok('bob');
    const c = await request(app)
      .post('/communities')
      .set('authorization', `Bearer ${ta}`)
      .send({ slug: 'club', name: 'Club' })
      .expect(201);
    await request(app).post(`/communities/${c.body.community.id}/join`).set('authorization', `Bearer ${tb}`).expect(201);

    // bob (member) cannot promote himself
    await request(app)
      .patch(`/communities/${c.body.community.id}/members/role`)
      .set('authorization', `Bearer ${tb}`)
      .send({ userId: 'bob', role: 'admin' })
      .expect(403);

    // alice (owner) can promote bob
    await request(app)
      .patch(`/communities/${c.body.community.id}/members/role`)
      .set('authorization', `Bearer ${ta}`)
      .send({ userId: 'bob', role: 'moderator' })
      .expect(200);
  });
});
