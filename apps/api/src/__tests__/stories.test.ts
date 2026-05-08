import express from 'express';
import request from 'supertest';
import authRouter from '../routes/auth';
import storiesRouter, { stories, _resetStoriesForTests } from '../routes/stories';
import notificationsRouter from '../routes/notifications';
import { errorHandler } from '../middleware/errorHandler';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/stories', storiesRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use(errorHandler);
  return app;
}

async function register(app: express.Express, suffix: string) {
  const res = await request(app).post('/api/auth/register').send({
    username: `storyuser${suffix}`,
    displayName: `Story User ${suffix}`,
    email: `story${suffix}@example.com`,
    password: 'Password123',
  });
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
}

describe('Stories Routes', () => {
  let app: express.Express;
  let author: { token: string; userId: string };
  let viewer: { token: string; userId: string };

  beforeAll(async () => {
    app = buildApp();
    author = await register(app, 'a');
    viewer = await register(app, 'b');
  });

  afterEach(() => {
    _resetStoriesForTests();
  });

  it('POST /api/stories - creates an image story with 24h expiry', async () => {
    const res = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${author.token}`)
      .send({
        type: 'image',
        text: 'Sunset!',
        mediaUrls: ['https://cdn.example.com/sunset.jpg'],
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('image');
    expect(res.body.data.mediaUrls).toEqual(['https://cdn.example.com/sunset.jpg']);
    expect(res.body.data.viewsCount).toBe(0);

    const created = new Date(res.body.data.createdAt).getTime();
    const expires = new Date(res.body.data.expiresAt).getTime();
    const ttlHours = (expires - created) / (60 * 60 * 1000);
    expect(ttlHours).toBeCloseTo(24, 0);
  });

  it('POST /api/stories - creates a text story', async () => {
    const res = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ type: 'text', text: 'GM!', backgroundColor: '#ff00aa' });
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('text');
    expect(res.body.data.text).toBe('GM!');
    expect(res.body.data.backgroundColor).toBe('#ff00aa');
  });

  it('POST /api/stories - rejects unknown type', async () => {
    const res = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ type: 'hologram', text: 'x' });
    expect(res.status).toBe(400);
  });

  it('POST /api/stories - rejects javascript: URLs', async () => {
    const res = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${author.token}`)
      // eslint-disable-next-line no-script-url
      .send({ type: 'image', mediaUrls: ['javascript:alert(1)'] });
    expect(res.status).toBe(400);
  });

  it('POST /api/stories - rejects malformed backgroundColor', async () => {
    const res = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ type: 'text', text: 'x', backgroundColor: 'red' });
    expect(res.status).toBe(400);
  });

  it('POST /api/stories - requires auth', async () => {
    const res = await request(app)
      .post('/api/stories')
      .send({ type: 'text', text: 'x' });
    expect(res.status).toBe(401);
  });

  it('GET /api/stories - groups active stories by author and orders newest first', async () => {
    await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ type: 'text', text: 'one' });
    await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ type: 'text', text: 'two' });

    const res = await request(app).get('/api/stories');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].authorId).toBe(author.userId);
    expect(res.body.data[0].stories).toHaveLength(2);
    expect(res.body.data[0].stories[0].text).toBe('two'); // newest first
    expect(res.body.data[0].hasUnviewed).toBe(true);
  });

  it('GET /api/stories - excludes expired stories', async () => {
    const create = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ type: 'text', text: 'old' });
    const id = create.body.data.id;

    // Force-expire via direct store mutation; HTTP doesn't expose this.
    stories[id].expiresAt = new Date(Date.now() - 1000).toISOString();

    const res = await request(app).get('/api/stories');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('GET /api/stories/:id - records a view for a non-author viewer', async () => {
    const created = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ type: 'text', text: 'view me' });
    const id = created.body.data.id;

    const res = await request(app)
      .get(`/api/stories/${id}`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.viewsCount).toBe(1);
    expect(res.body.data.isViewed).toBe(true);
  });

  it('GET /api/stories/:id - author viewing own story does not count as a view', async () => {
    const created = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ type: 'text', text: 'self' });
    const id = created.body.data.id;

    const res = await request(app)
      .get(`/api/stories/${id}`)
      .set('Authorization', `Bearer ${author.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.viewsCount).toBe(0);
  });

  it('GET /api/stories/:id - returns 404 for expired stories', async () => {
    const created = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ type: 'text', text: 'gone' });
    const id = created.body.data.id;
    stories[id].expiresAt = new Date(Date.now() - 1000).toISOString();

    const res = await request(app).get(`/api/stories/${id}`);
    expect(res.status).toBe(404);
  });

  it('GET /api/stories/:id/views - only the author may see viewers', async () => {
    const created = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ type: 'text', text: 'x' });
    const id = created.body.data.id;

    await request(app)
      .get(`/api/stories/${id}`)
      .set('Authorization', `Bearer ${viewer.token}`);

    const forbidden = await request(app)
      .get(`/api/stories/${id}/views`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(forbidden.status).toBe(403);

    const ok = await request(app)
      .get(`/api/stories/${id}/views`)
      .set('Authorization', `Bearer ${author.token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.viewsCount).toBe(1);
    expect(ok.body.data.viewers[0].id).toBe(viewer.userId);
  });

  it('POST /api/stories/:id/reactions - adds a reaction and notifies the author', async () => {
    const created = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ type: 'text', text: 'react' });
    const id = created.body.data.id;

    const reactRes = await request(app)
      .post(`/api/stories/${id}/reactions`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ emoji: '🔥' });
    expect(reactRes.status).toBe(201);
    expect(reactRes.body.data.reactionsCount).toBe(1);

    const notifs = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${author.token}`);
    expect(notifs.status).toBe(200);
    const reactNotif = notifs.body.data.find((n: any) => n.type === 'story.react');
    expect(reactNotif).toBeDefined();
    expect(reactNotif.targetId).toBe(id);
  });

  it('POST /api/stories/:id/reactions - rejects emoji outside allowed set', async () => {
    const created = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ type: 'text', text: 'x' });
    const id = created.body.data.id;

    const res = await request(app)
      .post(`/api/stories/${id}/reactions`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ emoji: '🦄' });
    expect(res.status).toBe(400);
  });

  it('DELETE /api/stories/:id - only owner can delete', async () => {
    const created = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ type: 'text', text: 'mine' });
    const id = created.body.data.id;

    const forbidden = await request(app)
      .delete(`/api/stories/${id}`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(forbidden.status).toBe(403);

    const ok = await request(app)
      .delete(`/api/stories/${id}`)
      .set('Authorization', `Bearer ${author.token}`);
    expect(ok.status).toBe(200);

    const gone = await request(app).get(`/api/stories/${id}`);
    expect(gone.status).toBe(404);
  });

  it('DELETE /api/stories/:id/reactions - returns 404 when no reaction exists', async () => {
    const created = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ type: 'text', text: 'no react' });
    const id = created.body.data.id;

    // Viewer never reacted — DELETE should not silently 200.
    const res = await request(app)
      .delete(`/api/stories/${id}/reactions`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(res.status).toBe(404);
  });

  it('DELETE /api/stories/:id/reactions - removes existing reaction then 404 on retry', async () => {
    const created = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ type: 'text', text: 'react then unreact' });
    const id = created.body.data.id;

    await request(app)
      .post(`/api/stories/${id}/reactions`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ emoji: '🔥' });

    const ok = await request(app)
      .delete(`/api/stories/${id}/reactions`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.reactionsCount).toBe(0);

    const again = await request(app)
      .delete(`/api/stories/${id}/reactions`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(again.status).toBe(404);
  });
});
