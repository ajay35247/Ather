import request from 'supertest';
import { makeApp } from '../src/app';

describe('knowledge-graph-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x' });
    expect((await request(app).get('/health')).body.service).toBe('knowledge-graph');
  });

  it('upsert + link + neighbors', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x' });
    const a = await request(app)
      .post('/kg/entities')
      .send({ type: 'person', name: 'Alice' })
      .expect(201);
    const b = await request(app)
      .post('/kg/entities')
      .send({ type: 'person', name: 'Bob' })
      .expect(201);
    await request(app)
      .post('/kg/edges')
      .send({ fromId: a.body.entity.id, toId: b.body.entity.id, rel: 'follows' })
      .expect(201);
    const n = await request(app).get(`/kg/entities/${a.body.entity.id}/neighbors`);
    expect(n.body.items).toHaveLength(1);
    expect(n.body.items[0].entity.name).toBe('Bob');
  });
});
