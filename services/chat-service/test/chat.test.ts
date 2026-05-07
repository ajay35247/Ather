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

describe('chat-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const r = await request(app).get('/health');
    expect(r.body.service).toBe('chat');
  });

  it('create conversation, send + read messages', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const ta = tok('alice');
    const c = await request(app)
      .post('/chat/conversations')
      .set('authorization', `Bearer ${ta}`)
      .send({ kind: 'dm', memberIds: ['bob'] });
    expect(c.status).toBe(201);
    expect(c.body.conversation.memberIds.sort()).toEqual(['alice', 'bob']);
    const cid = c.body.conversation.id;

    const m = await request(app)
      .post(`/chat/conversations/${cid}/messages`)
      .set('authorization', `Bearer ${ta}`)
      .send({ ciphertext: 'AAAA' });
    expect(m.status).toBe(201);

    const list = await request(app)
      .get(`/chat/conversations/${cid}/messages`)
      .set('authorization', `Bearer ${tok('bob')}`);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].ciphertext).toBe('AAAA');
  });

  it('non-member cannot send (403)', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const c = await request(app)
      .post('/chat/conversations')
      .set('authorization', `Bearer ${tok('alice')}`)
      .send({ kind: 'dm', memberIds: ['bob'] })
      .expect(201);
    const r = await request(app)
      .post(`/chat/conversations/${c.body.conversation.id}/messages`)
      .set('authorization', `Bearer ${tok('eve')}`)
      .send({ ciphertext: 'BBBB' });
    expect(r.status).toBe(403);
  });

  it('rejects unknown conversation (404)', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    await request(app)
      .post('/chat/conversations/no-such/messages')
      .set('authorization', `Bearer ${tok('alice')}`)
      .send({ ciphertext: 'X' })
      .expect(404);
  });
});
