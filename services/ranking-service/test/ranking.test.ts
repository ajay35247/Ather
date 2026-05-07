import request from 'supertest';
import { makeApp } from '../src/app';
import { rank } from '../src/routes';

describe('ranking-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x' });
    expect((await request(app).get('/health')).body.service).toBe('ranking');
  });

  it('rank() sorts by score desc', () => {
    const r = rank([
      { id: 'a', features: { likes: 1 } },
      { id: 'b', features: { likes: 1000 } },
      { id: 'c', features: { likes: 100 } }
    ]);
    expect(r.map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('POST /ranking/score validates input', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x' });
    await request(app)
      .post('/ranking/score')
      .send({ candidates: [{ id: 'a', features: {} }] })
      .expect(200);
    await request(app).post('/ranking/score').send({}).expect(400);
  });
});
