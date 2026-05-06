import express from 'express';
import request from 'supertest';
import authRouter from '../routes/auth';
import postsRouter from '../routes/posts';
import { errorHandler } from '../middleware/errorHandler';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/posts', postsRouter);
app.use(errorHandler);

describe('Posts Routes', () => {
  let accessToken: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'postauthor',
      displayName: 'Post Author',
      email: 'author@example.com',
      password: 'Password123',
    });
    accessToken = res.body.data.accessToken;
  });

  let postId: string;

  it('POST /api/posts - creates a post', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'Hello Ather!', type: 'text', visibility: 'public' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.content).toBe('Hello Ather!');
    postId = res.body.data.id;
  });

  it('GET /api/posts - lists posts', async () => {
    const res = await request(app).get('/api/posts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/posts/:id - gets a post by id', async () => {
    const res = await request(app).get(`/api/posts/${postId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(postId);
  });

  it('POST /api/posts/:id/like - likes a post', async () => {
    const res = await request(app)
      .post(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.likesCount).toBe(1);
  });

  it('POST /api/posts/:id/comments - adds a comment', async () => {
    const res = await request(app)
      .post(`/api/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'Great post!' });
    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe('Great post!');
  });

  it('DELETE /api/posts/:id - deletes own post', async () => {
    const res = await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/posts/:id - returns 404 for deleted post', async () => {
    const res = await request(app).get(`/api/posts/${postId}`);
    expect(res.status).toBe(404);
  });
});
