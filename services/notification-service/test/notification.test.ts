import jwt from 'jsonwebtoken';
import request from 'supertest';
import { makeApp } from '../src/app';

const SECRET = 'test-access-secret-please-ignore-32';
const INTERNAL = 'test-internal-secret';
const tok = (sub: string) =>
  jwt.sign({ sub, handle: sub, type: 'access' }, SECRET, {
    algorithm: 'HS256',
    issuer: 'ather.auth',
    expiresIn: 300
  });

describe('notification-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET, internalSecret: INTERNAL });
    const r = await request(app).get('/health');
    expect(r.body.service).toBe('notification');
  });

  it('internal push requires shared secret', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET, internalSecret: INTERNAL });
    await request(app)
      .post('/notifications/internal/push')
      .send({ userId: 'alice', kind: 'follow', payload: {} })
      .expect(401);
    await request(app)
      .post('/notifications/internal/push')
      .set('x-internal-secret', INTERNAL)
      .send({ userId: 'alice', kind: 'follow', payload: { from: 'bob' } })
      .expect(201);
  });

  it('list + unread-count + mark read', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET, internalSecret: INTERNAL });
    const p = await request(app)
      .post('/notifications/internal/push')
      .set('x-internal-secret', INTERNAL)
      .send({ userId: 'alice', kind: 'follow', payload: { from: 'bob' } })
      .expect(201);

    const t = tok('alice');
    const list = await request(app).get('/notifications').set('authorization', `Bearer ${t}`);
    expect(list.body.items).toHaveLength(1);

    const unread = await request(app)
      .get('/notifications/unread-count')
      .set('authorization', `Bearer ${t}`);
    expect(unread.body.count).toBe(1);

    await request(app)
      .patch(`/notifications/${p.body.notification.id}/read`)
      .set('authorization', `Bearer ${t}`)
      .expect(200);

    const unread2 = await request(app)
      .get('/notifications/unread-count')
      .set('authorization', `Bearer ${t}`);
    expect(unread2.body.count).toBe(0);
  });

  it('cannot mark someone else\'s notification (403)', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET, internalSecret: INTERNAL });
    const p = await request(app)
      .post('/notifications/internal/push')
      .set('x-internal-secret', INTERNAL)
      .send({ userId: 'alice', kind: 'follow', payload: {} })
      .expect(201);
    await request(app)
      .patch(`/notifications/${p.body.notification.id}/read`)
      .set('authorization', `Bearer ${tok('eve')}`)
      .expect(403);
  });
});
