import request from 'supertest';
import { makeApp } from '../src/app';

const INTERNAL = 'test-internal';

describe('mini-app-runtime-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x', internalSecret: INTERNAL });
    expect((await request(app).get('/health')).body.service).toBe('mini-app-runtime');
  });

  it('rejects unauthorized register', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x', internalSecret: INTERNAL });
    await request(app)
      .post('/mini-apps/register')
      .send({ slug: 'todo', name: 'Todo', vendorId: 'v1', capabilities: ['read:my-posts'] })
      .expect(401);
  });

  it('rejects unknown capability (403)', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x', internalSecret: INTERNAL });
    await request(app)
      .post('/mini-apps/register')
      .set('x-internal-secret', INTERNAL)
      .send({ slug: 'evil', name: 'Evil', vendorId: 'v1', capabilities: ['read:everything'] })
      .expect(403);
  });

  it('register + approve + list approved', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x', internalSecret: INTERNAL });
    const r = await request(app)
      .post('/mini-apps/register')
      .set('x-internal-secret', INTERNAL)
      .send({ slug: 'todo', name: 'Todo', vendorId: 'v1', capabilities: ['read:my-posts'] })
      .expect(201);
    await request(app)
      .post(`/mini-apps/approve/${r.body.app.id}`)
      .set('x-internal-secret', INTERNAL)
      .expect(200);
    const list = await request(app).get('/mini-apps/approved');
    expect(list.body.items).toHaveLength(1);
  });
});
