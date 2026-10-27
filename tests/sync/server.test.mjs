import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeRepository, C } from './helpers.mjs';
import { DurableStore } from '../../sync-server/store.mjs';
import { createServer } from '../../sync-server/server.mjs';
const blob = { format: 1, iv: C.random(12), data: C.random(32) };
test('batched acknowledgements happen only after durable commit; stale versions rejected', async () => {
  const repo = new FakeRepository(), store = new DurableStore(repo, { debounceMs: 10000, maxWaitMs: 10000 });
  let ack = false; const id = C.random(32), token = C.random(32);
  const p = store.mutate({ kind: 'create', id, token, blob }).then(() => { ack = true; });
  await new Promise((r) => setTimeout(r, 5)); assert.equal(ack, false); assert.equal(repo.records.size, 0);
  await store.flush(); await p; assert.equal(ack, true);
  const update = store.mutate({ kind: 'update', id, token, v: 1, blob }); await store.flush(); assert.equal((await update).v, 2);
  const stale = assert.rejects(store.mutate({ kind: 'update', id, token, v: 1, blob }), (e) => e.status === 409); await store.flush(); await stale;
  await store.close();
});
test('concurrent server instances rebase instead of overwriting', async () => {
  const repo = new FakeRepository(), a = new DurableStore(repo, { debounceMs: 0 }), b = new DurableStore(repo, { debounceMs: 0 });
  const one = a.mutate({ kind: 'create', id: C.random(32), token: C.random(32), blob });
  const two = b.mutate({ kind: 'create', id: C.random(32), token: C.random(32), blob });
  await Promise.all([a.flush(), b.flush(), one, two]); assert.equal(repo.records.size, 2); await a.close(); await b.close();
});
test('account expiry, daily activity and immediate durable deletion', async () => {
  let time = 1000000000000;
  const repo = new FakeRepository(), store = new DurableStore(repo, { debounceMs: 0, now: () => time });
  const id = C.random(32), token = C.random(32);
  await store.mutate({ kind: 'create', id, token, blob }); time += 300 * 86400000;
  await store.read(id, token); const seen = repo.records.get(id).seen; assert.equal(seen, time);
  time += 366 * 86400000; await assert.rejects(store.read(id, token), (e) => e.status === 404);
  await store.cleanup(); assert.equal(repo.records.size, 0); await store.close();
});
test('HTTP authentication, CORS, malformed blobs, size and rate limits', async (t) => {
  const repo = new FakeRepository(), store = new DurableStore(repo, { debounceMs: 0 }), server = createServer(store);
  server.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r));
  t.after(async () => { await store.close(); server.closeAllConnections(); await new Promise((r) => server.close(r)); });
  const url = 'http://127.0.0.1:' + server.address().port + '/v1/accounts/' + C.random(32), token = C.random(32);
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { ...headers, Origin: 'https://evil.test' } })).status, 403);
  assert.equal((await fetch(url, { method: 'OPTIONS', headers: { Origin: 'https://wiss.tocco.ch' } })).headers.get('access-control-allow-origin'), 'https://wiss.tocco.ch');
  assert.equal((await fetch(url, { method: 'POST', headers, body: JSON.stringify({ blob: { ...blob, iv: 'bad' } }) })).status, 400);
  assert.equal((await fetch(url, { method: 'POST', headers, body: JSON.stringify({ blob }) })).status, 201);
  assert.equal((await fetch(url, { headers: { Authorization: 'Bearer ' + C.random(32) } })).status, 401);
  assert.equal((await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ v: 1, blob: { ...blob, data: 'a'.repeat(270000) } }) })).status, 413);
  let last; for (let i = 0; i < 65; i++) last = await fetch(url, { headers }); assert.equal(last.status, 429);
});
