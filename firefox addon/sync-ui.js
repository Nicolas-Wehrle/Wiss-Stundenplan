// Recovery keys stay outside the ordinary UI state and are displayed only on request.
let syncUI = { code: '', pair: null, error: '', busy: false, deleteArmed: false };
const SYNC_ERRORS = {
  'invalid-code': 'Der Verbindungscode ist ungültig.', 'invalid-server': 'Bitte eine gültige Render-Adresse eingeben.',
  'permission-denied': 'Die Berechtigung für die Synchronisation fehlt.', 'server-unavailable': 'Server nicht erreichbar. Deine Änderungen bleiben hier gespeichert.',
  'account-gone': 'Die synchronisierten Daten wurden gelöscht oder sind abgelaufen. Bitte neu verbinden.',
  'authentication-failed': 'Die Verbindung ist nicht mehr gültig. Bitte trennen und neu verbinden.',
  'missing-key': 'Der Schlüssel fehlt. Bitte mit deinem Wiederherstellungscode neu verbinden.',
  'cannot-decrypt': 'Die Daten konnten nicht entschlüsselt werden. Lokale Daten bleiben erhalten.',
  'invalid-package': 'Das Datenformat wird nicht unterstützt oder ist beschädigt.',
  'package-too-large': 'Die synchronisierten Daten sind zu gross (maximal 256 KB verschlüsselt).',
  'rate-limited': 'Zu viele Anfragen. Wir versuchen es später nochmals.', 'version-conflict': 'Ein anderes Gerät hat Änderungen gespeichert. Wir versuchen es nochmals.',
  'busy': 'Die Synchronisation läuft noch. Bitte kurz warten.', 'already-connected': 'Dieses Gerät ist bereits verbunden.',
  'secure-storage-unavailable': 'Bitte Userscripts aktualisieren. Sicherer Schlüsselspeicher ist nicht verfügbar.',
  'pair-expired': 'Code abgelaufen oder schon benutzt. Mach auf dem anderen Gerät einen neuen.'
};
function renderDeviceSync() {
  if (S.demoMode) return `<p>${tr('Im Demokonto ist die Gerätesynchronisation deaktiviert.')}</p>`;
  queueMicrotask(drawSyncQR);
  const cfg = S.deviceSync || {}, connected = cfg.status && cfg.status !== 'off';
  const statuses = { off: 'Aus', pending: 'Änderungen warten', syncing: 'Wird synchronisiert…', synced: 'Synchronisiert', error: 'Synchronisation fehlgeschlagen' };
  const btn = (act, text, cls = 'ghost') => `<button class="btn ${cls}" data-act="${act}" ${syncUI.busy ? 'disabled' : ''}>${tr(text)}</button>`;
  const error = syncUI.error || cfg.error;
  const ICO = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const devices = ICO('<rect x="2.5" y="5" width="12" height="9" rx="1.8"/><path d="M5.5 17.5h6"/><rect x="16" y="8" width="5.5" height="11" rx="1.4"/>');
  const privacy = `<details class="sync-more"><summary>${tr('Datenschutz')}</summary><ul class="sync-facts">
    <li><i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></i><span><b>${tr('Verschlüsselt')}</b>${tr('Nur deine Geräte haben den Schlüssel.')}</span></li>
    <li><i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></i><span><b>${tr('Der Server sieht fast nichts')}</b>${tr('Nur eine zufällige ID, die Grösse und die Zeit.')}</span></li>
    <li><i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/></svg></i><span><b>${tr('Code gut aufbewahren')}</b>${tr('Wer ihn hat, hat Zugriff. Ohne Code und ohne Gerät sind die Daten weg.')}</span></li>
    <li><i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg></i><span><b>${tr('Wird aufgeräumt')}</b>${tr('Unbenutzte Daten werden nach etwa 12 Monaten gelöscht.')}</span></li></ul></details>`;
  const code = syncUI.code ? `<div class="sync-recovery"><div class="sr-h"><b>${tr('Wiederherstellungscode')}</b><small>${tr('Gut aufbewahren und niemandem geben.')}</small></div>
    <div id="syncQR" aria-label="${tr('Verbindungscode als QR-Code')}"></div><textarea readonly data-raw id="syncRecovery" rows="3">${esc(syncUI.code)}</textarea>
    <div class="sync-actions">${btn('device-code-copy', 'Kopieren')}${btn('device-code-hide', 'Ausblenden')}</div></div>` : '';
  const conflicts = (S.syncConflicts || []).length ? `<details class="sync-more"><summary>${tr('Wiederherstellbare Notizen')} (${S.syncConflicts.length})</summary>${S.syncConflicts.map((c, i) => `<div class="sync-conflict"><small data-raw>${esc(c.key)}</small><pre data-raw>${esc(c.value)}</pre><button class="btn ghost" data-act="device-note-restore" data-index="${i}">${tr('Übernehmen')}</button></div>`).join('')}</details>` : '';
  const err = error ? `<p class="sync-error" role="alert">${tr(SYNC_ERRORS[error] || SYNC_ERRORS['server-unavailable'])}</p>` : '';
  if (!connected) {
    return `<div class="sync-hero"><span class="sh-ico">${devices}</span><div><b>${tr('Auf all deinen Geräten')}</b><small>${tr('Notizen und Prüfungskorrekturen, verschlüsselt.')}</small></div></div>
      ${btn('device-enable', 'Einschalten', 'btn wide')}
      <div class="sync-or"><span>${tr('oder')}</span></div>
      <div class="sync-join"><label for="syncJoin">${tr('Code vom anderen Gerät')}</label>
        <div class="sync-joinrow"><input id="syncJoin" class="pair-input" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX">${btn('device-join', 'Verbinden', 'btn')}</div>
        <small>${tr('Dort unter Sync auf «Gerät hinzufügen» tippen.')}</small></div>
      ${err}
      <details class="sync-more"><summary>${tr('Server')}</summary><label class="sync-label"><input id="syncServer" type="url" value="https://wiss-stundenplan-sync.onrender.com" autocomplete="off" aria-label="${tr('Sync-Server')}"></label></details>${privacy}`;
  }
  const st = cfg.status === 'error' || error ? 'bad' : cfg.status === 'synced' ? 'ok' : 'busy';
  return `<div class="sync-status ${st}"><i></i><div><b>${tr(statuses[cfg.status] || 'Aus')}</b>${cfg.lastSuccess ? `<small>${tr('Zuletzt: {T}', { T: ago(cfg.lastSuccess) })}</small>` : ''}</div>
      <button class="icon" data-act="device-now" ${syncUI.busy ? 'disabled' : ''} title="${esc(tr('Jetzt synchronisieren'))}" aria-label="${esc(tr('Jetzt synchronisieren'))}">${ICO('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>')}</button></div>
    ${err}${syncUI.pair ? pairBlock() : btn('device-pair', 'Gerät hinzufügen', 'btn wide')}
    ${code}${conflicts}
    <details class="sync-more"><summary>${tr('Wiederherstellungscode')}</summary><p class="shint">${tr('Damit kommst du an deine Daten, falls alle Geräte weg sind.')}</p><div class="sync-actions">${btn('device-code', 'Anzeigen')}</div></details>
    ${privacy}
    <details class="sync-more" ${syncUI.deleteArmed ? 'open' : ''}><summary>${tr('Trennen oder löschen')}</summary><p class="shint" data-raw>${esc(cfg.server || '')}</p><div class="sync-actions">${btn('device-disconnect', 'Gerät trennen')}${btn(syncUI.deleteArmed ? 'device-delete-confirm' : 'device-delete', syncUI.deleteArmed ? 'Wirklich löschen?' : 'Daten löschen', 'danger')}</div></details>`;
}
function pairBlock() {
  if (!syncUI.pair) return '';
  const left = Math.max(0, Math.round((syncUI.pair.expires - Date.now()) / 60000));
  return `<div class="pair-card" role="status"><small>${tr('Auf dem neuen Gerät eingeben')}</small><div class="pair-code" data-raw>${esc(syncUI.pair.code)}</div>
    <p class="shint">${tr('Gilt {M} Min., nur einmal.', { M: left || 1 })}</p>
    <div class="sync-actions"><button class="btn ghost" data-act="device-pair-copy">${tr('Kopieren')}</button><button class="btn ghost" data-act="device-pair-hide">${tr('Fertig')}</button></div></div>`;
}
function drawSyncQR() {
  const el = document.getElementById('syncQR');
  if (!el || !syncUI.code || typeof qrcode !== 'function') return;
  const qr = qrcode(0, 'M'); qr.addData(syncUI.code, 'Byte'); qr.make();
  setHTML(el, qr.createSvgTag({ cellSize: 3, margin: 12, scalable: true }));
}
async function syncMessage(type, fields = {}) {
  const result = await browser.runtime.sendMessage({ type, ...fields });
  if (!result || result.error) throw new Error(result?.error || 'server-unavailable');
  return result;
}
function requestSyncPermission(server) {
  const request = { origins: [WissSyncCore.endpoint(server) + '/*'] };
  if (browser.runtime.getManifest().browser_specific_settings?.gecko?.data_collection_permissions?.optional) request.data_collection = ['personalCommunications'];
  return browser.permissions.request(request);
}
document.addEventListener('click', (ev) => {
  const a = ev.target.closest('[data-act]'); if (!a || !a.dataset.act.startsWith('device-')) return;
  const act = a.dataset.act; if (syncUI.busy) return;
  if (act === 'device-delete') { syncUI.deleteArmed = true; render(); return; }
  if (act === 'device-code-hide') { syncUI.code = ''; render(); return; }
  if (act === 'device-pair-hide') { syncUI.pair = null; render(); return; }
  if (act === 'device-pair-copy') { navigator.clipboard?.writeText(syncUI.pair?.code || '').catch(() => {}); a.textContent = tr('Kopiert'); return; }
  const join = document.getElementById('syncJoin')?.value.trim(), server = document.getElementById('syncServer')?.value.trim();
  let perm;
  // The browser closes the popup while it asks for permission. Remember what was pressed,
  // so the background can finish the step once permission is given (no second click).
  const remember = (kind, srv, code) => { try { browser.storage.session?.set({ syncIntent: { act: kind, server: srv, code, at: Date.now() } }); } catch (e) {} };
  try {
    if (act === 'device-enable') { remember('enable', server); perm = requestSyncPermission(server); }
    if (act === 'device-join') {
      if (WissSyncCore.isPairCode(join)) { const srv = server || 'https://wiss-stundenplan-sync.onrender.com'; remember('pair', srv, join); perm = requestSyncPermission(srv); }
      else {
        const p = String(join).split('.'); if (p.length !== 4 || p[0] !== 'WISS1') throw new Error('invalid-code');
        remember('join', '', join); perm = requestSyncPermission(new TextDecoder().decode(WissSyncCore.unb64(p[1])));
      }
    }
  } catch (e) { syncUI.error = e.message; render(); return; }
  syncUI.busy = true; syncUI.error = '';
  const run = async () => {
    const granted = perm ? await perm : true;
    try { await browser.storage.session?.remove('syncIntent'); } catch (e) {}
    if (!granted) throw new Error('permission-denied');
    if (act === 'device-join' && WissSyncCore.isPairCode(join)) {
      await syncMessage('deviceSyncPairJoin', { server: server || 'https://wiss-stundenplan-sync.onrender.com', code: join });
    } else if (act === 'device-enable' || act === 'device-join') {
      const r = await syncMessage('deviceSyncConnect', act === 'device-join' ? { code: join } : { server }); syncUI.code = r.recovery || '';
    } else if (act === 'device-pair') {
      const r = await syncMessage('deviceSyncPairOffer'); syncUI.pair = { code: r.pairCode, expires: r.expires || Date.now() + 600000 };
    } else if (act === 'device-now') await syncMessage('deviceSyncNow');
    else if (act === 'device-disconnect') { await syncMessage('deviceSyncDisconnect'); syncUI.code = ''; }
    else if (act === 'device-delete-confirm') { await syncMessage('deviceSyncDelete'); syncUI.code = ''; }
    else if (act === 'device-code') syncUI.code = (await syncMessage('deviceSyncRecovery')).recovery;
    else if (act === 'device-code-copy') await navigator.clipboard.writeText(syncUI.code);
    else if (act === 'device-note-restore') {
      const c = S.syncConflicts?.[Number(a.dataset.index)]; if (c) await syncMessage('deviceSyncWrite', { patch: { notes: { [c.key]: c.value } } });
    }
  };
  run().catch((e) => { syncUI.error = e.message; }).finally(() => { syncUI.busy = false; syncUI.deleteArmed = false; load().then(drawSyncQR); });
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { syncUI.code = ''; syncUI.pair = null; document.querySelector('.sync-recovery')?.remove(); } });
document.addEventListener('click', (e) => { if (['setup-close', 'setup-done'].includes(e.target.closest('[data-act]')?.dataset.act)) syncUI.code = ''; });

// Finished by the background after the permission prompt closed the popup: show the result right away.
(async () => {
  try {
    if (!browser.storage?.session) return;
    const { syncDone } = await browser.storage.session.get('syncDone');
    if (!syncDone || Date.now() - syncDone.at > 10 * 60000) return;
    await browser.storage.session.remove('syncDone');
    if (syncDone.error) syncUI.error = syncDone.error;
    else if (syncDone.showRecovery) syncUI.code = (await syncMessage('deviceSyncRecovery')).recovery || '';
    const open = () => { if (!document.getElementById('set-sync')) document.getElementById('btnSettings')?.click(); setTimeout(() => { render(); document.getElementById('set-sync')?.scrollIntoView({ block: 'start' }); }, 120); };
    if (document.readyState === 'complete') setTimeout(open, 300); else addEventListener('load', () => setTimeout(open, 300));
  } catch (e) {}
})();
