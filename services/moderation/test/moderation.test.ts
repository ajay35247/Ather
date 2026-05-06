import request from 'supertest';
import { makeApp } from '../src/app';
import { classify } from '../src/routes';

describe('moderation-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x' });
    const r = await request(app).get('/health');
    expect(r.body.service).toBe('moderation');
  });

  it('classifier flags toxic text', () => {
    const r = classify('I hate this idiot');
    expect(r.label).toBe('toxic');
  });

  it('classifier returns safe by default', () => {
    const r = classify('what a lovely day in the park');
    expect(r.label).toBe('safe');
  });

  it('classify endpoint validates input', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x' });
    await request(app).post('/moderation/classify').send({ text: 'hello' }).expect(200);
    await request(app).post('/moderation/classify').send({}).expect(400);
  });

  it('report enqueues + queue lists pending', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x' });
    await request(app)
      .post('/moderation/report')
      .send({ targetKind: 'post', targetId: 'p1', reason: 'spam' })
      .expect(201);
    const q = await request(app).get('/moderation/queue');
    expect(q.body.items).toHaveLength(1);
    expect(q.body.items[0].status).toBe('pending');
  });
});
