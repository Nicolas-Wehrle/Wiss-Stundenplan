import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GitHubRepository } from '../../sync-server/store.mjs';
import { C } from './helpers.mjs';
const token = 'synthetic-token';
test('GitHub persistence reads selected blobs and never force-updates routine writes', async () => {
  const id = C.random(32), other = C.random(32), calls = [];
  const record = { v: 1, auth: 'a'.repeat(64), updated: 1, seen: 1, blob: {} };
  const request = async (url, init) => {
    const p = new URL(url).pathname.replace('/repos/test/data', ''), data = init.body && JSON.parse(init.body);
    calls.push({ p, method: init.method, data });
    assert.equal(init.headers.Authorization, 'Bearer ' + token);
    let value;
    if (p === '') value = { private: true };
    else if (p.startsWith('/git/ref/')) value = { object: { sha: 'head' } };
    else if (p === '/git/commits/head') value = { tree: { sha: 'tree' } };
    else if (p === '/git/trees/tree') value = { tree: [{ path: 'data/' + id + '.json', type: 'blob', sha: 'selected' }, { path: 'data/' + other + '.json', type: 'blob', sha: 'other' }] };
    else if (p === '/git/blobs/selected') value = { content: Buffer.from(JSON.stringify(record)).toString('base64') };
    else if (p === '/git/blobs' || p === '/git/trees' || p === '/git/commits') value = { sha: 'next' };
    else if (p.startsWith('/git/refs/')) { assert.equal(data.force, false); value = {}; }
    else throw new Error('Unexpected GitHub request: ' + p);
    return Response.json(value);
  };
  const repo = new GitHubRepository({ repo: 'test/data', token, request });
  await repo.verify(); const base = await repo.load(new Set([id]));
  assert.equal(base.accountCount, 2); assert.equal(base.records.size, 1); assert.equal(calls.some((x) => x.p.endsWith('/other')), false);
  await repo.commit(base, new Map([[id, { ...record, v: 2 }]]));
  assert.deepEqual(calls.find((x) => x.p === '/git/commits' && x.method === 'POST').data.parents, ['head']);
});
test('GitHub missing files become account 404s; public repositories and maintenance locks fail closed', async () => {
  const repo = new GitHubRepository({ repo: 'test/data', token, request: async () => Response.json({}, { status: 404 }) });
  assert.equal(await repo.read(C.random(32)), null);
  const publicRepo = new GitHubRepository({ repo: 'test/data', token, request: async () => Response.json({ private: false }) });
  await assert.rejects(publicRepo.verify(), /must be private/);
  const locked = new GitHubRepository({ repo: 'test/data', token, request: async (url) => {
    if (url.includes('/git/ref/')) return Response.json({ object: { sha: 'head' } });
    if (url.includes('/git/commits/')) return Response.json({ tree: { sha: 'tree' } });
    return Response.json({ tree: [{ path: '.sync-maintenance' }] });
  } });
  await assert.rejects(locked.load(), (e) => e.status === 503);
});
