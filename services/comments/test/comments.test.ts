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

describe('comments-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    expect((await request(app).get('/health')).body.service).toBe('comments');
  });

  it('add + reply + list', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const t = tok('alice');
    const c1 = await request(app)
      .post('/comments')
      .set('authorization', `Bearer ${t}`)
      .send({ postId: 'p1', body: 'first!' });
    expect(c1.status).toBe(201);
    await request(app)
      .post('/comments')
      .set('authorization', `Bearer ${t}`)
      .send({ postId: 'p1', body: 'reply', parentId: c1.body.comment.id })
      .expect(201);

    const list = await request(app).get('/comments/by-post/p1');
    expect(list.body.items).toHaveLength(2);
  });

  it('only author can delete (403 otherwise)', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const c = await request(app)
      .post('/comments')
      .set('authorization', `Bearer ${tok('alice')}`)
      .send({ postId: 'p1', body: 'x' })
      .expect(201);
    await request(app)
      .delete(`/comments/${c.body.comment.id}`)
      .set('authorization', `Bearer ${tok('eve')}`)
      .expect(403);
  });
});
