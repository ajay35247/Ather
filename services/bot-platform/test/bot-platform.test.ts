import request from 'supertest';
import { makeApp } from '../src/app';

const INTERNAL = 'test-internal';

describe('bot-platform-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x', internalSecret: INTERNAL });
    expect((await request(app).get('/health')).body.service).toBe('bot-platform');
  });

  it('rejects http webhook (must be https)', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x', internalSecret: INTERNAL });
    await request(app)
      .post('/bots/register')
      .set('x-internal-secret', INTERNAL)
      .send({ handle: 'bot1', ownerId: 'u1', webhook: 'http://example.com/hook' })
      .expect(400);
  });

  it('register + by-handle', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x', internalSecret: INTERNAL });
    await request(app)
      .post('/bots/register')
      .set('x-internal-secret', INTERNAL)
      .send({ handle: 'bot1', ownerId: 'u1', webhook: 'https://example.com/hook' })
      .expect(201);
    const r = await request(app).get('/bots/by-handle/bot1');
    expect(r.body.bot.handle).toBe('bot1');
  });
});
