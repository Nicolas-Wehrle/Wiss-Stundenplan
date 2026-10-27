// Shared, platform-independent encrypted sync format. No network or storage side effects.
(() => {
  'use strict';
  const FORMAT = 1, MAX_BYTES = 256 * 1024;
  const PREFS = ['targetGrade', 'gradeStep'];
  const GROUPS = ['notes', 'examOverrides', 'settings'];
  const enc = new TextEncoder(), dec = new TextDecoder('utf-8', { fatal: true });
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const plain = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  const safeKey = (k) => typeof k === 'string' && k.length > 0 && k.length <= 200 && !['__proto__', 'constructor', 'prototype'].includes(k);
  const fail = (code) => { throw new Error(code); };
  function b64(bytes) { let raw = ''; for (const x of bytes) raw += String.fromCharCode(x); return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64(s) {
    if (typeof s !== 'string' || !/^[A-Za-z0-9_-]+$/.test(s) || s.length % 4 === 1) fail('invalid-code');
    const a = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    if (b64(a) !== s) fail('invalid-code');
    return a;
  }
  const random = (n) => b64(crypto.getRandomValues(new Uint8Array(n)));
  function endpoint(value) {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.pathname !== '/' || !u.hostname.endsWith('.onrender.com')) fail('invalid-server');
    return u.origin;
  }
  async function derive(master) {
    const bytes = unb64(master); if (bytes.length !== 32) fail('invalid-code');
    const key = await crypto.subtle.importKey('raw', bytes, 'HKDF', false, ['deriveBits', 'deriveKey']);
    const params = (label) => ({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('wiss-sync-v1'), info: enc.encode(label) });
    return {
      id: b64(new Uint8Array(await crypto.subtle.deriveBits(params('id'), key, 256))),
      auth: b64(new Uint8Array(await crypto.subtle.deriveBits(params('auth'), key, 256))),
      aes: await crypto.subtle.deriveKey(params('encryption'), key, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    };
  }
  async function checksum(s) { return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s))).slice(0, 6)); }
  async function recovery(server, master) {
    const body = 'WISS1.' + b64(enc.encode(endpoint(server))) + '.' + master;
    return body + '.' + await checksum(body);
  }
  async function parseRecovery(code) {
    const p = String(code).trim().split('.');
    if (p.length !== 4 || p[0] !== 'WISS1' || p[3] !== await checksum(p.slice(0, 3).join('.'))) fail('invalid-code');
    const server = endpoint(dec.decode(unb64(p[1]))); await derive(p[2]);
    return { server, master: p[2] };
  }
  const empty = () => ({ format: FORMAT, notes: {}, examOverrides: {}, settings: {} });
  function validValue(group, key, v) {
    if (group === 'notes') return typeof v === 'string';
    if (group === 'examOverrides') return Array.isArray(v) && v.length <= 30 && v.every((x) => typeof x === 'string' && x.length <= 150);
    if (key === 'targetGrade') return [4, 4.5, 5, 5.5, 6].includes(v);
    if (key === 'gradeStep') return [0, 0.1, 0.5].includes(v);
    if (key === 'zpRule') return ['every3', 'once3', 'none'].includes(v);
    if (key === 'abschluss') return plain(v) && Object.keys(v).every((k) => ['id', 'name'].includes(k)) && typeof v.id === 'string' && v.id.length <= 100 && typeof v.name === 'string' && v.name.length <= 200;
    return false;
  }
  function validate(doc, checkSize = true) {
    if (!plain(doc) || doc.format !== FORMAT || Object.keys(doc).some((k) => !['format', ...GROUPS].includes(k))) fail('invalid-package');
    for (const g of GROUPS) {
      if (!plain(doc[g]) || Object.keys(doc[g]).length > 10000) fail('invalid-package');
      for (const [k, r] of Object.entries(doc[g])) {
        if (g === 'settings' && ![...PREFS, 'zpRule', 'abschluss'].includes(k)) fail('invalid-package');
        if (!safeKey(k) || !plain(r) || Object.keys(r).some((x) => !['at', 'device', 'deleted', 'value'].includes(x)) ||
            !Number.isSafeInteger(r.at) || r.at < 0 || r.at > Date.now() + 86400000 ||
            typeof r.device !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(r.device) || typeof r.deleted !== 'boolean' ||
            (r.deleted ? own(r, 'value') : !validValue(g, k, r.value))) fail('invalid-package');
      }
    }
    if (checkSize && enc.encode(JSON.stringify(doc)).length > Math.floor((MAX_BYTES - 1024) * 3 / 4)) fail('package-too-large');
    return doc;
  }
  const canonical = (value) => JSON.stringify(value, (_, v) => plain(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v);
  const equal = (a, b) => canonical(a) === canonical(b);
  const lexical = (a, b) => a === b ? 0 : a < b ? -1 : 1;
  function compare(a, b) { return a.at - b.at || lexical(a.device, b.device) || lexical(canonical(a), canonical(b)); }
  function merge(a, b) {
    validate(a, false); validate(b, false);
    const out = empty(), conflicts = [];
    for (const g of GROUPS) for (const k of new Set([...Object.keys(a[g]), ...Object.keys(b[g])])) {
      const x = a[g][k], y = b[g][k];
      const winner = !x ? y : !y ? x : compare(x, y) >= 0 ? x : y;
      out[g][k] = structuredClone(winner);
      if (g === 'notes' && x && y && !equal(x, y) && !x.deleted && !y.deleted && x.value !== y.value)
        conflicts.push({ key: k, ...structuredClone(winner === x ? y : x) });
    }
    validate(out, false); return { doc: out, conflicts };
  }
  function snapshot(s) {
    const doc = empty();
    for (const g of ['notes', 'examOverrides']) for (const [k, v] of Object.entries(s[g] || {}))
      if (safeKey(k) && validValue(g, k, v)) doc[g][k] = { at: 0, device: 'legacy', deleted: false, value: structuredClone(v) };
    const values = { ...Object.fromEntries(PREFS.filter((k) => own(s.prefs || {}, k)).map((k) => [k, s.prefs[k]])), zpRule: s.zpRule, abschluss: s.abschluss && { id: s.abschluss.id, name: s.abschluss.name } };
    for (const [k, v] of Object.entries(values)) if (validValue('settings', k, v)) doc.settings[k] = { at: 0, device: 'legacy', deleted: false, value: v };
    return validate(doc, false);
  }
  function materialize(doc, current) {
    validate(doc, false);
    const out = { notes: {}, examOverrides: {}, prefs: { ...(current.prefs || {}) } };
    for (const g of ['notes', 'examOverrides']) for (const [k, r] of Object.entries(doc[g])) if (!r.deleted) out[g][k] = structuredClone(r.value);
    for (const [k, r] of Object.entries(doc.settings)) {
      if (PREFS.includes(k)) { if (r.deleted) delete out.prefs[k]; else out.prefs[k] = r.value; }
      else out[k] = r.deleted ? null : structuredClone(r.value);
    }
    return out;
  }
  async function encrypt(doc, keys) {
    validate(doc); const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode('wiss-sync:1:' + keys.id) }, keys.aes, enc.encode(canonical(doc)));
    // Avoid spreading a large payload onto the JS call stack.
    let raw = ''; for (const x of new Uint8Array(data)) raw += String.fromCharCode(x);
    return { format: FORMAT, iv: b64(iv), data: btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') };
  }
  async function decrypt(blob, keys) {
    if (!plain(blob) || blob.format !== FORMAT || typeof blob.data !== 'string' || blob.data.length > MAX_BYTES * 2) fail('invalid-package');
    const iv = unb64(blob.iv); if (iv.length !== 12) fail('invalid-package');
    try {
      const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: enc.encode('wiss-sync:1:' + keys.id) }, keys.aes, unb64(blob.data));
      return validate(JSON.parse(dec.decode(data)));
    } catch (e) { if (e.message === 'package-too-large') throw e; fail('cannot-decrypt'); }
  }
  globalThis.WissSyncCore = { FORMAT, MAX_BYTES, PREFS, GROUPS, b64, unb64, random, endpoint, derive, recovery, parseRecovery, empty, validate, equal, merge, snapshot, materialize, encrypt, decrypt, validValue, safeKey };
})();
