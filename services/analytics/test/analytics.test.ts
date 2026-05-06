import request from 'supertest';
import { makeApp } from '../src/app';

describe('analytics-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x' });
    expect((await request(app).get('/health')).body.service).toBe('analytics');
  });

  it('track + count', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x' });
    await request(app).post('/analytics/track').send({ name: 'post.viewed' }).expect(202);
    await request(app).post('/analytics/track').send({ name: 'post.viewed' }).expect(202);
    await request(app).post('/analytics/track').send({ name: 'reel.viewed' }).expect(202);
    const r = await request(app).get('/analytics/count?name=post.viewed');
    expect(r.body.count).toBe(2);
  });

  it('rejects invalid event name', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x' });
    await request(app).post('/analytics/track').send({ name: 'BAD NAME' }).expect(400);
  });
});
