import request from 'supertest';
import { makeApp } from '../src/app';

describe('translation-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x' });
    expect((await request(app).get('/health')).body.service).toBe('translation');
  });

  it('translates text', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x' });
    const r = await request(app)
      .post('/translation/translate')
      .send({ text: 'hello', targetLang: 'fr' });
    expect(r.body.text).toBe('[fr] hello');
  });

  it('rejects bad lang code', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x' });
    await request(app)
      .post('/translation/translate')
      .send({ text: 'hi', targetLang: 'francais' })
      .expect(400);
  });
});
