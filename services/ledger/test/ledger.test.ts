import request from 'supertest';
import { makeApp } from '../src/app';
import { Ledger, LedgerError } from '../src/routes';

const INTERNAL = 'test-internal-secret';

describe('ledger-service', () => {
  it('GET /health', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x', internalSecret: INTERNAL });
    expect((await request(app).get('/health')).body.service).toBe('ledger');
  });

  it('rejects unbalanced journal entries', () => {
    const l = new Ledger();
    const cash = l.openAccount({ code: 'cash', type: 'asset', currency: 'INR' });
    const rev = l.openAccount({ code: 'revenue', type: 'revenue', currency: 'INR' });
    expect(() =>
      l.post({
        description: 'bad',
        currency: 'INR',
        lines: [
          { accountId: cash.id, amount: 100 },
          { accountId: rev.id, amount: -50 } // not balanced!
        ]
      })
    ).toThrow(LedgerError);
  });

  it('rejects mixed currencies in one entry', () => {
    const l = new Ledger();
    const cashInr = l.openAccount({ code: 'cash.inr', type: 'asset', currency: 'INR' });
    const cashUsd = l.openAccount({ code: 'cash.usd', type: 'asset', currency: 'USD' });
    expect(() =>
      l.post({
        description: 'mixed',
        currency: 'INR',
        lines: [
          { accountId: cashInr.id, amount: 100 },
          { accountId: cashUsd.id, amount: -100 }
        ]
      })
    ).toThrow(LedgerError);
  });

  it('balanced entry posts and updates balances + global invariant', () => {
    const l = new Ledger();
    const cash = l.openAccount({ code: 'cash', type: 'asset', currency: 'INR' });
    const rev = l.openAccount({ code: 'revenue', type: 'revenue', currency: 'INR' });
    l.post({
      description: 'sale',
      currency: 'INR',
      lines: [
        { accountId: cash.id, amount: 100 },
        { accountId: rev.id, amount: -100 }
      ]
    });
    expect(l.balance(cash.id)).toBe(100);
    expect(l.balance(rev.id)).toBe(-100);
    expect(l.globalCheck()).toBe(true);
  });

  it('HTTP write endpoints require internal secret', async () => {
    const { app } = makeApp({ env: 'test', jwtSecret: 'x', internalSecret: INTERNAL });
    await request(app)
      .post('/ledger/accounts')
      .send({ code: 'cash', type: 'asset', currency: 'INR' })
      .expect(401);
    await request(app)
      .post('/ledger/accounts')
      .set('x-internal-secret', INTERNAL)
      .send({ code: 'cash', type: 'asset', currency: 'INR' })
      .expect(201);
  });

  it('HTTP balanced entry round-trip', async () => {
    const { app, ledger } = makeApp({ env: 'test', jwtSecret: 'x', internalSecret: INTERNAL });
    const cash = ledger.openAccount({ code: 'cash', type: 'asset', currency: 'INR' });
    const rev = ledger.openAccount({ code: 'rev', type: 'revenue', currency: 'INR' });
    await request(app)
      .post('/ledger/entries')
      .set('x-internal-secret', INTERNAL)
      .send({
        description: 'tip',
        currency: 'INR',
        lines: [
          { accountId: cash.id, amount: 500 },
          { accountId: rev.id, amount: -500 }
        ]
      })
      .expect(201);

    const bal = await request(app).get(`/ledger/accounts/cash/balance`);
    expect(bal.body.balance).toBe(500);
  });

  it('POST unbalanced entry returns 422', async () => {
    const { app, ledger } = makeApp({ env: 'test', jwtSecret: 'x', internalSecret: INTERNAL });
    const cash = ledger.openAccount({ code: 'cash', type: 'asset', currency: 'INR' });
    const rev = ledger.openAccount({ code: 'rev', type: 'revenue', currency: 'INR' });
    const r = await request(app)
      .post('/ledger/entries')
      .set('x-internal-secret', INTERNAL)
      .send({
        description: 'oops',
        currency: 'INR',
        lines: [
          { accountId: cash.id, amount: 100 },
          { accountId: rev.id, amount: -50 }
        ]
      });
    expect(r.status).toBe(422);
  });
});
