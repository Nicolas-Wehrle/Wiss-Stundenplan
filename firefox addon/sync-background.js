// Loaded only by the background context (and once in each mobile app page).
(() => {
  'use strict';
  let timer;
  const permission = async (server) => {
    const ok = await browser.permissions.contains({ origins: [server + '/*'] });
    if (!ok) return false;
    if (typeof browser !== 'undefined' && browser.runtime?.getManifest().browser_specific_settings?.gecko?.data_collection_permissions?.optional)
      return browser.permissions.contains({ data_collection: ['personalCommunications'] });
    return true;
  };
  const engine = WissSyncEngine.create({
    storage: browser.storage.local,
    vault: globalThis.__wissSyncVault,
    permission,
    onApprenticeship: (degree) => browser.runtime.sendMessage({ type: 'mbkLoad', id: degree.id, extraNums: [] }),
    schedule: (delay) => {
      clearTimeout(timer);
      // Alarms survive MV3 worker suspension; the short timer just avoids a needless delay when awake.
      browser.alarms.create('device-sync-retry', { delayInMinutes: Math.max(0.5, delay / 60000), periodInMinutes: undefined });
      timer = setTimeout(() => run(), delay);
    }
  });
  const run = async () => {
    await engine.sync();
    const { deviceSync } = await browser.storage.local.get('deviceSync');
    if (!deviceSync?.enabled || deviceSync.status === 'synced') browser.alarms.clear?.('device-sync-retry');
  };
  const trusted = (sender) => !sender.tab || (sender.url && sender.url.startsWith(browser.runtime.getURL('popup.html')));
  browser.runtime.onMessage.addListener((msg, sender, respond) => {
    if (!msg || !['deviceSyncWrite', 'deviceSyncConnect', 'deviceSyncNow', 'deviceSyncDisconnect', 'deviceSyncDelete', 'deviceSyncRecovery', 'deviceSyncReset'].includes(msg.type)) return;
    if (!trusted(sender)) { respond({ error: 'permission-denied' }); return false; }
    const task = async () => {
      if (msg.type === 'deviceSyncWrite') return engine.write(msg.patch || {});
      if (msg.type === 'deviceSyncConnect') return engine.connect({ server: msg.server, code: msg.code });
      if (msg.type === 'deviceSyncNow') return engine.sync();
      if (msg.type === 'deviceSyncRecovery') return { recovery: await engine.recover() };
      if (msg.type === 'deviceSyncReset') { await engine.disconnect(); await browser.storage.local.clear(); return; }
      await engine.disconnect({ erase: msg.type === 'deviceSyncDelete' });
    };
    task().then((result) => respond({ ok: true, ...result }), (e) => respond({ error: e.message || 'server-unavailable' }));
    return true;
  });
  const start = async () => {
    const { deviceSync } = await browser.storage.local.get('deviceSync');
    if (!deviceSync?.enabled) return;
    browser.alarms.create('device-sync-poll', { periodInMinutes: 15 });
    run();
  };
  browser.alarms.onAlarm.addListener((a) => { if (a.name.startsWith('device-sync-')) run(); });
  browser.runtime.onStartup.addListener(start);
  browser.runtime.onInstalled.addListener(start);
  browser.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local' || !ch.deviceSync) return;
    if (ch.deviceSync.newValue?.enabled) browser.alarms.create('device-sync-poll', { periodInMinutes: 15 });
    else { clearTimeout(timer); browser.alarms.clear?.('device-sync-poll'); browser.alarms.clear?.('device-sync-retry'); }
  });
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') run(); });
  // Restrict extension storage (including the key) to extension pages/background, not content scripts.
  browser.storage.local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' });
  start().catch(() => {});
})();
