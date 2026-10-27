// GitHub is authoritative. A request is acknowledged only after a successful non-force ref update.
// Replaying each transaction against the latest remote head also handles overlapping deployments.
import { createHash, timingSafeEqual } from 'node:crypto';

export class HttpError extends Error { constructor(status, code) { super(code); this.status = status; } }
export const hash = (s) => createHash('sha256').update(s).digest('hex');
export function authorized(record, token) {
  if (!record) throw new HttpError(404, 'not-found');
  const a = Buffer.from(record.auth, 'hex'), b = Buffer.from(hash(token), 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(401, 'unauthorized');
}

export class GitHubRepository {
  constructor({ repo, token, branch = 'main', request = fetch }) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !token || !/^[\w.-]+$/.test(branch)) throw new Error('Set SYNC_DATA_REPO, GITHUB_TOKEN and a simple SYNC_DATA_BRANCH.');
    this.base = 'https://api.github.com/repos/' + repo;
    this.token = token; this.branch = branch; this.request = request;
  }
  async api(path, method = 'GET', data) {
    const r = await this.request(this.base + path, { method, redirect: 'error', signal: AbortSignal.timeout(15000), headers: {
      Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + this.token,
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'WISS-Encrypted-Sync', ...(data ? { 'Content-Type': 'application/json' } : {})
    }, ...(data ? { body: JSON.stringify(data) } : {}) });
    if (!r.ok) { const e = new HttpError(r.status === 409 || r.status === 422 ? 409 : 503, 'storage-unavailable'); e.upstreamStatus = r.status; throw e; }
    return r.status === 204 ? null : r.json();
  }
  async read(id) {
    try {
      const r = await this.api('/contents/data/' + id + '.json?ref=' + this.branch);
      return JSON.parse(Buffer.from(r.content, 'base64').toString('utf8'));
    } catch (e) { if (e.upstreamStatus === 404) return null; throw e; }
  }
  async verify() {
    const repo = await this.api('');
    if (!repo.private) throw new Error('The sync data repository must be private.');
  }
  async load(ids) {
    const ref = await this.api('/git/ref/heads/' + this.branch);
    const commit = await this.api('/git/commits/' + ref.object.sha);
    const tree = await this.api('/git/trees/' + commit.tree.sha + '?recursive=1');
    if (tree.truncated) throw new HttpError(503, 'repository-too-large');
    if (tree.tree.some((e) => e.path === '.sync-maintenance')) throw new HttpError(503, 'maintenance');
    const records = new Map();
    // Resolve blobs only for account files; never interpret repository content as code.
    const accountFiles = tree.tree.filter((x) => /^data\/[A-Za-z0-9_-]{43}\.json$/.test(x.path) && x.type === 'blob');
    const entries = ids ? accountFiles.filter((x) => ids.has(x.path.slice(5, -5))) : accountFiles;
    // Small concurrency cap prevents one startup from exhausting GitHub's secondary limits.
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(4, entries.length) }, async () => {
      while (cursor < entries.length) {
        const entry = entries[cursor++], blob = await this.api('/git/blobs/' + entry.sha);
        const value = JSON.parse(Buffer.from(blob.content, 'base64').toString('utf8'));
        if (!Number.isSafeInteger(value.v) || value.v < 1 || !/^[a-f0-9]{64}$/.test(value.auth) || !Number.isFinite(value.seen)) throw new HttpError(503, 'invalid-repository');
        records.set(entry.path.slice(5, -5), value);
      }
    }));
    return { head: ref.object.sha, tree: commit.tree.sha, records, accountCount: accountFiles.length };
  }
  async commit(base, changes) {
    const tree = [];
    for (const [id, record] of changes) {
      const path = 'data/' + id + '.json';
      if (record === null) tree.push({ path, mode: '100644', type: 'blob', sha: null });
      else {
        const blob = await this.api('/git/blobs', 'POST', { content: JSON.stringify(record), encoding: 'utf-8' });
        tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
      }
    }
    const nextTree = await this.api('/git/trees', 'POST', { base_tree: base.tree, tree });
    const commit = await this.api('/git/commits', 'POST', { message: 'Persist encrypted sync changes', tree: nextTree.sha, parents: [base.head] });
    await this.api('/git/refs/heads/' + this.branch, 'PATCH', { sha: commit.sha, force: false });
    return commit.sha;
  }
}

export class DurableStore {
  constructor(repo, { debounceMs = 15000, maxWaitMs = 20000, now = Date.now, maxAccounts = 10000 } = {}) {
    this.repo = repo; this.debounceMs = debounceMs; this.maxWaitMs = maxWaitMs; this.now = now;
    this.maxAccounts = maxAccounts; this.pending = []; this.closed = false; this.worker = null;
    this.cache = null; this.cacheAt = 0;
  }
  async init() { await this.repo.verify?.(); await this.repo.load(new Set()); }
  async read(id, token) {
    // Never serve cached data as authoritative: a second deployment may have written or deleted it.
    const record = this.repo.read ? await this.repo.read(id) : (await this.repo.load()).records.get(id);
    authorized(record, token);
    if (this.expired(record)) throw new HttpError(404, 'not-found');
    // Activity only needs a daily durable touch; failed touches are retried next time.
    if (this.now() - record.seen > 86400000) await this.mutate({ kind: 'touch', id, token });
    return { v: record.v, updated: record.updated, blob: record.blob };
  }
  expired(r) { return this.now() - r.seen >= 365 * 86400000; }
  mutate(op, immediate = false) {
    if (this.closed) return Promise.reject(new HttpError(503, 'shutting-down'));
    const p = new Promise((resolve, reject) => this.pending.push({ op, resolve, reject }));
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), immediate ? 0 : this.debounceMs);
    if (!this.deadline) this.deadline = setTimeout(() => this.flush(), this.maxWaitMs);
    return p;
  }
  apply(base, batch) {
    const records = new Map(base.records), changes = new Map(), results = [];
    let accountCount = base.accountCount ?? records.size;
    for (const item of batch) {
      const { op } = item;
      try {
        const old = records.get(op.id);
        if (op.kind === 'create') {
          if (old) throw new HttpError(409, 'already-exists');
          if (accountCount >= this.maxAccounts) throw new HttpError(503, 'account-limit');
        } else {
          authorized(old, op.token);
          if (op.kind !== 'delete' && this.expired(old)) throw new HttpError(404, 'not-found');
          if (op.kind === 'update' && op.v !== old.v) throw new HttpError(409, 'version-conflict');
        }
        let next;
        if (op.kind === 'delete') { next = null; records.delete(op.id); accountCount--; }
        else {
          next = op.kind === 'touch' ? { ...old, seen: this.now() } : {
            v: op.kind === 'create' ? 1 : old.v + 1, auth: op.kind === 'create' ? hash(op.token) : old.auth,
            updated: this.now(), seen: this.now(), blob: op.blob
          };
          records.set(op.id, next);
          if (op.kind === 'create') accountCount++;
        }
        changes.set(op.id, next);
        results.push({ item, value: next ? { v: next.v, updated: next.updated, blob: next.blob } : null });
      } catch (error) { results.push({ item, error }); }
    }
    // Expiration is based on the latest head and committed with other work.
    for (const [id, r] of records) if (this.expired(r)) { changes.set(id, null); records.delete(id); }
    return { changes, results, records };
  }
  async flush() {
    clearTimeout(this.timer); clearTimeout(this.deadline); this.timer = this.deadline = null;
    if (this.worker) { await this.worker; if (this.pending.length) return this.flush(); return; }
    if (!this.pending.length) return;
    const batch = this.pending.splice(0);
    this.worker = (async () => {
      try {
        for (let attempt = 0; attempt < 5; attempt++) {
          const base = await this.repo.load(new Set(batch.map((x) => x.op.id))), outcome = this.apply(base, batch);
          try { if (outcome.changes.size) await this.repo.commit(base, outcome.changes); }
          catch (e) { if (e.status === 409) continue; throw e; }
          for (const { item, error, value } of outcome.results) error ? item.reject(error) : item.resolve(value);
          return;
        }
        throw new HttpError(503, 'storage-busy');
      } catch (e) { for (const item of batch) item.reject(new HttpError(e.status === 409 ? 503 : e.status || 503, 'storage-unavailable')); }
    })();
    try { await this.worker; } finally { this.worker = null; }
    if (this.pending.length && this.closed) return this.flush();
  }
  async cleanup() {
    // Empty batches still need an explicit expiration transaction.
    for (let attempt = 0; attempt < 5; attempt++) {
      const base = await this.repo.load(), changes = new Map([...base.records].filter(([, r]) => this.expired(r)).map(([id]) => [id, null]));
      if (!changes.size) return;
      try { await this.repo.commit(base, changes); return; } catch (e) { if (e.status !== 409) throw e; }
    }
    throw new HttpError(503, 'storage-busy');
  }
  async close() { this.closed = true; await this.flush(); }
}
