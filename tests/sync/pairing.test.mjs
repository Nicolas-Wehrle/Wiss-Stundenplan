import { test } from 'node:test';
import assert from 'node:assert/strict';
import { C, Engine, SERVER, memory, FakeRepository } from './helpers.mjs';
import { DurableStore } from '../../sync-server/store.mjs';
import { createServer } from '../../sync-server/server.mjs';

async function setup(t) {
  const repo = new FakeRepository(), store = new DurableStore(repo, { debounceMs: 1, maxWaitMs: 5 });
  await store.init();
  const server = createServer(store); server.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r));
  t.after(async () => { await store.close(); server.closeAllConnections(); await new Promise((r) => server.close(r)); });
  const seen = [];
  const request = (url, init) => { seen.push({ path: new URL(url).pathname, body: init.body || '' }); return fetch('http://127.0.0.1:' + server.address().port + new URL(url).pathname, init); };
  const device = (initial) => { const storage = memory(initial); return { storage, engine: Engine.create({ storage, request, permission: async () => true }) }; };
  return { repo, device, seen };
}

test('short codes: format, normalisation of look-alike characters', () => {
  for (let i = 0; i < 200; i++) assert.match(C.pairCode(), /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  assert.equal(C.normalizePair('k7q2 9xmp'), 'K7Q29XMP');
  assert.equal(C.normalizePair('O1IL-0000'), '01110000');
  assert.throws(() => C.normalizePair('K7Q2-9XM'), /invalid-code/);
  assert.equal(C.isPairCode('WISS1.abc.def.ghi'), false);
});

test('link a second device with a short code; the code and key never reach the server', async (t) => {
  const x = await setup(t), a = x.device({ notes: { l1: 'from A' } });
  await a.engine.connect({ server: SERVER }); await a.engine.sync();
  const { pairCode } = await a.engine.pairOffer();
  const master = (await a.storage.get('syncSecret')).syncSecret.master;
  const b = x.device(); await b.engine.pairJoin({ server: SERVER, code: pairCode.toLowerCase().replace('-', ' ') });
  await b.engine.sync();
  assert.equal(b.storage.data.notes.l1, 'from A');
  assert.equal(b.storage.data.deviceSync.status, 'synced');
  const traffic = JSON.stringify(x.seen);
  assert.equal(traffic.includes(pairCode.replace('-', '')), false, 'code never sent');
  assert.equal(traffic.includes(master), false, 'master key never sent');
  // one-time: a third device can't reuse the code
  const c = x.device(); await assert.rejects(c.engine.pairJoin({ server: SERVER, code: pairCode }), /pair-expired/);
});

test('a wrong code fails without connecting', async (t) => {
  const x = await setup(t), a = x.device(); await a.engine.connect({ server: SERVER }); await a.engine.sync();
  await a.engine.pairOffer();
  const b = x.device(); await assert.rejects(b.engine.pairJoin({ server: SERVER, code: 'ZZZZ-ZZZZ' }), /pair-expired/);
  assert.equal(b.storage.data.deviceSync, undefined);
});
