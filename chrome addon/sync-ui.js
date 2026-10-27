// Recovery keys stay outside the ordinary UI state and are displayed only on request.
let syncUI = { code: '', error: '', busy: false, deleteArmed: false };
const SYNC_ERRORS = {
  'invalid-code': 'Der Verbindungscode ist ungültig.', 'invalid-server': 'Bitte eine gültige Render-Adresse eingeben.',
  'permission-denied': 'Die Berechtigung für die Synchronisation fehlt.', 'server-unavailable': 'Server nicht erreichbar. Deine Änderungen bleiben auf diesem Gerät gespeichert.',
  'account-gone': 'Die synchronisierten Daten wurden gelöscht oder sind abgelaufen. Bitte neu verbinden.',
  'authentication-failed': 'Die Verbindung ist nicht mehr gültig. Bitte trennen und neu verbinden.',
  'missing-key': 'Der Schlüssel fehlt. Bitte mit deinem Wiederherstellungscode neu verbinden.',
  'cannot-decrypt': 'Die Daten konnten nicht entschlüsselt werden. Lokale Daten bleiben erhalten.',
  'invalid-package': 'Das Datenformat wird nicht unterstützt oder ist beschädigt.',
  'package-too-large': 'Die synchronisierten Daten sind zu gross (maximal 256 KB verschlüsselt).',
  'rate-limited': 'Zu viele Anfragen. Wir versuchen es später nochmals.', 'version-conflict': 'Ein anderes Gerät hat Änderungen gespeichert. Wir versuchen es nochmals.',
  'busy': 'Die Synchronisation läuft noch. Bitte kurz warten.', 'already-connected': 'Dieses Gerät ist bereits verbunden.',
  'secure-storage-unavailable': 'Bitte Userscripts aktualisieren. Sicherer Schlüsselspeicher ist nicht verfügbar.'
};
function renderDeviceSync() {
  queueMicrotask(drawSyncQR);
  const cfg = S.deviceSync || {}, connected = cfg.status && cfg.status !== 'off';
  const statuses = { off: 'Aus', pending: 'Änderungen warten', syncing: 'Wird synchronisiert…', synced: 'Synchronisiert', error: 'Synchronisation fehlgeschlagen' };
  const btn = (act, text, cls = 'ghost') => `<button class="btn ${cls}" data-act="${act}" ${syncUI.busy ? 'disabled' : ''}>${tr(text)}</button>`;
  const error = syncUI.error || cfg.error;
  const intro = `<p class="shint">${tr('Optional: Notizen, Prüfungskorrekturen, ZP-Regel, Wunschnote, Rundung und Lehrberuf zwischen deinen Geräten synchronisieren. Ende-zu-Ende verschlüsselt. Darstellung und Benachrichtigungen bleiben auf diesem Gerät.')}</p>`;
  const privacy = `<details><summary>${tr('Datenschutz und Wiederherstellung')}</summary><p class="shint">${tr('Der Server sieht eine zufällige ID, Paketgrösse und Zugriffszeiten. Render und GitHub verarbeiten Verbindungsdaten wie die IP-Adresse. Inhalte und Schlüssel werden nicht im Klartext hochgeladen.')}</p><p class="shint">${tr('Alle Geräte und den Wiederherstellungscode verloren? Dann sind die synchronisierten Daten nicht wiederherstellbar. Wer den Code hat, kann deine Daten lesen und ändern.')}</p><p class="shint">${tr('Löschen entfernt die aktive Serverdatei nach bestätigter Speicherung. Verschlüsselte Kopien können in GitHub-Sicherungen verbleiben. Monatliche Bereinigung garantiert keine vollständige Löschung aller Kopien. Inaktive Konten werden nach ungefähr 12 Monaten entfernt.')}</p></details>`;
  const code = syncUI.code ? `<div class="sync-recovery"><b>${tr('Wiederherstellungscode sicher aufbewahren')}</b><p class="shint">${tr('Dieser Code ist dein Schlüssel. Nicht an andere weitergeben.')}</p><textarea readonly data-raw id="syncRecovery" rows="5">${esc(syncUI.code)}</textarea><div id="syncQR" aria-label="${tr('Verbindungscode als QR-Code')}"></div>${btn('device-code-copy', 'Code kopieren')}${btn('device-code-hide', 'Code ausblenden')}</div>` : '';
  const conflicts = (S.syncConflicts || []).length ? `<details><summary>${tr('Wiederherstellbare Notizen')} (${S.syncConflicts.length})</summary>${S.syncConflicts.map((c, i) => `<div class="sync-conflict"><small data-raw>${esc(c.key)}</small><pre data-raw>${esc(c.value)}</pre><button class="btn ghost" data-act="device-note-restore" data-index="${i}">${tr('Als aktuelle Notiz übernehmen')}</button></div>`).join('')}</details>` : '';
  return intro + (connected ?
    row(tr('Geräte-Synchronisation'), tr(statuses[cfg.status] || 'Aus'), btn('device-now', 'Jetzt synchronisieren')) +
    (cfg.lastSuccess ? `<p class="shint">${tr('Zuletzt: {T}', { T: ago(cfg.lastSuccess) })}</p>` : '') +
    `<p class="shint" data-raw>${esc(cfg.server || '')}</p><div class="sync-actions">${btn('device-code', 'Gerät verbinden / Wiederherstellungscode')}${btn('device-disconnect', 'Dieses Gerät trennen')}${btn(syncUI.deleteArmed ? 'device-delete-confirm' : 'device-delete', syncUI.deleteArmed ? 'Synchronisierte Daten wirklich löschen?' : 'Synchronisierte Daten löschen', 'danger')}</div>` :
    `<label class="sync-label">${tr('Sync-Server')}<input id="syncServer" type="url" value="https://wiss-stundenplan-sync.onrender.com" autocomplete="off"></label><p class="shint">${tr('Mit Aktivieren stimmst du der beschriebenen verschlüsselten Übertragung zu. Vorher wird der Sync-Server nicht kontaktiert.')}</p>${btn('device-enable', 'Synchronisation aktivieren')}
    <details><summary>${tr('Mit vorhandenem Code verbinden')}</summary><label class="sync-label">${tr('Verbindungs- oder Wiederherstellungscode')}<textarea id="syncJoin" autocomplete="off" autocapitalize="off" spellcheck="false" rows="4"></textarea></label><p class="shint">${tr('QR-Code mit der Kamera deines Geräts lesen und den Text hier einfügen.')}</p>${btn('device-join', 'Gerät verbinden')}</details>`) +
    (error ? `<p class="sync-error" role="alert">${tr(SYNC_ERRORS[error] || SYNC_ERRORS['server-unavailable'])}</p>` : '') + code + conflicts + privacy;
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
  const join = document.getElementById('syncJoin')?.value.trim(), server = document.getElementById('syncServer')?.value.trim();
  let perm;
  try {
    if (act === 'device-enable') perm = requestSyncPermission(server);
    if (act === 'device-join') {
      const p = String(join).split('.'); if (p.length !== 4 || p[0] !== 'WISS1') throw new Error('invalid-code');
      perm = requestSyncPermission(new TextDecoder().decode(WissSyncCore.unb64(p[1])));
    }
  } catch (e) { syncUI.error = e.message; render(); return; }
  syncUI.busy = true; syncUI.error = '';
  const run = async () => {
    if (perm && !await perm) throw new Error('permission-denied');
    if (act === 'device-enable' || act === 'device-join') {
      const r = await syncMessage('deviceSyncConnect', act === 'device-join' ? { code: join } : { server }); syncUI.code = r.recovery || '';
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
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { syncUI.code = ''; document.querySelector('.sync-recovery')?.remove(); } });
document.addEventListener('click', (e) => { if (['setup-close', 'setup-done'].includes(e.target.closest('[data-act]')?.dataset.act)) syncUI.code = ''; });
