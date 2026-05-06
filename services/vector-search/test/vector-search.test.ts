import request from 'supertest';
import { makeApp } from '../src/app';

describe('vector-search-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x' });
    expect((await request(app).get('/health')).body.service).toBe('vector-search');
  });

  it('upsert + query', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x' });
    await request(app).post('/vectors/upsert').send({ id: 'a', vec: [1, 0, 0] }).expect(201);
    await request(app).post('/vectors/upsert').send({ id: 'b', vec: [0, 1, 0] }).expect(201);
    const r = await request(app).post('/vectors/query').send({ vec: [1, 0, 0], k: 2 });
    expect(r.body.items[0].id).toBe('a');
  });

  it('rejects dim mismatch', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x' });
    await request(app).post('/vectors/upsert').send({ id: 'a', vec: [1, 0, 0] }).expect(201);
    await request(app).post('/vectors/upsert').send({ id: 'b', vec: [1, 0] }).expect(400);
  });
});
