import request from 'supertest';
import { makeApp } from '../src/app';

const INTERNAL = 'test-internal-secret';

describe('content-events-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x', internalSecret: INTERNAL });
    expect((await request(app).get('/health')).body.service).toBe('content-events');
  });

  it('publish requires internal secret (401)', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x', internalSecret: INTERNAL });
    await request(app)
      .post('/events/publish')
      .send({ topic: 'post.created', payload: { id: 'p1' } })
      .expect(401);
  });

  it('publish + consume round-trip', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x', internalSecret: INTERNAL });
    await request(app)
      .post('/events/publish')
      .set('x-internal-secret', INTERNAL)
      .send({ topic: 'post.created', payload: { id: 'p1' } })
      .expect(201);

    const r = await request(app).get('/events/topic/post.created');
    expect(r.body.items).toHaveLength(1);
    expect((r.body.items[0].payload as { id: string }).id).toBe('p1');
  });
});
