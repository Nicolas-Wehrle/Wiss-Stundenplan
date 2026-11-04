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
  queueMicrotask(drawSyncQR);
  const cfg = S.deviceSync || {}, connected = cfg.status && cfg.status !== 'off';
  const statuses = { off: 'Aus', pending: 'Änderungen warten', syncing: 'Wird synchronisiert…', synced: 'Synchronisiert', error: 'Synchronisation fehlgeschlagen' };
  const btn = (act, text, cls = 'ghost') => `<button class="btn ${cls}" data-act="${act}" ${syncUI.busy ? 'disabled' : ''}>${tr(text)}</button>`;
  const error = syncUI.error || cfg.error;
  const intro = `<p class="shint">${tr('Notizen und Prüfungskorrekturen auf all deinen Geräten. Verschlüsselt, der Server kann nichts lesen.')}</p>`;
  const privacy = `<details class="sync-more"><summary>${tr('Datenschutz')}</summary><ul class="sync-facts">
    <li>${tr('Der Server sieht nur eine zufällige ID, die Grösse und die Zeit.')}</li>
    <li>${tr('Wer den Wiederherstellungscode hat, hat Zugriff. Ohne Code und ohne Gerät sind die Daten weg.')}</li>
    <li>${tr('Inaktive Daten werden nach etwa 12 Monaten gelöscht.')}</li></ul></details>`;
  const code = syncUI.code ? `<div class="sync-recovery"><b>${tr('Wiederherstellungscode')}</b><p class="shint">${tr('Gut aufbewahren und niemandem geben.')}</p><textarea readonly data-raw id="syncRecovery" rows="4">${esc(syncUI.code)}</textarea><div id="syncQR" aria-label="${tr('Verbindungscode als QR-Code')}"></div><div class="sync-actions">${btn('device-code-copy', 'Kopieren')}${btn('device-code-hide', 'Ausblenden')}</div></div>` : '';
  const conflicts = (S.syncConflicts || []).length ? `<details><summary>${tr('Wiederherstellbare Notizen')} (${S.syncConflicts.length})</summary>${S.syncConflicts.map((c, i) => `<div class="sync-conflict"><small data-raw>${esc(c.key)}</small><pre data-raw>${esc(c.value)}</pre><button class="btn ghost" data-act="device-note-restore" data-index="${i}">${tr('Übernehmen')}</button></div>`).join('')}</details>` : '';
  return (connected ?
    row(tr('Synchronisation'), tr(statuses[cfg.status] || 'Aus') + (cfg.lastSuccess ? ' · ' + ago(cfg.lastSuccess) : ''), btn('device-now', 'Jetzt')) +
    pairBlock() + `<div class="sync-actions">${btn('device-pair', 'Gerät hinzufügen', 'btn')}${btn('device-code', 'Wiederherstellungscode')}</div>
    <details class="sync-more" ${syncUI.deleteArmed ? 'open' : ''}><summary>${tr('Mehr')}</summary><p class="shint" data-raw>${esc(cfg.server || '')}</p><div class="sync-actions">${btn('device-disconnect', 'Gerät trennen')}${btn(syncUI.deleteArmed ? 'device-delete-confirm' : 'device-delete', syncUI.deleteArmed ? 'Wirklich löschen?' : 'Daten löschen', 'danger')}</div></details>` :
    intro + `<div class="sync-actions">${btn('device-enable', 'Einschalten', 'btn')}</div>
    <div class="sync-join"><b>${tr('Schon auf einem anderen Gerät?')}</b><p class="shint">${tr('Dort «Gerät hinzufügen» tippen und den Code hier eingeben.')}</p>
      <div class="sync-joinrow"><input id="syncJoin" class="pair-input" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX" aria-label="${tr('Code')}">${btn('device-join', 'Verbinden', 'btn')}</div></div>
    <details class="sync-more"><summary>${tr('Server')}</summary><label class="sync-label"><input id="syncServer" type="url" value="https://wiss-stundenplan-sync.onrender.com" autocomplete="off" aria-label="${tr('Sync-Server')}"></label></details>`) +
    (error ? `<p class="sync-error" role="alert">${tr(SYNC_ERRORS[error] || SYNC_ERRORS['server-unavailable'])}</p>` : '') + code + conflicts + privacy;
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
  const result = await chrome.runtime.sendMessage({ type, ...fields });
  if (!result || result.error) throw new Error(result?.error || 'server-unavailable');
  return result;
}
function requestSyncPermission(server) {
  const request = { origins: [WissSyncCore.endpoint(server) + '/*'] };
  if (chrome.runtime.getManifest().browser_specific_settings?.gecko?.data_collection_permissions?.optional) request.data_collection = ['personalCommunications'];
  return chrome.permissions.request(request);
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
  try {
    if (act === 'device-enable') perm = requestSyncPermission(server);
    if (act === 'device-join') {
      if (WissSyncCore.isPairCode(join)) perm = requestSyncPermission(server || 'https://wiss-stundenplan-sync.onrender.com');
      else {
        const p = String(join).split('.'); if (p.length !== 4 || p[0] !== 'WISS1') throw new Error('invalid-code');
        perm = requestSyncPermission(new TextDecoder().decode(WissSyncCore.unb64(p[1])));
      }
    }
  } catch (e) { syncUI.error = e.message; render(); return; }
  syncUI.busy = true; syncUI.error = '';
  const run = async () => {
    if (perm && !await perm) throw new Error('permission-denied');
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
