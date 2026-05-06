import jwt from 'jsonwebtoken';
import request from 'supertest';
import { makeApp } from '../src/app';

const SECRET = 'test-access-secret-please-ignore-32';
const tok = (sub: string) =>
  jwt.sign({ sub, handle: sub, type: 'access' }, SECRET, {
    algorithm: 'HS256',
    issuer: 'ather.auth',
    expiresIn: 300
  });

describe('audio-rooms-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    expect((await request(app).get('/health')).body.service).toBe('audio-rooms');
  });

  it('create + join + close (host-only)', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const c = await request(app)
      .post('/audio-rooms')
      .set('authorization', `Bearer ${tok('alice')}`)
      .send({ topic: 'tech' })
      .expect(201);
    const id = c.body.room.id;
    await request(app)
      .post(`/audio-rooms/${id}/join`)
      .set('authorization', `Bearer ${tok('bob')}`)
      .expect(200);
    await request(app)
      .post(`/audio-rooms/${id}/close`)
      .set('authorization', `Bearer ${tok('eve')}`)
      .expect(403);
    await request(app)
      .post(`/audio-rooms/${id}/close`)
      .set('authorization', `Bearer ${tok('alice')}`)
      .expect(200);
  });
});
