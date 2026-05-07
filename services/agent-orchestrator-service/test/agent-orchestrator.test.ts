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

describe('agent-orchestrator-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    expect((await request(app).get('/health')).body.service).toBe('agent-orchestrator');
  });

  it('rejects disallowed tool (403)', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    await request(app)
      .post('/agent/plans')
      .set('authorization', `Bearer ${tok('alice')}`)
      .send({ goal: 'evil', allowedTools: ['exec.shell'] })
      .expect(403);
  });

  it('create + run + get owner-only', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: SECRET });
    const c = await request(app)
      .post('/agent/plans')
      .set('authorization', `Bearer ${tok('alice')}`)
      .send({ goal: 'hi', allowedTools: ['summarize.text'] })
      .expect(201);
    await request(app)
      .post(`/agent/plans/${c.body.plan.id}/run`)
      .set('authorization', `Bearer ${tok('alice')}`)
      .expect(200);
    await request(app)
      .get(`/agent/plans/${c.body.plan.id}`)
      .set('authorization', `Bearer ${tok('eve')}`)
      .expect(403);
  });
});
