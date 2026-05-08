/**
 * Notification API hardening: pagination, unread count, delete, and
 * 404-on-missing semantics. The previous routes returned the entire backlog
 * on every poll, silently 200d on PATCH for unknown ids, and had no way to
 * dismiss a single notification.
 */
import express from 'express';
import request from 'supertest';
import authRouter from '../routes/auth';
import notificationsRouter, { createNotification } from '../routes/notifications';
import { errorHandler } from '../middleware/errorHandler';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use(errorHandler);
  return app;
}

async function newUser(app: express.Express, username: string) {
  const r = await request(app).post('/api/auth/register').send({
    username,
    displayName: username,
    email: `${username}@example.com`,
    password: 'Password123',
  });
  return { userId: r.body.data.user.id, token: r.body.data.accessToken };
}

describe('Notifications hardening', () => {
  const app = makeApp();
  let me: { userId: string; token: string };

  beforeAll(async () => {
    me = await newUser(app, 'notifowner');
    // Seed 25 notifications: 10 unread (newest), 15 read (older).
    for (let i = 0; i < 25; i++) {
      createNotification(me.userId, 'test.event', 'actor-' + i, `msg-${i}`, 't' + i);
    }
    // Mark the 15 oldest as read by paging through and marking.
    // (Newest is at index 0; oldest is at index 24.)
  });

  it('GET / paginates with default limit 20', async () => {
    const r = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${me.token}`);
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(20);
    expect(r.body.nextCursor).toBeTruthy();
    expect(r.body.hasMore).toBe(true);
  });

  it('GET / honours custom limit and clamps to MAX_LIMIT (100)', async () => {
    const small = await request(app)
      .get('/api/notifications?limit=5')
      .set('Authorization', `Bearer ${me.token}`);
    expect(small.status).toBe(200);
    expect(small.body.data).toHaveLength(5);

    const huge = await request(app)
      .get('/api/notifications?limit=99999')
      .set('Authorization', `Bearer ${me.token}`);
    expect(huge.status).toBe(200);
    // Total is 25; clamping must not blow past either MAX_LIMIT or backlog size.
    expect(huge.body.data.length).toBeLessThanOrEqual(100);
    expect(huge.body.data.length).toBeLessThanOrEqual(25);
  });

  it('GET / cursor pages the next slice without overlap', async () => {
    const first = await request(app)
      .get('/api/notifications?limit=10')
      .set('Authorization', `Bearer ${me.token}`);
    const cursor = first.body.nextCursor;
    expect(cursor).toBeTruthy();
    const second = await request(app)
      .get(`/api/notifications?limit=10&cursor=${cursor}`)
      .set('Authorization', `Bearer ${me.token}`);
    expect(second.status).toBe(200);
    const idsFirst = first.body.data.map((n: any) => n.id);
    const idsSecond = second.body.data.map((n: any) => n.id);
    expect(idsFirst.some((id: string) => idsSecond.includes(id))).toBe(false);
  });

  it('GET /unread-count counts unread notifications', async () => {
    const r = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${me.token}`);
    expect(r.status).toBe(200);
    expect(typeof r.body.data.count).toBe('number');
    expect(r.body.data.count).toBe(25);
  });

  it('PATCH /:id/read returns 404 for unknown id (no silent success)', async () => {
    const r = await request(app)
      .patch('/api/notifications/does-not-exist/read')
      .set('Authorization', `Bearer ${me.token}`);
    expect(r.status).toBe(404);
  });

  it('PATCH /:id/read marks a single notification read and updates count', async () => {
    const list = await request(app)
      .get('/api/notifications?limit=1')
      .set('Authorization', `Bearer ${me.token}`);
    const id = list.body.data[0].id;
    const patch = await request(app)
      .patch(`/api/notifications/${id}/read`)
      .set('Authorization', `Bearer ${me.token}`);
    expect(patch.status).toBe(200);

    const count = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${me.token}`);
    expect(count.body.data.count).toBe(24);
  });

  it('GET /?unread=true returns only unread notifications', async () => {
    const r = await request(app)
      .get('/api/notifications?unread=true&limit=100')
      .set('Authorization', `Bearer ${me.token}`);
    expect(r.status).toBe(200);
    expect(r.body.data.every((n: any) => n.isRead === false)).toBe(true);
    expect(r.body.data.length).toBe(24); // we read one above
  });

  it('PATCH /read-all marks every notification read', async () => {
    const r = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${me.token}`);
    expect(r.status).toBe(200);
    const count = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${me.token}`);
    expect(count.body.data.count).toBe(0);
  });

  it('DELETE /:id removes a notification', async () => {
    const list = await request(app)
      .get('/api/notifications?limit=1')
      .set('Authorization', `Bearer ${me.token}`);
    const id = list.body.data[0].id;
    const del = await request(app)
      .delete(`/api/notifications/${id}`)
      .set('Authorization', `Bearer ${me.token}`);
    expect(del.status).toBe(200);

    const again = await request(app)
      .delete(`/api/notifications/${id}`)
      .set('Authorization', `Bearer ${me.token}`);
    // Already gone → 404.
    expect(again.status).toBe(404);
  });

  it('rejects unauthenticated access', async () => {
    const r = await request(app).get('/api/notifications');
    expect(r.status).toBe(401);
  });

  it("a user cannot read another user's notifications", async () => {
    const other = await newUser(app, 'notifother');
    createNotification(me.userId, 'private.event', 'attacker', 'secret', 'tx');
    const r = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${other.token}`);
    expect(r.status).toBe(200);
    expect(r.body.data.find((n: any) => n.message === 'secret')).toBeUndefined();
  });
});
