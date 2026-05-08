/**
 * Hardening tests for /api/users.
 *
 * Pins three concrete fixes:
 *   1. Follow/unfollow are idempotent and tracked in a real edge set, so
 *      they no longer let any authenticated client spam notifications or
 *      inflate `followersCount` by repeating the call.
 *   2. PATCH /me URL-validates `avatar` and `website` (XSS/SSRF defense).
 *   3. PATCH /me caps `bio`, `displayName`, `location`.
 */
import express from 'express';
import request from 'supertest';
import authRouter from '../routes/auth';
import usersRouter from '../routes/users';
import notificationsRouter from '../routes/notifications';
import { errorHandler } from '../middleware/errorHandler';

const auth = (t: string) => 'Bearer ' + t;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use(errorHandler);
  return app;
}

async function newUser(app: express.Express, username: string) {
  const r = await request(app).post('/api/auth/register').send({
    username,
    displayName: username,
    email: username + '@example.com',
    password: 'Password123',
  });
  return { userId: r.body.data.user.id, token: r.body.data.accessToken };
}

describe('Users hardening', () => {
  describe('Follow idempotency', () => {
    const app = makeApp();
    let alice: { userId: string; token: string };
    let bob: { userId: string; token: string };

    beforeAll(async () => {
      alice = await newUser(app, 'aliceflw');
      bob = await newUser(app, 'bobflw');
    });

    it('first follow increments count and creates notification', async () => {
      const r = await request(app)
        .post('/api/users/' + bob.userId + '/follow')
        .set('Authorization', auth(alice.token));
      expect(r.status).toBe(200);
      expect(r.body.data.followersCount).toBe(1);

      const n = await request(app)
        .get('/api/notifications')
        .set('Authorization', auth(bob.token));
      const follows = n.body.data.filter((x: any) => x.type === 'user.follow');
      expect(follows.length).toBe(1);
    });

    it('repeated follow is a no-op (no count inflation, no notification spam)', async () => {
      for (let i = 0; i < 5; i++) {
        const r = await request(app)
          .post('/api/users/' + bob.userId + '/follow')
          .set('Authorization', auth(alice.token));
        expect(r.status).toBe(200);
        expect(r.body.data.alreadyFollowing).toBe(true);
        expect(r.body.data.followersCount).toBe(1);
      }
      const n = await request(app)
        .get('/api/notifications')
        .set('Authorization', auth(bob.token));
      const follows = n.body.data.filter((x: any) => x.type === 'user.follow');
      expect(follows.length).toBe(1); // still exactly one
    });

    it('unfollow only decrements when actually following', async () => {
      const r1 = await request(app)
        .delete('/api/users/' + bob.userId + '/follow')
        .set('Authorization', auth(alice.token));
      expect(r1.status).toBe(200);
      expect(r1.body.data.followersCount).toBe(0);

      // Repeated unfollow is now safe.
      const r2 = await request(app)
        .delete('/api/users/' + bob.userId + '/follow')
        .set('Authorization', auth(alice.token));
      expect(r2.status).toBe(200);
      expect(r2.body.data.wasFollowing).toBe(false);
      expect(r2.body.data.followersCount).toBe(0);

      // And a third user who never followed can't drive the counter negative.
      const carol = await newUser(app, 'carolflw');
      const r3 = await request(app)
        .delete('/api/users/' + bob.userId + '/follow')
        .set('Authorization', auth(carol.token));
      expect(r3.body.data.followersCount).toBe(0);
    });

    it('rejects self-follow', async () => {
      const r = await request(app)
        .post('/api/users/' + alice.userId + '/follow')
        .set('Authorization', auth(alice.token));
      expect(r.status).toBe(400);
    });
  });

  describe('PATCH /me input validation', () => {
    const app = makeApp();
    let me: { userId: string; token: string };

    beforeAll(async () => {
      me = await newUser(app, 'profileuser');
    });

    it('rejects javascript: avatar (XSS)', async () => {
      const r = await request(app)
        .patch('/api/users/me')
        .set('Authorization', auth(me.token))
        .send({ avatar: 'javascript:alert(1)' });
      expect(r.status).toBe(400);
    });

    it('rejects data: avatar', async () => {
      const r = await request(app)
        .patch('/api/users/me')
        .set('Authorization', auth(me.token))
        .send({ avatar: 'data:text/html,<script>alert(1)</script>' });
      expect(r.status).toBe(400);
    });

    it('rejects RFC1918 avatar host (SSRF)', async () => {
      const r = await request(app)
        .patch('/api/users/me')
        .set('Authorization', auth(me.token))
        .send({ avatar: 'http://10.0.0.1/me.png' });
      expect(r.status).toBe(400);
    });

    it('rejects javascript: website (XSS via profile link)', async () => {
      const r = await request(app)
        .patch('/api/users/me')
        .set('Authorization', auth(me.token))
        .send({ website: 'javascript:alert(1)' });
      expect(r.status).toBe(400);
    });

    it('accepts safe https avatar and website', async () => {
      const r = await request(app)
        .patch('/api/users/me')
        .set('Authorization', auth(me.token))
        .send({
          avatar: 'https://cdn.example.com/avatars/1.png',
          website: 'https://example.com',
        });
      expect(r.status).toBe(200);
      expect(r.body.data.avatar).toBe('https://cdn.example.com/avatars/1.png');
      expect(r.body.data.website).toBe('https://example.com');
    });

    it('rejects oversized bio', async () => {
      const r = await request(app)
        .patch('/api/users/me')
        .set('Authorization', auth(me.token))
        .send({ bio: 'x'.repeat(1_001) });
      expect(r.status).toBe(400);
    });

    it('rejects oversized displayName', async () => {
      const r = await request(app)
        .patch('/api/users/me')
        .set('Authorization', auth(me.token))
        .send({ displayName: 'x'.repeat(81) });
      expect(r.status).toBe(400);
    });

    it('rejects empty displayName', async () => {
      const r = await request(app)
        .patch('/api/users/me')
        .set('Authorization', auth(me.token))
        .send({ displayName: '   ' });
      expect(r.status).toBe(400);
    });

    it('rejects non-boolean isPrivate', async () => {
      const r = await request(app)
        .patch('/api/users/me')
        .set('Authorization', auth(me.token))
        .send({ isPrivate: 'yes-please' });
      expect(r.status).toBe(400);
    });

    it('rejects non-string bio', async () => {
      const r = await request(app)
        .patch('/api/users/me')
        .set('Authorization', auth(me.token))
        .send({ bio: { text: 'oh' } });
      expect(r.status).toBe(400);
    });

    it('partial-failure update does not half-apply', async () => {
      // Set a valid bio first.
      await request(app)
        .patch('/api/users/me')
        .set('Authorization', auth(me.token))
        .send({ bio: 'safe bio' });
      // Now send an update where avatar is bad — bio change must be rejected wholesale.
      const r = await request(app)
        .patch('/api/users/me')
        .set('Authorization', auth(me.token))
        .send({ bio: 'updated bio', avatar: 'javascript:alert(1)' });
      expect(r.status).toBe(400);
      // Re-fetch profile via a fresh PATCH that reads-back state.
      const verify = await request(app)
        .patch('/api/users/me')
        .set('Authorization', auth(me.token))
        .send({});
      expect(verify.body.data.bio).toBe('safe bio');
    });
  });
});
