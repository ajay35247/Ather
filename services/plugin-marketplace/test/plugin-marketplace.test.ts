import request from 'supertest';
import { makeApp } from '../src/app';

const INTERNAL = 'test-internal';

describe('plugin-marketplace-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x', internalSecret: INTERNAL });
    expect((await request(app).get('/health')).body.service).toBe('plugin-marketplace');
  });

  it('list + search + install', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x', internalSecret: INTERNAL });
    const r = await request(app)
      .post('/marketplace/list')
      .set('x-internal-secret', INTERNAL)
      .send({
        appId: 'app1',
        version: '1.0.0',
        description: 'pomodoro timer',
        publisherId: 'v1'
      })
      .expect(201);
    const s = await request(app).get('/marketplace/search?q=pomodoro');
    expect(s.body.items).toHaveLength(1);
    const i = await request(app).post(`/marketplace/${r.body.plugin.id}/install`).expect(200);
    expect(i.body.plugin.installs).toBe(1);
  });

  it('rejects bad version format', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x', internalSecret: INTERNAL });
    await request(app)
      .post('/marketplace/list')
      .set('x-internal-secret', INTERNAL)
      .send({ appId: 'a', version: 'one', description: 'd', publisherId: 'v' })
      .expect(400);
  });
});
