import express from 'express';
import request from 'supertest';
import authRouter from '../routes/auth';
import usersRouter from '../routes/users';
import storiesRouter, { stories, _resetStoriesForTests } from '../routes/stories';
import { errorHandler } from '../middleware/errorHandler';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/stories', storiesRouter);
  app.use(errorHandler);
  return app;
}

async function register(app: express.Express, suffix: string) {
  const res = await request(app).post('/api/auth/register').send({
    username: `userstory${suffix}`,
    displayName: `User Story ${suffix}`,
    email: `userstory${suffix}@example.com`,
    password: 'Password123',
  });
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
}

describe('GET /api/users/:id/stories', () => {
  let app: express.Express;
  let alice: { token: string; userId: string };
  let bob: { token: string; userId: string };

  beforeAll(async () => {
    app = buildApp();
    alice = await register(app, 'a');
    bob = await register(app, 'b');
  });

  afterEach(() => {
    _resetStoriesForTests();
  });

  it('requires auth', async () => {
    const res = await request(app).get(`/api/users/${alice.userId}/stories`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown user', async () => {
    const res = await request(app)
      .get('/api/users/does-not-exist/stories')
      .set('Authorization', `Bearer ${bob.token}`);
    expect(res.status).toBe(404);
  });

  it('lists active stories newest-first and excludes expired ones', async () => {
    const a = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ type: 'text', text: 'first' });
    const b = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ type: 'text', text: 'second' });
    const c = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ type: 'text', text: 'expired' });
    // Force-expire one story.
    stories[c.body.data.id].expiresAt = new Date(Date.now() - 1000).toISOString();

    const res = await request(app)
      .get(`/api/users/${alice.userId}/stories`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.author.id).toBe(alice.userId);
    expect(res.body.data.stories).toHaveLength(2);
    // Newest first: second was created last.
    expect(res.body.data.stories[0].id).toBe(b.body.data.id);
    expect(res.body.data.stories[1].id).toBe(a.body.data.id);
    expect(res.body.data.nextCursor).toBeNull();
  });

  it('paginates with ?limit and ?cursor', async () => {
    // Create 5 stories with monotonically increasing createdAt by spacing
    // calls; even on tied timestamps, secondary id sort keeps order stable.
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await request(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ type: 'text', text: `s${i}` });
      ids.push(r.body.data.id);
    }

    const page1 = await request(app)
      .get(`/api/users/${alice.userId}/stories?limit=2`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(page1.status).toBe(200);
    expect(page1.body.data.stories).toHaveLength(2);
    expect(page1.body.data.nextCursor).toBeTruthy();

    const page2 = await request(app)
      .get(`/api/users/${alice.userId}/stories?limit=2&cursor=${encodeURIComponent(page1.body.data.nextCursor)}`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(page2.status).toBe(200);
    expect(page2.body.data.stories).toHaveLength(2);
    expect(page2.body.data.nextCursor).toBeTruthy();

    const page3 = await request(app)
      .get(`/api/users/${alice.userId}/stories?limit=2&cursor=${encodeURIComponent(page2.body.data.nextCursor)}`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(page3.status).toBe(200);
    expect(page3.body.data.stories).toHaveLength(1);
    expect(page3.body.data.nextCursor).toBeNull();

    // No story id appears twice across pages.
    const seen = [
      ...page1.body.data.stories,
      ...page2.body.data.stories,
      ...page3.body.data.stories,
    ].map((s: any) => s.id);
    expect(new Set(seen).size).toBe(5);
  });

  it('rejects malformed cursors', async () => {
    const res = await request(app)
      .get(`/api/users/${alice.userId}/stories?cursor=!!!not-base64-or-pipe!!!`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(res.status).toBe(400);
  });

  it('clamps limit to allowed range', async () => {
    await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ type: 'text', text: 'a' });

    const tooBig = await request(app)
      .get(`/api/users/${alice.userId}/stories?limit=9999`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(tooBig.status).toBe(200);
    expect(tooBig.body.data.stories.length).toBeLessThanOrEqual(50);

    const zero = await request(app)
      .get(`/api/users/${alice.userId}/stories?limit=0`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(zero.status).toBe(200);
    // Floor=>0 then clamp to 1.
    expect(zero.body.data.stories.length).toBeLessThanOrEqual(1);
  });
});
