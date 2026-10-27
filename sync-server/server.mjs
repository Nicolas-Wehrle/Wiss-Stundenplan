import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { DurableStore, GitHubRepository, HttpError } from './store.mjs';

const LIMIT = 256 * 1024;
const idPattern = /^[A-Za-z0-9_-]{43}$/;
function validateBlob(blob) {
  if (!blob || Object.keys(blob).sort().join(',') !== 'data,format,iv' || blob.format !== 1 || !/^[A-Za-z0-9_-]{16}$/.test(blob.iv) || typeof blob.data !== 'string' || !/^[A-Za-z0-9_-]+$/.test(blob.data) || blob.data.length < 22) throw new HttpError(400, 'invalid-package');
}
async function body(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'json-required');
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > LIMIT) throw new HttpError(413, 'package-too-large'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'invalid-json'); }
}
export function createServer(store, { allowedOrigins = ['https://wiss.tocco.ch'], trustProxy = false, now = Date.now } = {}) {
  const buckets = new Map();
  function limit(key, max) {
    const time = now(); let b = buckets.get(key);
    if (!b || time - b.at >= 60000) { b = { at: time, n: 0 }; buckets.set(key, b); }
    if (++b.n > max) throw new HttpError(429, 'rate-limited');
    if (buckets.size > 10000) { for (const [k, v] of buckets) if (time - v.at > 60000) buckets.delete(k); }
    if (buckets.size > 20000) throw new HttpError(503, 'busy');
  }
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const allowed = !origin || allowedOrigins.includes(origin) || /^chrome-extension:\/\/[a-p]{32}$/.test(origin) || /^moz-extension:\/\/[a-f0-9-]{36}$/.test(origin);
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    if (origin && allowed) res.setHeader('Access-Control-Allow-Origin', origin);
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(data == null ? undefined : JSON.stringify(data)); };
    try {
      if (!allowed) throw new HttpError(403, 'origin-denied');
      const ip = trustProxy ? String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',').pop().trim() : req.socket.remoteAddress;
      limit('ip:' + ip, 120);
      if (req.url === '/health' && req.method === 'GET') return send(200, { ok: true });
      if (req.url === '/privacy' && req.method === 'GET') return send(200, { content: 'Optional encrypted sync. We store a random ID, authentication hash, encrypted package, size and activity times. Hosting providers process IP addresses. School data and encryption keys are not uploaded. Deletion removes the active file after durable storage confirms it. Encrypted history may remain in GitHub backups; monthly history compaction is not a guarantee of physical erasure. Accounts expire after about 12 months without sync.' });
      const match = /^\/v1\/accounts\/([A-Za-z0-9_-]{43})$/.exec(req.url || '');
      if (!match || !idPattern.test(match[1])) throw new HttpError(404, 'not-found');
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
        res.setHeader('Access-Control-Max-Age', '600'); return send(204);
      }
      const id = match[1], auth = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization || '');
      if (!auth) throw new HttpError(401, 'unauthorized');
      limit('id:' + id, 60); const token = auth[1];
      if (req.method === 'GET') return send(200, await store.read(id, token));
      if (req.method === 'DELETE') { await store.mutate({ kind: 'delete', id, token }, true); return send(204); }
      if (req.method === 'POST' || req.method === 'PUT') {
        if (req.method === 'POST') limit('create:' + ip, 5);
        const value = await body(req);
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'invalid-package');
        validateBlob(value.blob);
        if (Object.keys(value).some((k) => !['blob', ...(req.method === 'PUT' ? ['v'] : [])].includes(k))) throw new HttpError(400, 'invalid-package');
        if (req.method === 'PUT' && (!Number.isSafeInteger(value.v) || value.v < 1)) throw new HttpError(400, 'invalid-version');
        const result = await store.mutate({ kind: req.method === 'POST' ? 'create' : 'update', id, token, v: value.v, blob: value.blob });
        return send(req.method === 'POST' ? 201 : 200, result);
      }
      throw new HttpError(405, 'method-not-allowed');
    } catch (e) { if (!res.headersSent) { if (e.status === 429) res.setHeader('Retry-After', '60'); send(e.status || 503, { error: e.status ? e.message : 'unavailable' }); } else res.end(); }
  });
  server.requestTimeout = 130000; server.headersTimeout = 15000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repo = new GitHubRepository({ repo: process.env.SYNC_DATA_REPO, token: process.env.GITHUB_TOKEN, branch: process.env.SYNC_DATA_BRANCH || 'main' });
  const store = new DurableStore(repo);
  await store.init(); await store.cleanup();
  const server = createServer(store, { trustProxy: process.env.RENDER === 'true' });
  server.listen(Number(process.env.PORT || 10000), '0.0.0.0', () => console.log('Encrypted sync service ready'));
  const cleanup = setInterval(() => store.cleanup().catch(() => console.error('Expiration cleanup failed')), 6 * 3600000);
  let stopping = false;
  const stop = async () => {
    if (stopping) return; stopping = true; clearInterval(cleanup);
    server.close(); await store.close(); server.closeAllConnections();
  };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
