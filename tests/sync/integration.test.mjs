import { test } from 'node:test';
import assert from 'node:assert/strict';
import { C, Engine, SERVER, memory, FakeRepository } from './helpers.mjs';
import { DurableStore } from '../../sync-server/store.mjs';
import { createServer } from '../../sync-server/server.mjs';

async function setup(t) {
  const repo = new FakeRepository(), store = new DurableStore(repo, { debounceMs: 1, maxWaitMs: 5 });
  const server = createServer(store); server.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r));
  t.after(async () => { await store.close(); server.closeAllConnections(); await new Promise((r) => server.close(r)); });
  let requests = 0;
  const request = (url, init) => { requests++; return fetch('http://127.0.0.1:' + server.address().port + new URL(url).pathname, init); };
  const device = (initial) => {
    const storage = memory(initial); let permission = true;
    return { storage, engine: Engine.create({ storage, request, permission: async () => permission }), revoke: () => { permission = false; } };
  };
  return { repo, store, device, requests: () => requests, request };
}
test('opt-in, two devices, offline edits, per-field merge and school data excluded', async (t) => {
  const x = await setup(t), a = x.device({ notes: { old: 'existing' }, prefs: { theme: 'dark', targetGrade: 5 }, user: 'email', grades: [6] });
  await a.engine.write({ notes: { local: 'before consent' } }); await a.engine.sync(); assert.equal(x.requests(), 0);
  const { recovery } = await a.engine.connect({ server: SERVER }); await a.engine.sync();
  assert.equal(a.storage.data.deviceSync.status, 'synced');
  const b = x.device({ prefs: { theme: 'light' } }); await b.engine.connect({ code: recovery }); await b.engine.sync();
  assert.equal(b.storage.data.notes.old, 'existing'); assert.equal(b.storage.data.prefs.theme, 'light');
  await a.engine.write({ notes: { aa: 'edit A' }, prefs: { targetGrade: 5.5, theme: 'neon' } });
  await b.engine.write({ notes: { bb: 'edit B' }, prefs: { gradeStep: 0.1 } });
  await Promise.all([a.engine.sync(), b.engine.sync()]); await a.engine.sync(); await b.engine.sync();
  assert.deepEqual(a.storage.data.notes, b.storage.data.notes);
  assert.equal(a.storage.data.prefs.gradeStep, 0.1); assert.equal(b.storage.data.prefs.targetGrade, 5.5); assert.equal(b.storage.data.prefs.theme, 'light');
  const record = [...x.repo.records.values()][0], keys = await C.derive((await C.parseRecovery(recovery)).master);
  const decoded = await C.decrypt(record.blob, keys);
  assert.equal(JSON.stringify(decoded).includes('email'), false); assert.equal(JSON.stringify(record).includes('existing'), false);
});
test('note tombstones and exam reset survive a returning offline device', async (t) => {
  const x = await setup(t), a = x.device(); const { recovery } = await a.engine.connect({ server: SERVER });
  await a.engine.write({ notes: { lesson: 'delete me' }, examOverrides: { lesson: [] } }); await a.engine.sync();
  const b = x.device(); await b.engine.connect({ code: recovery }); await b.engine.sync();
  assert.deepEqual(b.storage.data.examOverrides.lesson, []);
  await a.engine.write({ notes: { lesson: null }, examOverrides: { lesson: null } }); await a.engine.sync(); await b.engine.sync();
  assert.equal(b.storage.data.notes.lesson, undefined); assert.equal(b.storage.data.examOverrides.lesson, undefined);
});
test('durable failures retain key and local changes; retry recovers after a server restart', async (t) => {
  const x = await setup(t), a = x.device(); const { recovery } = await a.engine.connect({ server: SERVER });
  await a.engine.sync(); x.repo.fail = true;
  await a.engine.write({ notes: { a: 'unsynced' } }); await a.engine.sync();
  assert.equal(a.storage.data.deviceSync.status, 'error'); assert.equal(a.storage.data.notes.a, 'unsynced');
  await assert.rejects(a.engine.disconnect({ erase: true })); assert.ok(a.storage.data.syncSecret);
  x.repo.fail = false;
  const restarted = Engine.create({ storage: a.storage, request: x.request }); await restarted.sync();
  assert.equal(a.storage.data.deviceSync.status, 'synced');
  const b = x.device(); await b.engine.connect({ code: recovery }); await b.engine.sync(); assert.equal(b.storage.data.notes.a, 'unsynced');
});
test('deletion is durable and offline clients do not recreate the account', async (t) => {
  const x = await setup(t), a = x.device(); const { recovery } = await a.engine.connect({ server: SERVER }); await a.engine.sync();
  const b = x.device(); await b.engine.connect({ code: recovery }); await b.engine.sync();
  await a.engine.disconnect({ erase: true }); assert.equal(x.repo.records.size, 0); assert.equal(a.storage.data.syncSecret, null);
  await b.engine.write({ notes: { old: 'still local' } }); await b.engine.sync();
  assert.equal(b.storage.data.deviceSync.error, 'account-gone'); assert.equal(b.storage.data.deviceSync.enabled, false); assert.equal(x.repo.records.size, 0);
});
test('permission revocation prevents network traffic and preserves notes', async (t) => {
  const x = await setup(t), a = x.device(); await a.engine.connect({ server: SERVER }); await a.engine.sync();
  a.revoke(); const before = x.requests(); await a.engine.write({ notes: { a: 'keep' } }); await a.engine.sync();
  assert.equal(x.requests(), before); assert.equal(a.storage.data.deviceSync.enabled, false); assert.equal(a.storage.data.notes.a, 'keep');
});
test('local edits during an upload remain pending and are sent on the next cycle', async (t) => {
  const x = await setup(t), storage = memory(); let engine, injected = false;
  engine = Engine.create({ storage, request: async (url, init) => {
    if (init.method === 'PUT' && !injected) { injected = true; await engine.write({ notes: { second: 'during upload' } }); }
    return x.request(url, init);
  } });
  await engine.connect({ server: SERVER }); await engine.sync(); await engine.write({ notes: { first: 'first' } }); await engine.sync();
  assert.equal(storage.data.deviceSync.status, 'pending'); await engine.sync(); assert.equal(storage.data.deviceSync.status, 'synced');
  const record = [...x.repo.records.values()][0], doc = await C.decrypt(record.blob, await C.derive(storage.data.syncSecret.master)); assert.equal(doc.notes.second.value, 'during upload');
});
test('damaged ciphertext never replaces local notes', async (t) => {
  const x = await setup(t), a = x.device({ notes: { keep: 'local copy' } });
  await a.engine.connect({ server: SERVER }); await a.engine.sync();
  const record = [...x.repo.records.values()][0], bytes = C.unb64(record.blob.data); bytes[0] ^= 1; record.blob.data = C.b64(bytes);
  await a.engine.sync(); assert.equal(a.storage.data.deviceSync.error, 'cannot-decrypt'); assert.equal(a.storage.data.notes.keep, 'local copy');
});
test('package size limits stop upload without stopping local note saves', async (t) => {
  const x = await setup(t), a = x.device(); await a.engine.connect({ server: SERVER }); await a.engine.sync();
  await a.engine.write({ notes: Object.fromEntries(Array.from({ length: 6 }, (_, i) => [String(i), 'x'.repeat(50000)])) });
  await a.engine.sync(); assert.equal(a.storage.data.deviceSync.error, 'package-too-large'); assert.equal(a.storage.data.notes['5'].length, 50000);
});
test('ambiguous creation followed by deletion cannot resurrect an account', async (t) => {
  const x = await setup(t), storage = memory({ notes: { keep: 'local' } }); let lose = true;
  const a = Engine.create({ storage, request: async (url, init) => {
    const r = await x.request(url, init);
    if (init.method === 'POST' && lose) { lose = false; throw new Error('connection lost after commit'); }
    return r;
  } });
  const { recovery } = await a.connect({ server: SERVER }); await a.sync(); assert.equal(x.repo.records.size, 1);
  const b = x.device(); await b.engine.connect({ code: recovery }); await b.engine.sync(); await b.engine.disconnect({ erase: true });
  await a.sync(); assert.equal(x.repo.records.size, 0); assert.equal(storage.data.deviceSync.error, 'account-gone'); assert.equal(storage.data.notes.keep, 'local');
});
test('apprenticeship sync invalidates the local module cache and schedules a rebuild', async (t) => {
  const x = await setup(t), a = x.device(); const { recovery } = await a.engine.connect({ server: SERVER });
  const degree = { id: '00000000-0000-4000-8000-000000000001', name: 'Synthetic apprenticeship' };
  await a.engine.write({ abschluss: degree, modules: { local: 'module cache' } }); await a.engine.sync();
  const storage = memory({ modules: { old: 'old cache' } }), rebuilds = [];
  const b = Engine.create({ storage, request: x.request, onApprenticeship: (v) => rebuilds.push(v) });
  await b.connect({ code: recovery }); await b.sync();
  assert.deepEqual(storage.data.abschluss, degree); assert.deepEqual(storage.data.modules, {}); assert.deepEqual(rebuilds, [degree]);
  const record = [...x.repo.records.values()][0], doc = await C.decrypt(record.blob, await C.derive(a.storage.data.syncSecret.master));
  assert.equal(JSON.stringify(doc).includes('module cache'), false);
});
test('large legacy notes stay local and creation can resume after reducing package size', async (t) => {
  const x = await setup(t), a = x.device({ notes: { large: 'x'.repeat(250000) } });
  await a.engine.connect({ server: SERVER }); await a.engine.sync();
  assert.equal(a.storage.data.deviceSync.error, 'package-too-large'); assert.equal(a.storage.data.notes.large.length, 250000); assert.equal(x.repo.records.size, 0);
  await a.engine.write({ notes: { large: 'smaller note' } }); await a.engine.sync();
  assert.equal(a.storage.data.deviceSync.status, 'synced'); assert.equal(x.repo.records.size, 1);
});
