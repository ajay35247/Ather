/**
 * Hardening tests for /api/messages.
 *
 * Pins:
 *   - participantId validation on conversation create (required, ≠ self,
 *     must reference an existing user).
 *   - group participantIds validation (non-empty, deduped, no unknown ids,
 *     bounded length).
 *   - message content length cap.
 */
import express from 'express';
import request from 'supertest';
import authRouter from '../routes/auth';
import messagesRouter from '../routes/messages';
import { errorHandler } from '../middleware/errorHandler';

const auth = (t: string) => 'Bearer ' + t;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/messages', messagesRouter);
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

describe('Messages hardening', () => {
  const app = makeApp();
  let alice: { userId: string; token: string };
  let bob: { userId: string; token: string };
  let carol: { userId: string; token: string };

  beforeAll(async () => {
    alice = await newUser(app, 'msgalice');
    bob = await newUser(app, 'msgbob');
    carol = await newUser(app, 'msgcarol');
  });

  it('rejects direct conversation without participantId', async () => {
    const r = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', auth(alice.token))
      .send({});
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/participantId/i);
  });

  it('rejects direct conversation with self', async () => {
    const r = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', auth(alice.token))
      .send({ participantId: alice.userId });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/yourself/i);
  });

  it('rejects direct conversation with unknown participant', async () => {
    const r = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', auth(alice.token))
      .send({ participantId: 'phantom-user-id' });
    expect(r.status).toBe(404);
  });

  it('rejects unknown conversation type', async () => {
    const r = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', auth(alice.token))
      .send({ type: 'broadcast', participantId: bob.userId });
    expect(r.status).toBe(400);
  });

  it('creates a valid direct conversation', async () => {
    const r = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', auth(alice.token))
      .send({ participantId: bob.userId });
    expect(r.status).toBe(201);
    expect(r.body.data.participantIds).toEqual(
      expect.arrayContaining([alice.userId, bob.userId]),
    );
  });

  it('rejects group with empty participantIds', async () => {
    const r = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', auth(alice.token))
      .send({ type: 'group', participantIds: [] });
    expect(r.status).toBe(400);
  });

  it('rejects group with unknown participant', async () => {
    const r = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', auth(alice.token))
      .send({ type: 'group', name: 'team', participantIds: ['nope'] });
    expect(r.status).toBe(404);
  });

  it('rejects group exceeding 100 participants', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => 'id' + i);
    const r = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', auth(alice.token))
      .send({ type: 'group', name: 'huge', participantIds: ids });
    expect(r.status).toBe(400);
  });

  it('creates a valid group conversation, deduping the creator', async () => {
    const r = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', auth(alice.token))
      .send({
        type: 'group',
        name: 'tg',
        participantIds: [alice.userId, bob.userId, carol.userId, bob.userId],
      });
    expect(r.status).toBe(201);
    // alice (creator) + bob + carol; bob deduped, alice from list silently dropped.
    expect(r.body.data.participantIds.sort()).toEqual(
      [alice.userId, bob.userId, carol.userId].sort(),
    );
  });

  it('rejects oversized group name', async () => {
    const r = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', auth(alice.token))
      .send({
        type: 'group',
        name: 'x'.repeat(121),
        participantIds: [bob.userId],
      });
    expect(r.status).toBe(400);
  });

  it('caps message content length', async () => {
    const conv = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', auth(alice.token))
      .send({ participantId: bob.userId });
    const convId = conv.body.data.id;

    const r = await request(app)
      .post('/api/messages/conversations/' + convId + '/messages')
      .set('Authorization', auth(alice.token))
      .send({ content: 'x'.repeat(8_001) });
    expect(r.status).toBe(400);
  });

  it('rejects non-string message content', async () => {
    const conv = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', auth(alice.token))
      .send({ participantId: bob.userId });
    const convId = conv.body.data.id;

    const r = await request(app)
      .post('/api/messages/conversations/' + convId + '/messages')
      .set('Authorization', auth(alice.token))
      .send({ content: { html: '<script>' } });
    expect(r.status).toBe(400);
  });
});
