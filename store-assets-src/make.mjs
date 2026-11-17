// Step 2: lays the screenshots from capture.mjs out as designed store pictures.
// Writes the Chrome Web Store images into store-assets/ and the link preview (Discord, WhatsApp, …) into docs/og.png.
//   node store-assets-src/capture.mjs && node store-assets-src/make.mjs
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.dirname(here);
const shot = (n) => pathToFileURL(path.join(here, 'shots', n + '.png')).href;
const font = (n) => pathToFileURL(path.join(root, 'chrome addon', 'fonts', n)).href;
const facts = JSON.parse(fs.readFileSync(path.join(here, 'shots', 'facts.json'), 'utf8'));
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const avg = +facts.avg, after = ((avg * facts.done + 5.5) / (facts.done + 1)).toFixed(2);
const MON = { JAN: 1, FEB: 2, MAR: 3, MÄR: 3, APR: 4, MAI: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OKT: 10, NOV: 11, DEZ: 12 };
const [, absDay, absMon, absLabel] = facts.abs, absLeft = facts.abs.find((x) => /^noch \d/.test(x)) || 'noch 2 Tage';
const absTitle = `Absenz vom ${absDay}.${MON[absMon.split(' ')[0]] || ''}. noch nicht entschuldigt`;
const absBody = `${absLabel.split(' ')[0]} · ${absLeft} zum Entschuldigen`;
const logo = fs.readFileSync(path.join(root, 'docs', 'logo.svg'), 'utf8');

const CSS = `
@font-face { font-family: B; src: url(${font('bricolage-grotesque.woff2')}); font-weight: 200 800; }
@font-face { font-family: G; src: url(${font('geist.woff2')}); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; }
body { position: relative; background: #f7f5f1; color: #16141d; font: 400 18px/1.45 G, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
body::before { content: ""; position: absolute; inset: 0; background-image: radial-gradient(#d9d3c8 1.1px, transparent 1.2px); background-size: 22px 22px; mask-image: radial-gradient(ellipse at 70% 40%, #000 20%, transparent 75%); }
.blob { position: absolute; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #ff6478, #d81f3c 70%); filter: blur(0); }
.glow { position: absolute; border-radius: 50%; background: radial-gradient(circle, rgba(232,52,78,.22), transparent 65%); }
.dark { background: #15131a; color: #f3f1f6; }
.dark::before { background-image: radial-gradient(#2e2a36 1.1px, transparent 1.2px); }
.abs { position: absolute; }
.eye { display: inline-flex; align-items: center; gap: 8px; font: 700 13px/1 G; letter-spacing: .12em; text-transform: uppercase; color: #e2283f; }
.eye::before { content: ""; width: 18px; height: 2px; background: currentColor; }
h1 { font: 800 58px/1.02 B, G, sans-serif; letter-spacing: -.035em; margin-top: 16px; }
h1 em { font-style: normal; color: #e2283f; }
.sub { margin-top: 18px; font-size: 20px; line-height: 1.45; color: #5d5964; max-width: 440px; }
.dark .sub { color: #a7a2b1; }
.win { position: absolute; border-radius: 16px; overflow: hidden; background: #fff; box-shadow: 0 1px 0 rgba(0,0,0,.04), 0 30px 70px -20px rgba(40,20,30,.35), 0 0 0 1px rgba(22,20,29,.08); }
.win .bar { height: 34px; display: flex; align-items: center; gap: 7px; padding: 0 14px; background: #efece6; border-bottom: 1px solid #e2ddd4; }
.win .bar i { width: 11px; height: 11px; border-radius: 50%; background: #d6d0c6; }
.win .bar span { margin-left: 14px; padding: 4px 14px; border-radius: 99px; background: #fff; font-size: 12px; color: #8a8592; }
.win.d { background: #1d1b22; box-shadow: 0 30px 70px -20px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.08); }
.win.d .bar { background: #24212b; border-color: #2e2b36; } .win.d .bar i { background: #3a3642; } .win.d .bar span { background: #1a1820; color: #8f8a99; }
.win img { display: block; width: 100%; }
.pop { position: absolute; border-radius: 18px; overflow: hidden; box-shadow: 0 40px 80px -24px rgba(40,10,20,.5), 0 0 0 1px rgba(22,20,29,.1); }
.pop img { display: block; width: 100%; }
.card { position: absolute; background: #fff; border-radius: 16px; padding: 16px 18px; box-shadow: 0 22px 50px -18px rgba(40,20,30,.4), 0 0 0 1px rgba(22,20,29,.07); }
.card .k { font: 700 11.5px/1 G; letter-spacing: .1em; text-transform: uppercase; color: #8a8592; }
.card .v { font: 800 30px/1.1 B, G; letter-spacing: -.03em; margin-top: 6px; }
.pill { position: absolute; display: inline-flex; align-items: center; gap: 9px; padding: 10px 16px 10px 12px; border-radius: 99px; background: #16141d; color: #fff; font: 600 15px/1 G; box-shadow: 0 16px 34px -14px rgba(0,0,0,.55); white-space: nowrap; }
.pill b { width: 22px; height: 22px; border-radius: 50%; background: #e2283f; display: grid; place-items: center; font-size: 13px; }
.checks { list-style: none; padding: 0; margin-top: 26px; display: grid; gap: 12px; font-size: 18px; font-weight: 500; }
.checks li { display: flex; gap: 12px; align-items: center; }
.checks li::before { content: "✓"; width: 26px; height: 26px; border-radius: 8px; background: #fde8eb; color: #e2283f; display: grid; place-items: center; font-weight: 800; font-size: 14px; flex: none; }
.brand { display: flex; align-items: center; gap: 14px; font: 800 24px/1 B, G; letter-spacing: -.02em; }
.brand svg { width: 52px; height: 52px; filter: drop-shadow(0 10px 18px rgba(216,31,60,.35)); }
.foot { position: absolute; font-size: 13px; color: #9a96a2; }
`;
const win = (src, { x, y, w, d = false, url = 'WISS Stundenplan', rot = 0, crop } = {}) =>
  `<div class="win${d ? ' d' : ''}" style="left:${x}px;top:${y}px;width:${w}px;${crop ? `height:${crop}px;` : ''}transform:rotate(${rot}deg)"><div class="bar"><i></i><i></i><i></i><span>${url}</span></div><img src="${shot(src)}"></div>`;
const pop = (src, { x, y, w, rot = 0, crop }) => `<div class="pop" style="left:${x}px;top:${y}px;width:${w}px;${crop ? `height:${crop}px;` : ''}transform:rotate(${rot}deg)"><img src="${shot(src)}"></div>`;
const brand = (size = 52) => `<div class="brand">${logo.replace('<svg ', `<svg style="width:${size}px;height:${size}px" `)}<span>WISS Stundenplan</span></div>`;
const noteTxt = 'Inoffizielles Schülerprojekt · Abbildungen mit frei erfundenen Demodaten';
const note = '<div class="foot" style="left:72px;bottom:28px">Inoffizielles Schülerprojekt · Abbildungen mit frei erfundenen Demodaten</div>';

const pages = {
  // ---------- Chrome Web Store screenshots, 1280×800 ----------
  'store-assets/screenshot-1-overview-1280x800.png': [1280, 800, `
    <div class="glow" style="width:900px;height:900px;right:-300px;top:-260px"></div>
    <div class="abs" style="left:72px;top:84px;width:500px">
      ${brand(48)}
      <h1 style="margin-top:42px;font-size:54px">Dein Stundenplan, <em>ein Klick</em> entfernt.</h1>
      <p class="sub">Woche, Prüfungen, Noten, Absenzen und freie Räume aus dem WISS-Extranet. Sofort da, ohne Ladezeit.</p>
      <ul class="checks"><li>Lädt sofort, aktualisiert im Hintergrund</li><li>Daten bleiben auf deinem Gerät</li><li>Kostenlos, ohne Werbung</li></ul>
    </div>
    ${win('week', { x: 600, y: 96, w: 880 })}
    ${pop('popup', { x: 540, y: 300, w: 330 })}
    <div class="pill" style="left:808px;top:258px"><b>↗</b>Ein Klick in der Symbolleiste</div>
    ${note}`],

  'store-assets/screenshot-2-exams-1280x800.png': [1280, 800, `
    <div class="glow" style="width:800px;height:800px;left:-260px;top:-300px"></div>
    <div class="abs" style="left:0;right:0;top:66px;text-align:center">
      <span class="eye">Prüfungen</span>
      <h1>Keine Prüfung kommt <em>überraschend.</em></h1>
      <p class="sub" style="margin:16px auto 0;max-width:640px">Countdown bis zur nächsten Prüfung, Zwischenprüfungen erkannt, geschätzte Termine klar markiert.</p>
    </div>
    ${win('exams', { x: 190, y: 300, w: 900 })}
    <div class="card" style="left:72px;top:390px;width:230px;transform:rotate(-4deg)">
      <div class="k">Nächste Prüfung</div>
      <div class="v" style="font-size:54px;color:#e2283f">${esc(facts.exam.days)} ${facts.exam.days === '1' ? 'Tag' : 'Tage'}</div>
      <div style="font-size:14px;color:#5d5964;margin-top:4px">${esc(facts.exam.title.split(' ')[0])}${/ZP/.test(facts.exam.kicker) ? ' · Zwischenprüfung' : ''}<br>${esc(facts.exam.meta.split(' · ').slice(0, 2).join(' · '))}</div>
    </div>
    <div class="pill" style="left:930px;top:470px;transform:rotate(3deg)"><b>✓</b>Geschätzte Termine gekennzeichnet</div>
    <div class="pill" style="left:960px;top:560px;transform:rotate(-2deg);background:#e2283f"><b style="background:#fff;color:#e2283f;font-size:9px">ZP</b>Auch im Wochenplan markiert</div>
    <div class="foot" style="right:72px;top:28px">${noteTxt}</div>`],

  'store-assets/screenshot-3-grades-1280x800.png': [1280, 800, `
    <div class="glow" style="width:900px;height:900px;right:-340px;bottom:-420px"></div>
    <div class="abs" style="left:72px;top:110px;width:420px">
      <span class="eye">Noten</span>
      <h1>Wissen, wo du <em>stehst.</em></h1>
      <p class="sub">Schnitt, Verlauf und alle Modulnoten. Der Notenrechner zeigt dir, was eine nächste Note bewirkt.</p>
    </div>
    ${win('grades', { x: 540, y: 90, w: 860 })}
    <div class="card" style="left:96px;top:470px;width:380px;padding:20px 22px">
      <div class="k">Notenrechner</div>
      <div style="display:flex;align-items:center;gap:14px;margin-top:14px">
        <div style="flex:1;padding:10px 14px;border-radius:12px;background:#f3f0ea;font-size:14px;color:#5d5964">Nächste Note<div style="font:800 26px/1.1 B;color:#16141d;margin-top:2px">5.5</div></div>
        <div style="font:800 24px B;color:#c9c3b8">→</div>
        <div style="flex:1;padding:10px 14px;border-radius:12px;background:#fde8eb;font-size:14px;color:#a1243a">Neuer Schnitt<div style="font:800 26px/1.1 B;color:#e2283f;margin-top:2px">${after}</div></div>
      </div>
      <div style="font-size:13.5px;color:#8a8592;margin-top:12px">Bisher ${facts.avg} · eine 5.5 bringt dich auf ${after}</div>
    </div>
    ${note}`],

  'store-assets/screenshot-4-absences-1280x800.png': [1280, 800, `
    <div class="glow" style="width:900px;height:900px;left:-380px;bottom:-460px"></div>
    ${win('absences', { x: -120, y: 90, w: 860 })}
    <div class="abs" style="left:800px;top:120px;width:410px">
      <span class="eye">Absenzen</span>
      <h1>Keine Frist mehr <em>verpassen.</em></h1>
      <p class="sub">Offene Entschuldigungen mit Frist, Präsenz Tag für Tag und eine Erinnerung, bevor es zu spät ist.</p>
    </div>
    <div class="card" style="left:790px;top:470px;width:410px;display:flex;gap:14px;align-items:flex-start;padding:16px">
      <div style="width:40px;height:40px;flex:none">${logo.replace('<svg ', '<svg style="width:40px;height:40px" ')}</div>
      <div style="flex:1"><div style="display:flex;justify-content:space-between;font-size:13px;color:#8a8592"><b style="color:#16141d">WISS Stundenplan</b>jetzt</div>
      <div style="font-weight:700;margin-top:4px;font-size:16px">${esc(absTitle)}</div>
      <div style="font-size:14.5px;color:#5d5964;margin-top:2px">${esc(absBody)}</div></div>
    </div>
    <div class="pill" style="left:840px;top:620px"><b>✓</b>Präsenz auf einen Blick</div>
    ${note}`],

  'store-assets/screenshot-5-rooms-dark-1280x800.png': [1280, 800, `
    <div class="glow" style="width:1000px;height:1000px;right:-300px;top:-380px;background:radial-gradient(circle, rgba(232,52,78,.28), transparent 65%)"></div>
    <div class="abs" style="left:72px;top:110px;width:430px">
      <span class="eye">Freie Räume · Dunkelmodus</span>
      <h1>Freien Raum finden, <em>in Sekunden.</em></h1>
      <p class="sub">Schieb die Zeit und sieh, welche Zimmer frei sind. Hell, dunkel oder automatisch, mit deiner Farbe.</p>
      <div style="display:flex;gap:10px;margin-top:30px">${['#e2283f', '#2f6fed', '#1f8a55', '#8b5cf6', '#f59e0b'].map((c, i) => `<i style="width:34px;height:34px;border-radius:50%;background:${c};box-shadow:${i ? 'none' : '0 0 0 3px #15131a, 0 0 0 5px #e2283f'}"></i>`).join('')}</div>
    </div>
    ${win('rooms-dark', { x: 560, y: 100, w: 860, d: true })}
    <div class="card" style="left:480px;top:520px;width:330px;background:#1f1d25;color:#f3f1f6;box-shadow:0 26px 60px -18px rgba(0,0,0,.8),0 0 0 1px rgba(255,255,255,.08)">
      <div class="k" style="color:#9d98a8">Jetzt frei · 13:30</div>
      <div class="v">3 von 4 Räumen</div>
      <div style="display:flex;gap:6px;margin-top:10px">${['201', '202', '204'].map((r) => `<span style="white-space:nowrap;padding:5px 9px;border-radius:8px;background:rgba(31,138,85,.22);color:#6ee7a8;font:700 13px G">DEMO-${r}</span>`).join('')}</div>
    </div>
    <div class="foot" style="left:72px;bottom:28px;color:#6e6a78">Inoffizielles Schülerprojekt · Abbildungen mit frei erfundenen Demodaten</div>`, 'dark'],

  // ---------- promo tiles ----------
  'store-assets/promo-small-440x280.png': [440, 280, `
    <div class="blob" style="width:360px;height:360px;right:-150px;bottom:-190px"></div>
    <div class="abs" style="left:30px;top:32px">${logo.replace('<svg ', '<svg style="width:58px;height:58px;filter:drop-shadow(0 10px 18px rgba(216,31,60,.35))" ')}</div>
    <div class="abs" style="left:30px;top:112px;width:260px">
      <div style="font:800 34px/1 B;letter-spacing:-.035em">WISS<br>Stundenplan</div>
      <div style="font-size:15px;color:#5d5964;margin-top:10px;line-height:1.35">Woche, Prüfungen, Noten.<br>Ein Klick entfernt.</div>
    </div>
    ${pop('popup', { x: 300, y: 40, w: 168, rot: 6 })}`],

  'store-assets/promo-marquee-1400x560.png': [1400, 560, `
    <div class="blob" style="width:760px;height:760px;right:-200px;top:-260px"></div>
    <div class="abs" style="left:80px;top:78px;width:640px">
      ${brand(56)}
      <h1 style="font-size:66px;margin-top:40px">Dein Stundenplan.<br><em>Ohne Warten.</em></h1>
      <p class="sub" style="font-size:21px;max-width:520px">Woche, Prüfungen, Noten, Absenzen und freie Räume. Direkt in deinem Browser.</p>
    </div>
    ${win('week', { x: 760, y: 70, w: 820, rot: -3 })}
    ${pop('popup-dark', { x: 690, y: 190, w: 300, rot: 4 })}`],

  // ---------- link preview (Discord, WhatsApp, iMessage, …) ----------
  'docs/og.png': [1200, 630, `
    <div class="blob" style="width:780px;height:780px;right:-240px;top:-300px"></div>
    <div class="abs" style="left:76px;top:76px;width:560px">
      ${brand(56)}
      <h1 style="font-size:66px;margin-top:44px">Dein Stundenplan,<br><em>überall.</em></h1>
      <p class="sub" style="font-size:21px">Woche, Prüfungen, Noten, Absenzen und freie Räume. Für Chrome, Firefox, Windows, macOS, Linux, Android und iPhone.</p>
    </div>
    <div class="abs" style="left:76px;bottom:52px;font:600 18px G;color:#e2283f">stundenplan.severinwehrle.dev</div>
    ${win('week', { x: 690, y: 110, w: 760, rot: -3 })}
    ${pop('popup', { x: 650, y: 230, w: 290, rot: 4 })}`],
};

const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE });
try {
  for (const [file, [w, h, html, cls]] of Object.entries(pages)) {
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const tmp = path.join(here, '.page.html');
    fs.writeFileSync(tmp, `<!doctype html><meta charset="utf-8"><style>${CSS}</style><body class="${cls || ''}">${html}</body>`);
    await p.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(root, file) });
    await p.close();
    console.log(file);
  }
} finally { await browser.close(); fs.rmSync(path.join(here, '.page.html'), { force: true }); }
