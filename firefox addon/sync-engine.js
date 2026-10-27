// One coordinator per extension background / mobile app page. Local writes never wait for network.
(() => {
  'use strict';
  const C = globalThis.WissSyncCore;
  function create({ storage, request = (...args) => fetch(...args), vault, permission = async () => true, schedule = () => {}, onApprenticeship = () => {}, clock = Date.now }) {
    vault ||= { get: async () => (await storage.get('syncSecret')).syncSecret, set: (v) => storage.set({ syncSecret: v }) };
    let queue = Promise.resolve(), running = null, generation = 0, cancel = null;
    const serial = (fn) => { const p = queue.then(fn); queue = p.catch(() => {}); return p; };
    const state = () => storage.get(['notes', 'examOverrides', 'prefs', 'zpRule', 'abschluss', 'deviceSync', 'syncMeta', 'syncConflicts']);
    async function metadata(s) {
      if (s.syncMeta) { C.validate(s.syncMeta.doc, false); return s.syncMeta; }
      return { device: C.random(12), revision: 0, clock: 0, doc: C.snapshot(s) };
    }
    const info = async (patch) => { const s = await state(); await storage.set({ deviceSync: { ...(s.deviceSync || {}), ...patch } }); };
    function stamp(meta, group, key, value) {
      const deleted = value === null || value === undefined;
      if (!C.safeKey(key) || (!deleted && !C.validValue(group, key, value))) throw new Error('invalid-package');
      const prev = meta.doc[group][key];
      if (prev && prev.deleted === deleted && (deleted || C.equal(prev.value, value))) return false;
      meta.clock = Math.max(clock(), (meta.clock || 0) + 1);
      meta.doc[group][key] = { at: meta.clock, device: meta.device, deleted, ...(deleted ? {} : { value: structuredClone(value) }) };
      meta.revision++; return true;
    }
    async function write(patch) {
      return serial(async () => {
        const s = await state(), meta = await metadata(s), out = {}, prev = meta.revision;
        // Map patches are individual keys; null explicitly deletes a key.
        for (const g of ['notes', 'examOverrides']) if (patch[g]) {
          out[g] = { ...(s[g] || {}) };
          for (const [k, v] of Object.entries(patch[g])) {
            stamp(meta, g, k, v); if (v == null) delete out[g][k]; else out[g][k] = v;
          }
        }
        if (patch.prefs) {
          out.prefs = { ...(s.prefs || {}), ...patch.prefs };
          for (const k of C.PREFS) if (Object.hasOwn(patch.prefs, k)) stamp(meta, 'settings', k, patch.prefs[k]);
        }
        for (const k of ['zpRule', 'abschluss']) if (Object.hasOwn(patch, k)) {
          const v = k === 'abschluss' && patch[k] ? { id: patch[k].id, name: patch[k].name } : patch[k];
          stamp(meta, 'settings', k, v); out[k] = patch[k];
        }
        // Other local-only UI fields are deliberately outside the encrypted document.
        for (const k of ['uiTab', 'roomCache', 'modules', 'setupDone']) if (Object.hasOwn(patch, k)) out[k] = patch[k];
        C.validate(meta.doc, false); out.syncMeta = meta;
        if (meta.revision !== prev && s.deviceSync?.enabled) out.deviceSync = { ...s.deviceSync, status: 'pending', error: null };
        await storage.set(out);
        if (meta.revision !== prev && s.deviceSync?.enabled) schedule(2000);
      });
    }
    async function api(config, keys, method, body, signal) {
      if (!await permission(config.server)) throw new Error('permission-denied');
      // MV3 workers may be terminated if a fetch response takes 30 seconds. Abort first,
      // persist pending state, and let the next GET recover any ambiguous durable write.
      const controller = new AbortController(), abort = () => controller.abort();
      if (signal?.aborted) controller.abort();
      signal?.addEventListener('abort', abort, { once: true });
      const deadline = setTimeout(abort, 24000);
      try {
      const r = await request(config.server + '/v1/accounts/' + keys.id, {
        method, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal,
        headers: { Authorization: 'Bearer ' + keys.auth, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      if (!r.ok) { const e = new Error(r.status === 404 ? 'account-gone' : r.status === 401 ? 'authentication-failed' : r.status === 413 ? 'package-too-large' : r.status === 429 ? 'rate-limited' : r.status === 409 ? 'version-conflict' : 'server-unavailable'); e.status = r.status; throw e; }
      if (r.status === 204) return null;
      const text = await r.text(); if (text.length > C.MAX_BYTES * 2) throw new Error('package-too-large');
      try { return JSON.parse(text); } catch { throw new Error('server-unavailable'); }
      } finally { clearTimeout(deadline); signal?.removeEventListener('abort', abort); }
    }
    async function connect({ server, code }) {
      if (running) throw new Error('busy');
      const existing = await state(); if (existing.deviceSync?.status && existing.deviceSync.status !== 'off') throw new Error('already-connected');
      if (await vault.get()) throw new Error('already-connected');
      const creds = code ? await C.parseRecovery(code) : { server: C.endpoint(server), master: C.random(32) };
      if (!await permission(creds.server)) throw new Error('permission-denied');
      // Persist credentials and intent before networking: a timeout must not lose the only key.
      await vault.set(creds);
      await serial(async () => {
        const s = await state(); await storage.set({ syncMeta: await metadata(s), deviceSync: { server: creds.server, enabled: true, creating: !code, status: 'pending', lastSuccess: null } });
      });
      const recovery = code ? null : await C.recovery(creds.server, creds.master);
      // UI receives the recovery code before the slow network round trip starts.
      schedule(0); return { recovery };
    }
    async function applyRemote(remote, expectedGeneration) {
      return serial(async () => {
        if (generation !== expectedGeneration) throw new Error('cancelled');
        const s = await state(), meta = await metadata(s), merged = C.merge(meta.doc, remote);
        meta.doc = merged.doc;
        // Clock follows observed edits, including tombstones.
        for (const g of C.GROUPS) for (const r of Object.values(meta.doc[g])) meta.clock = Math.max(meta.clock || 0, r.at);
        const conflicts = [...(s.syncConflicts || [])];
        for (const c of merged.conflicts) if (!conflicts.some((x) => C.equal(x, c))) conflicts.push(c);
        const out = C.materialize(meta.doc, s);
        const degreeChanged = out.abschluss && out.abschluss.id !== s.abschluss?.id;
        if (degreeChanged) out.modules = {};
        await storage.set({ ...out, syncMeta: meta, syncConflicts: conflicts.slice(-50) });
        if (degreeChanged) Promise.resolve(onApprenticeship(out.abschluss)).catch(() => {});
        return { doc: structuredClone(meta.doc), revision: meta.revision };
      });
    }
    async function cycle() {
      const gen = generation, s = await state(), config = s.deviceSync;
      if (!config?.enabled) return;
      const creds = await vault.get(); if (!creds || creds.server !== config.server) throw new Error('missing-key');
      const keys = await C.derive(creds.master);
      cancel = new AbortController(); const timeout = setTimeout(() => cancel?.abort(), 120000);
      try {
        await info({ status: 'syncing', error: null });
        for (let attempt = 0; attempt < 5; attempt++) {
          if (gen !== generation) return;
          let remote;
          try { remote = await api(config, keys, 'GET', null, cancel.signal); }
          catch (e) {
            if (e.status !== 404 || !config.creating) throw e;
            const local = await serial(async () => { const s = await state(); return structuredClone((await metadata(s)).doc); });
            const blob = await C.encrypt(local, keys);
            // Creation is attempted once. After an ambiguous timeout, GET may recover it,
            // but a later 404 must never silently resurrect a deleted account.
            config.creating = false;
            await serial(() => info({ creating: false }));
            try { remote = await api(config, keys, 'POST', { blob }, cancel.signal); }
            catch (createError) { if (createError.status === 409) continue; throw createError; }
          }
          if (!Number.isSafeInteger(remote.v) || remote.v < 1) throw new Error('invalid-package');
          const decoded = await C.decrypt(remote.blob, keys);
          const local = await applyRemote(decoded, gen);
          if (!C.equal(local.doc, decoded)) {
            try { await api(config, keys, 'PUT', { v: remote.v, blob: await C.encrypt(local.doc, keys) }, cancel.signal); }
            catch (e) { if (e.status === 409) continue; throw e; }
          }
          const pending = await serial(async () => {
            if (gen !== generation) return false;
            const now = await state(), changed = now.syncMeta.revision !== local.revision;
            await info({ creating: false, status: changed ? 'pending' : 'synced', lastSuccess: clock(), error: null });
            return changed;
          });
          if (pending) schedule(2000);
          return;
        }
        throw new Error('version-conflict');
      } finally { clearTimeout(timeout); cancel = null; }
    }
    function sync() {
      if (running) return running;
      const gen = generation;
      running = cycle().catch(async (e) => {
        if (gen !== generation) return;
        const code = ['account-gone', 'authentication-failed', 'permission-denied', 'missing-key', 'cannot-decrypt', 'invalid-package', 'secure-storage-unavailable'].includes(e.message) ? e.message : ['package-too-large', 'rate-limited', 'version-conflict'].includes(e.message) ? e.message : 'server-unavailable';
        await info({ status: 'error', error: code, ...(['account-gone', 'authentication-failed', 'permission-denied', 'missing-key'].includes(code) ? { enabled: false } : {}) });
        // Bounded retries via platform alarm, never a keep-alive pinger.
        if (['server-unavailable', 'version-conflict', 'rate-limited'].includes(code)) schedule(60000);
      }).finally(() => { running = null; });
      return running;
    }
    async function disconnect({ erase = false } = {}) {
      generation++; cancel?.abort();
      if (running) await running;
      if (erase) {
        const s = await state(), creds = await vault.get();
        if (!creds) throw new Error('missing-key');
        // Retain the key until durable deletion succeeds, including on request failure.
        const controller = new AbortController(), t = setTimeout(() => controller.abort(), 120000);
        try { await api(s.deviceSync || creds, await C.derive(creds.master), 'DELETE', null, controller.signal); }
        catch (e) { if (e.status !== 404) throw e; }
        finally { clearTimeout(t); }
      }
      await serial(async () => { await vault.set(null); await storage.set({ deviceSync: { enabled: false, status: 'off' } }); });
    }
    async function recover() { const v = await vault.get(); if (!v) throw new Error('missing-key'); return C.recovery(v.server, v.master); }
    return { write, connect, sync, disconnect, recover, idle: () => queue };
  }
  globalThis.WissSyncEngine = { create };
})();
