/**
 * Cross-service end-to-end test for the Phase-1 core loop:
 *
 *   Alice signs up  →  Bob signs up
 *   Alice follows Bob       (users service)
 *   Bob creates a post      (posts service)
 *   Alice fetches her feed  (feed service)              ← must contain Bob's post
 *   Alice likes Bob's post  (posts service)             ← likesCount goes up
 *   Alice comments          (posts service)
 *   Bob reads notifications (notifications service)     ← must show all 3 events
 *
 * Failure of this test means the core loop is broken end-to-end, even
 * if every individual service's tests pass. This is the canary for the
 * Phase-1 acceptance criterion in `docs/roadmap.md`.
 */
import express from 'express';
import request from 'supertest';
import authRouter from '../routes/auth';
import usersRouter from '../routes/users';
import postsRouter from '../routes/posts';
import feedRouter from '../routes/feed';
import notificationsRouter from '../routes/notifications';
import { errorHandler } from '../middleware/errorHandler';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/posts', postsRouter);
  app.use('/api/feed', feedRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use(errorHandler);
  return app;
}

async function register(app: express.Express, username: string, email: string) {
  const r = await request(app).post('/api/auth/register').send({
    username,
    displayName: username,
    email,
    password: 'Password123',
  });
  expect(r.status).toBe(201);
  return { token: r.body.data.accessToken as string, userId: r.body.data.user.id as string };
}

describe('Core Loop E2E (Phase 1 acceptance)', () => {
  const app = buildApp();
  let alice: { token: string; userId: string };
  let bob: { token: string; userId: string };
  let postId: string;

  beforeAll(async () => {
    alice = await register(app, 'corealice', 'alice@core.test');
    bob = await register(app, 'corebob', 'bob@core.test');
  });

  it('Alice follows Bob', async () => {
    const r = await request(app)
      .post(`/api/users/${bob.userId}/follow`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
  });

  it('Bob receives a follow notification', async () => {
    const r = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${bob.token}`);
    expect(r.status).toBe(200);
    const follows = r.body.data.filter((n: any) => n.type === 'user.follow');
    expect(follows.length).toBeGreaterThanOrEqual(1);
    expect(follows[0].actorId).toBe(alice.userId);
  });

  it('Bob creates a post', async () => {
    const r = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({
        content: 'first post in the core loop',
        type: 'text',
        visibility: 'public',
        tags: ['e2e'],
      });
    expect(r.status).toBe(201);
    expect(r.body.data.authorId).toBe(bob.userId);
    postId = r.body.data.id;
  });

  it("Alice's feed contains Bob's post", async () => {
    const r = await request(app)
      .get('/api/feed?limit=50')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(r.status).toBe(200);
    const items = r.body.data ?? r.body.items ?? r.body;
    const list: any[] = Array.isArray(items) ? items : items.items ?? items.data ?? [];
    // Defensive: normalize whatever shape the BFF returns into a flat list.
    const flat = Array.isArray(list)
      ? list
      : Object.values(list).flatMap((v: any) => (Array.isArray(v) ? v : []));
    const found = flat.find((p: any) => p?.id === postId);
    expect(found).toBeDefined();
    expect(found.authorId).toBe(bob.userId);
  });

  it('Alice likes the post and Bob is notified', async () => {
    const r = await request(app)
      .post(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(r.status).toBe(200);
    expect(r.body.data.likesCount).toBe(1);

    const n = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${bob.token}`);
    const likes = n.body.data.filter(
      (x: any) => x.type === 'post.like' && x.targetId === postId,
    );
    expect(likes.length).toBe(1);
    expect(likes[0].actorId).toBe(alice.userId);
  });

  it('Alice comments and Bob is notified', async () => {
    const c = await request(app)
      .post(`/api/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ content: 'nice post' });
    expect(c.status).toBe(201);

    const n = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${bob.token}`);
    const comments = n.body.data.filter(
      (x: any) => x.type === 'post.comment' && x.targetId === postId,
    );
    expect(comments.length).toBe(1);
    expect(comments[0].actorId).toBe(alice.userId);
  });

  it('Bob acting on his own post does not notify himself', async () => {
    // Self-like
    const r = await request(app)
      .post(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(r.status).toBe(200);

    const n = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${bob.token}`);
    const selfLikes = n.body.data.filter(
      (x: any) => x.type === 'post.like' && x.actorId === bob.userId,
    );
    expect(selfLikes.length).toBe(0);
  });
});
