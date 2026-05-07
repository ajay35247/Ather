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

describe('post-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const r = await request(app).get('/health');
    expect(r.body.service).toBe('post-service');
  });

  it('rejects unauthenticated create', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    await request(app).post('/posts').send({ type: 'text', body: 'hi' }).expect(401);
  });

  it('create + get + react + count', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const t = tok('alice');
    const c = await request(app)
      .post('/posts')
      .set('authorization', `Bearer ${t}`)
      .send({ type: 'text', body: 'hello world' });
    expect(c.status).toBe(201);
    const id = c.body.post.id;

    const g = await request(app).get(`/posts/${id}`);
    expect(g.status).toBe(200);
    expect(g.body.post.body).toBe('hello world');
    expect(g.body.reactions).toBe(0);

    const r = await request(app)
      .post(`/posts/${id}/reactions`)
      .set('authorization', `Bearer ${t}`)
      .send({ kind: 'like' });
    expect(r.status).toBe(201);

    const g2 = await request(app).get(`/posts/${id}`);
    expect(g2.body.reactions).toBe(1);
  });

  it('only author can delete (403 otherwise)', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const ta = tok('alice');
    const tb = tok('bob');
    const c = await request(app)
      .post('/posts')
      .set('authorization', `Bearer ${ta}`)
      .send({ type: 'text', body: 'mine' })
      .expect(201);
    const id = c.body.post.id;

    await request(app)
      .delete(`/posts/${id}`)
      .set('authorization', `Bearer ${tb}`)
      .expect(403);

    await request(app)
      .delete(`/posts/${id}`)
      .set('authorization', `Bearer ${ta}`)
      .expect(204);

    await request(app).get(`/posts/${id}`).expect(404);
  });

  it('rejects invalid reaction kind', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const t = tok('alice');
    const c = await request(app)
      .post('/posts')
      .set('authorization', `Bearer ${t}`)
      .send({ type: 'text', body: 'x' })
      .expect(201);
    const r = await request(app)
      .post(`/posts/${c.body.post.id}/reactions`)
      .set('authorization', `Bearer ${t}`)
      .send({ kind: 'BAD KIND' });
    expect(r.status).toBe(400);
  });
});
