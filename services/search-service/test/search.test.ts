import request from 'supertest';
import { makeApp } from '../src/app';
import { SearchIndex } from '../src/routes';

function seed() {
  const idx = new SearchIndex();
  idx.index({
    kind: 'user',
    id: 'u1',
    handle: 'alice_01',
    displayName: 'Alice',
    bio: 'photographer in Mumbai',
    createdAt: new Date().toISOString()
  });
  idx.index({
    kind: 'user',
    id: 'u2',
    handle: 'bob_dev',
    displayName: 'Bob',
    createdAt: new Date().toISOString()
  });
  idx.index({
    kind: 'post',
    id: 'p1',
    authorId: 'u1',
    body: 'Sunset over the Arabian sea',
    createdAt: new Date().toISOString()
  });
  return idx;
}

describe('search-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x' });
    const r = await request(app).get('/health');
    expect(r.body.service).toBe('search');
  });

  it('finds users by substring', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x', index: seed() });
    const r = await request(app).get('/search?q=mumbai');
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(1);
    expect(r.body.items[0].handle).toBe('alice_01');
  });

  it('filters by type=post', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x', index: seed() });
    const r = await request(app).get('/search?q=sea&type=post');
    expect(r.body.items).toHaveLength(1);
    expect(r.body.items[0].kind).toBe('post');
  });

  it('rejects empty query', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x' });
    await request(app).get('/search?q=').expect(400);
  });
});
