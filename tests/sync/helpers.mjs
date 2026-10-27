import '../../chrome addon/sync-core.js';
import '../../chrome addon/sync-engine.js';
import { HttpError } from '../../sync-server/store.mjs';
export const C = globalThis.WissSyncCore, Engine = globalThis.WissSyncEngine;
export const SERVER = 'https://wiss-stundenplan-sync.onrender.com';
export function memory(initial = {}) {
  const data = structuredClone(initial);
  return { data, async get(keys) { return structuredClone(Object.fromEntries((keys == null ? Object.keys(data) : typeof keys === 'string' ? [keys] : keys).filter((k) => k in data).map((k) => [k, data[k]]))); }, async set(patch) { Object.assign(data, structuredClone(patch)); } };
}
export class FakeRepository {
  constructor() { this.records = new Map(); this.head = 0; this.fail = false; this.commits = 0; }
  async load() { return { head: this.head, records: structuredClone(this.records) }; }
  async commit(base, changes) {
    if (this.fail) throw new Error('simulated unavailable storage');
    if (base.head !== this.head) throw new HttpError(409, 'conflict');
    for (const [k, v] of changes) v == null ? this.records.delete(k) : this.records.set(k, structuredClone(v));
    this.head++; this.commits++; return this.head;
  }
}
