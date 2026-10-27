import { test } from 'node:test';
import assert from 'node:assert/strict';
import { C, SERVER } from './helpers.mjs';

test('random master, stable separate keys, recovery checksum and endpoint validation', async () => {
  const master = C.random(32), a = await C.derive(master), b = await C.derive(master);
  assert.equal(a.id, b.id); assert.equal(a.auth, b.auth); assert.notEqual(a.id, a.auth);
  const code = await C.recovery(SERVER, master);
  assert.deepEqual(await C.parseRecovery(code), { server: SERVER, master });
  await assert.rejects(C.parseRecovery(code.slice(0, -1) + (code.endsWith('a') ? 'b' : 'a')), /invalid-code/);
  for (const url of ['http://test.onrender.com', 'https://evil.test', 'https://test.onrender.com/path', 'https://u:p@test.onrender.com', 'https://test.onrender.com/?key=x']) assert.throws(() => C.endpoint(url));
});
test('AES-GCM round trip, fresh IVs, wrong keys, modified ciphertext and identity binding', async () => {
  const key = await C.derive(C.random(32)), doc = C.snapshot({ notes: { lesson: 'private note' }, user: 'private email', grades: [6] });
  const one = await C.encrypt(doc, key), two = await C.encrypt(doc, key);
  assert.notEqual(one.iv, two.iv); assert.equal(JSON.stringify(one).includes('private'), false);
  assert.deepEqual(await C.decrypt(one, key), doc);
  await assert.rejects(C.decrypt(one, await C.derive(C.random(32))), /cannot-decrypt/);
  await assert.rejects(C.decrypt(one, { ...key, id: C.random(32) }), /cannot-decrypt/);
  const bytes = C.unb64(one.data); bytes[0] ^= 1;
  await assert.rejects(C.decrypt({ ...one, data: C.b64(bytes) }, key), /cannot-decrypt/);
});
test('merge independent edits, deterministic equal timestamps, deletion and recoverable conflict', () => {
  const a = C.empty(), b = C.empty();
  a.notes.a = { at: 1, device: 'a', deleted: false, value: 'A' };
  b.notes.b = { at: 1, device: 'b', deleted: false, value: 'B' };
  b.notes.a = { at: 1, device: 'b', deleted: false, value: 'new A' };
  const merged = C.merge(a, b);
  assert.deepEqual(C.merge(b, a).doc, merged.doc); assert.equal(merged.doc.notes.a.value, 'new A'); assert.equal(merged.conflicts[0].value, 'A');
  b.notes.a = { at: 2, device: 'b', deleted: true };
  assert.equal(C.merge(a, b).doc.notes.a.deleted, true);
  assert.equal(C.merge(merged.doc, merged.doc).conflicts.length, 0);
});
test('migration uses baseline timestamps and explicit field allowlist', () => {
  const doc = C.snapshot({ notes: { a: 'legacy' }, examOverrides: { a: [] }, prefs: { targetGrade: 5, gradeStep: 0.5, theme: 'dark', notifyGrades: true }, zpRule: 'once3', abschluss: { id: 'abc', name: 'Job', ts: 123 }, user: 'email', grades: [6] });
  assert.equal(doc.notes.a.at, 0); assert.deepEqual(Object.keys(doc.settings).sort(), ['abschluss', 'gradeStep', 'targetGrade', 'zpRule']);
  const out = C.materialize(doc, { prefs: { theme: 'dark' } });
  assert.equal(out.prefs.theme, 'dark'); assert.equal(out.user, undefined);
  assert.deepEqual(out.examOverrides.a, []);
});
test('reject malformed, unknown, prototype, future and oversized records', () => {
  const malformed = C.empty(); malformed.settings.email = { at: 0, device: 'x', deleted: false, value: 'secret' };
  assert.throws(() => C.validate(malformed), /invalid-package/);
  malformed.settings.email = { at: 0, device: 'x', deleted: true };
  assert.throws(() => C.validate(malformed), /invalid-package/);
  const proto = JSON.parse('{"format":1,"notes":{"__proto__":{"at":0,"device":"a","deleted":false,"value":"x"}},"examOverrides":{},"settings":{}}');
  assert.throws(() => C.validate(proto), /invalid-package/);
  const future = C.snapshot({ notes: { a: 'x' } }); future.notes.a.at = Date.now() + 2 * 86400000;
  assert.throws(() => C.validate(future), /invalid-package/);
  assert.throws(() => C.validate(C.snapshot({ notes: Object.fromEntries(Array.from({ length: 6 }, (_, i) => [String(i), 'x'.repeat(50000)])) })), /package-too-large/);
});
test('object order is irrelevant, so devices do not repeatedly upload equivalent packages', () => {
  assert.equal(C.equal({ a: 1, b: { x: 2, y: 3 } }, { b: { y: 3, x: 2 }, a: 1 }), true);
  assert.equal(C.equal([1, 2], [2, 1]), false);
});
