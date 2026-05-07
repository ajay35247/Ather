import jwt from 'jsonwebtoken';
import request from 'supertest';
import { makeApp } from '../src/app';

const SECRET = 'test-access-secret-please-ignore-32';
function tok(sub: string, handle = sub) {
  return jwt.sign({ sub, handle, type: 'access' }, SECRET, {
    algorithm: 'HS256',
    issuer: 'ather.auth',
    expiresIn: 300
  });
}

function build() {
  return makeApp({ env: 'test', jwtSecret: SECRET });
}

describe('social-graph-service', () => {
  it('GET /health', async () => {
    const { app } = build();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('social-graph');
  });

  it('rejects unauthenticated follow', async () => {
    const { app } = build();
    await request(app).post('/social/follow').send({ userId: 'b' }).expect(401);
  });

  it('follow + followers + unfollow', async () => {
    const { app } = build();
    const t = tok('alice');
    const f = await request(app)
      .post('/social/follow')
      .set('authorization', `Bearer ${t}`)
      .send({ userId: 'bob' });
    expect(f.status).toBe(201);
    expect(f.body.follow.followerId).toBe('alice');

    const followers = await request(app).get('/social/followers/bob');
    expect(followers.status).toBe(200);
    expect(followers.body.items).toHaveLength(1);

    const u = await request(app)
      .post('/social/unfollow')
      .set('authorization', `Bearer ${t}`)
      .send({ userId: 'bob' });
    expect(u.status).toBe(200);
    expect(u.body.removed).toBe(true);
  });

  it('cannot follow self (409)', async () => {
    const { app } = build();
    const t = tok('alice');
    const r = await request(app)
      .post('/social/follow')
      .set('authorization', `Bearer ${t}`)
      .send({ userId: 'alice' });
    expect(r.status).toBe(409);
  });

  it('blocking removes existing follow and prevents new follow (403)', async () => {
    const { app } = build();
    const ta = tok('alice');
    const tb = tok('bob');

    await request(app)
      .post('/social/follow')
      .set('authorization', `Bearer ${tb}`)
      .send({ userId: 'alice' })
      .expect(201);

    await request(app)
      .post('/social/block')
      .set('authorization', `Bearer ${ta}`)
      .send({ userId: 'bob' })
      .expect(201);

    const fres = await request(app)
      .post('/social/follow')
      .set('authorization', `Bearer ${tb}`)
      .send({ userId: 'alice' });
    expect(fres.status).toBe(403);

    const followers = await request(app).get('/social/followers/alice');
    expect(followers.body.items).toHaveLength(0);
  });
});
