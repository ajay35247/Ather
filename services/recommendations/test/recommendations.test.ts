import jwt from 'jsonwebtoken';
import request from 'supertest';
import { makeApp } from '../src/app';
import { Recommender, cosine } from '../src/routes';

const SECRET = 'test-access-secret-please-ignore-32';
const tok = (sub: string) =>
  jwt.sign({ sub, handle: sub, type: 'access' }, SECRET, {
    algorithm: 'HS256',
    issuer: 'ather.auth',
    expiresIn: 300
  });

describe('recommendations-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    expect((await request(app).get('/health')).body.service).toBe('recommendations');
  });

  it('cosine works', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('retrieves top-k by similarity', async () => {
    const rec = new Recommender();
    rec.setUserVector('alice', [1, 0]);
    rec.index({ id: 'a', authorId: 'x', topicVec: [1, 0] });
    rec.index({ id: 'b', authorId: 'x', topicVec: [0, 1] });
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET, rec });
    const r = await request(app)
      .get('/recommendations/for-me')
      .set('authorization', `Bearer ${tok('alice')}`);
    expect(r.body.items[0].id).toBe('a');
  });
});
