import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeRepository, C } from './helpers.mjs';
import { DurableStore, GitHubRepository } from '../../sync-server/store.mjs';
import { createServer } from '../../sync-server/server.mjs';
const blob = { format: 1, iv: C.random(12), data: C.random(32) };

class CountingRepository extends FakeRepository {
  constructor() { super(); this.loads = 0; }
  async load(ids) { this.loads++; return super.load(ids); }
}
async function serve(store, opts) {
  const server = createServer(store, opts); server.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r));
  return { base: 'http://127.0.0.1:' + server.address().port, close: async () => { await store.close(); server.closeAllConnections(); await new Promise((r) => server.close(r)); } };
}

test('unknown IDs and wrong tokens are rejected from memory, without storage requests', async (t) => {
  const repo = new CountingRepository(), store = new DurableStore(repo, { debounceMs: 0 });
  await store.init();
  const id = C.random(32), token = C.random(32);
  await store.mutate({ kind: 'create', id, token, blob }); await store.read(id, token);
  const s = await serve(store); t.after(s.close);
  const before = repo.loads;
  for (let i = 0; i < 30; i++) {
    const r = await fetch(s.base + '/v1/accounts/' + C.random(32), { headers: { Authorization: 'Bearer ' + C.random(32) } });
    assert.equal(r.status, 404);
  }
  for (let i = 0; i < 10; i++) {
    const r = await fetch(s.base + '/v1/accounts/' + id, { headers: { Authorization: 'Bearer ' + C.random(32) } });
    assert.equal(r.status, 401);
  }
  const put = await fetch(s.base + '/v1/accounts/' + id, { method: 'PUT', headers: { Authorization: 'Bearer ' + C.random(32), 'Content-Type': 'application/json' }, body: JSON.stringify({ v: 1, blob }) });
  assert.equal(put.status, 401);
  assert.equal(repo.loads, before, 'no storage requests for bad credentials');
  const ok = await fetch(s.base + '/v1/accounts/' + id, { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(ok.status, 200);
});

test('an account created by another server instance is found after a bounded index refresh', async () => {
  let time = 1e12;
  const repo = new CountingRepository(), a = new DurableStore(repo, { debounceMs: 0, now: () => time }), b = new DurableStore(repo, { debounceMs: 0, now: () => time });
  await a.init(); await b.init();
  const id = C.random(32), token = C.random(32);
  await b.mutate({ kind: 'create', id, token, blob });
  await assert.rejects(a.read(id, token), (e) => e.status === 404);   // just refreshed at init: no re-list yet
  time += 61000;
  assert.equal((await a.read(id, token)).v, 1);
  await a.close(); await b.close();
});

test('GitHub request budget fails closed before the token limit is reached', async () => {
  const repo = new GitHubRepository({ repo: 'test/data', token: 'x', budgetPerHour: 3, request: async () => Response.json({ private: true }) });
  for (let i = 0; i < 3; i++) await repo.verify();
  await assert.rejects(repo.verify(), (e) => e.status === 503);
});

test('account creation is limited for everyone together, not only per IP', async (t) => {
  const store = new DurableStore(new FakeRepository(), { debounceMs: 0 }), s = await serve(store); t.after(s.close);
  let last;
  for (let i = 0; i < 25; i++) {
    // different X-Forwarded-For per request would bypass a per-IP limit if the proxy were trusted
    last = await fetch(s.base + '/v1/accounts/' + C.random(32), { method: 'POST', headers: { Authorization: 'Bearer ' + C.random(32), 'Content-Type': 'application/json' }, body: JSON.stringify({ blob }) });
  }
  assert.equal(last.status, 429);
});

test('pairing: only a connected device can offer, pickup works once, packages expire', async (t) => {
  let time = 1e12;
  const store = new DurableStore(new FakeRepository(), { debounceMs: 0, now: () => time });
  await store.init();
  const id = C.random(32), token = C.random(32);
  await store.mutate({ kind: 'create', id, token, blob });
  const s = await serve(store, { now: () => time }); t.after(s.close);
  const pair = C.random(32), offer = (tok, p = pair) => fetch(s.base + '/v1/accounts/' + id + '/pairing', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ pair: p, blob }) });
  assert.equal((await offer(C.random(32))).status, 401);
  assert.equal((await offer(token)).status, 201);
  const first = await fetch(s.base + '/v1/pairing/' + pair);
  assert.equal(first.status, 200); assert.deepEqual((await first.json()).blob, blob);
  assert.equal((await fetch(s.base + '/v1/pairing/' + pair)).status, 404, 'one-time pickup');
  const late = C.random(32); assert.equal((await offer(token, late)).status, 201);
  time += 10 * 60000 + 1;
  assert.equal((await fetch(s.base + '/v1/pairing/' + late)).status, 404, 'expired');
  for (let i = 0; i < 3; i++) assert.equal((await offer(token, C.random(32))).status, 201);
  assert.equal((await offer(token, C.random(32))).status, 429, 'max 3 open offers per account');
});
