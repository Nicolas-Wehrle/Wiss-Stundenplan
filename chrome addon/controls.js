// Custom-styled replacements for the browser's native form widgets.
// The original <select> / <input type="date"> stay in the DOM (hidden) and keep their
// id + value, so popup.js keeps working unchanged: picking something here sets the
// value and fires a normal bubbling 'change' event.
(() => {
  'use strict';
  const EN = () => window.getLang && getLang() === 'en';
  const T = (s) => (window.tr ? tr(s) : s);
  const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MONTHS = new Proxy([], { get: (_, k) => (EN() ? MONTHS_EN : MONTHS_DE)[k] });
  const WD = new Proxy([], { get: (_, k) => (EN() ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'])[k] });
  const WD_LONG = new Proxy([], { get: (_, k) => (EN() ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'])[k] });
  const SVG = 'http://www.w3.org/2000/svg';

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const icon = (d) => {
    const s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '2.2');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    s.appendChild(p);
    return s;
  };
  const I_CHEV = 'M6 9l6 6 6-6';
  const I_CAL = 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z';
  const I_LEFT = 'M15 18l-6-6 6-6';
  const I_RIGHT = 'M9 18l6-6-6-6';
  const I_CHECK = 'M5 12.5l4.5 4.5L19 7.5';

  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (k) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };

  function fire(input) { input.dispatchEvent(new Event('change', { bubbles: true })); }

  // ---------- popover (one at a time) ----------
  let open = null; // { pop, anchor, onKey, close }

  function closePop(refocus) {
    if (!open) return;
    const o = open; open = null;
    o.pop.remove();
    o.anchor.setAttribute('aria-expanded', 'false');
    o.anchor.classList.remove('open');
    if (refocus && o.anchor.isConnected) o.anchor.focus();
  }
  window.__closeCustomPopover = () => closePop(false);
  window.__customPopoverOpen = () => !!open;

  function place(pop, anchor, minWidth) {
    const r = anchor.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    pop.style.minWidth = Math.max(minWidth ? r.width : 0, 0) + 'px';
    pop.style.left = '0px'; pop.style.top = '0px';
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = Math.min(Math.max(8, r.left), vw - pw - 8);
    let top = r.bottom + 6;
    let up = false;
    if (top + ph > vh - 8 && r.top - ph - 6 > 8) { top = r.top - ph - 6; up = true; }
    if (!up && top + ph > vh - 8) pop.style.maxHeight = Math.max(140, vh - top - 8) + 'px';
    pop.style.left = Math.max(8, left) + 'px';
    pop.style.top = top + 'px';
    pop.classList.toggle('up', up);
  }

  function openPop(anchor, pop, onKey, minWidth) {
    closePop(false);
    pop.classList.add('cpop');
    document.body.appendChild(pop);
    place(pop, anchor, minWidth);
    anchor.setAttribute('aria-expanded', 'true');
    anchor.classList.add('open');
    open = { pop, anchor, onKey };
    requestAnimationFrame(() => pop.classList.add('in'));
  }

  document.addEventListener('pointerdown', (ev) => {
    if (open && !open.pop.contains(ev.target) && !open.anchor.contains(ev.target)) closePop(false);
  }, true);
  document.addEventListener('keydown', (ev) => {
    if (!open) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closePop(true); return; }
    if (ev.key === 'Tab') { closePop(false); return; }
    if (open.onKey && open.onKey(ev)) { ev.preventDefault(); ev.stopPropagation(); }
  }, true);
  window.addEventListener('resize', () => closePop(false));
  document.addEventListener('scroll', (ev) => { if (open && !open.pop.contains(ev.target)) closePop(false); }, true);

  // ---------- dropdown ----------
  function enhanceSelect(sel) {
    sel.dataset.cx = '1';
    sel.classList.add('cx-native');
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');

    const btn = el('button', 'dd');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    if (sel.id) btn.dataset.for = sel.id;
    const label = el('span', 'dd-label');
    btn.append(label, icon(I_CHEV));
    sel.after(btn);

    const sync = () => {
      const o = sel.options[sel.selectedIndex];
      label.textContent = o ? o.textContent : '';
      label.classList.toggle('ph', !o || o.value === '' && sel.options.length > 1);
      btn.disabled = sel.disabled;
    };
    sync();
    sel.addEventListener('change', sync);

    btn.addEventListener('click', () => {
      if (open && open.anchor === btn) { closePop(true); return; }
      const pop = el('div', 'dd-menu');
      pop.setAttribute('role', 'listbox');
      const items = [];
      for (const node of sel.children) {
        const group = node.tagName === 'OPTGROUP' ? node : null;
        if (group) pop.appendChild(el('div', 'dd-group', group.label));
        for (const o of group ? group.children : [node]) {
          if (o.tagName !== 'OPTION') continue;
          const it = el('div', 'dd-item' + (o.value === '' ? ' ph' : ''));
          it.setAttribute('role', 'option');
          it.append(el('span', null, o.textContent));
          if (o.selected) { it.classList.add('sel'); it.setAttribute('aria-selected', 'true'); it.appendChild(icon(I_CHECK)); }
          if (o.disabled) it.classList.add('dis');
          it._opt = o;
          items.push(it);
          pop.appendChild(it);
        }
      }
      let hi = Math.max(0, items.findIndex((i) => i.classList.contains('sel')));
      const setHi = (n) => {
        if (!items.length) return;
        hi = (n + items.length) % items.length;
        items.forEach((i, k) => i.classList.toggle('hi', k === hi));
        items[hi].scrollIntoView({ block: 'nearest' });
      };
      const choose = (it) => {
        if (!it || it._opt.disabled) return;
        closePop(true);
        if (sel.value !== it._opt.value || sel.selectedIndex !== it._opt.index) {
          sel.selectedIndex = it._opt.index;
          sync();
          fire(sel);
        }
      };
      pop.addEventListener('click', (ev) => choose(ev.target.closest('.dd-item')));
      pop.addEventListener('pointermove', (ev) => { const it = ev.target.closest('.dd-item'); if (it) setHi(items.indexOf(it)); });
      // type-ahead
      let typed = '', typedT = 0;
      openPop(btn, pop, (ev) => {
        if (ev.key === 'ArrowDown') { setHi(hi + 1); return true; }
        if (ev.key === 'ArrowUp') { setHi(hi - 1); return true; }
        if (ev.key === 'Home') { setHi(0); return true; }
        if (ev.key === 'End') { setHi(items.length - 1); return true; }
        if (ev.key === 'Enter' || ev.key === ' ') { choose(items[hi]); return true; }
        if (ev.key.length === 1) {
          const now = Date.now(); typed = (now - typedT > 700 ? '' : typed) + ev.key.toLowerCase(); typedT = now;
          const k = items.findIndex((i) => i.textContent.trim().toLowerCase().startsWith(typed));
          if (k >= 0) setHi(k);
          return true;
        }
        return false;
      }, true);
      setHi(hi);
    });
    btn.addEventListener('keydown', (ev) => {
      if (!open && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) { ev.preventDefault(); btn.click(); }
    });
  }

  // ---------- date picker ----------
  function fmtDate(k) {
    const d = parseKey(k);
    if (!d) return T('Datum wählen');
    return EN() ? `${WD_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}` : `${WD_LONG[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()].slice(0, 3)}. ${d.getFullYear()}`;
  }

  function enhanceDate(inp) {
    inp.dataset.cx = '1';
    inp.classList.add('cx-native');
    inp.tabIndex = -1;
    inp.setAttribute('aria-hidden', 'true');

    const btn = el('button', 'dd date');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    const label = el('span', 'dd-label');
    btn.append(icon(I_CAL), label);
    inp.after(btn);
    const sync = () => { label.textContent = fmtDate(inp.value); };
    sync();
    inp.addEventListener('change', sync);

    btn.addEventListener('click', () => {
      if (open && open.anchor === btn) { closePop(true); return; }
      const selKey = inp.value;
      const todayK = keyOf(new Date());
      let cur = parseKey(selKey) || new Date();
      let view = new Date(cur.getFullYear(), cur.getMonth(), 1);
      let focusK = keyOf(cur);

      const pop = el('div', 'cal');
      pop.setAttribute('role', 'dialog');
      pop.setAttribute('aria-label', T('Datum wählen'));
      const head = el('div', 'cal-head');
      const prev = el('button', 'cal-nav'); prev.type = 'button'; prev.setAttribute('aria-label', T('Vorheriger Monat')); prev.appendChild(icon(I_LEFT));
      const next = el('button', 'cal-nav'); next.type = 'button'; next.setAttribute('aria-label', T('Nächster Monat')); next.appendChild(icon(I_RIGHT));
      const title = el('div', 'cal-title');
      head.append(prev, title, next);
      const grid = el('div', 'cal-grid');
      const foot = el('div', 'cal-foot');
      const todayBtn = el('button', 'cal-today', T('Heute')); todayBtn.type = 'button';
      foot.appendChild(todayBtn);
      pop.append(head, grid, foot);

      const pick = (k) => {
        closePop(true);
        if (k && k !== inp.value) { inp.value = k; sync(); fire(inp); }
      };
      const draw = () => {
        title.textContent = `${MONTHS[view.getMonth()]} ${view.getFullYear()}`;
        grid.replaceChildren();
        for (const w of WD) grid.appendChild(el('div', 'cal-wd', w));
        const first = (view.getDay() + 6) % 7; // Monday-based
        const start = new Date(view.getFullYear(), view.getMonth(), 1 - first);
        for (let i = 0; i < 42; i++) {
          const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
          if (i === 35 && d.getMonth() !== view.getMonth()) break; // no empty 6th row
          const k = keyOf(d);
          const b = el('button', 'cal-day', String(d.getDate()));
          b.type = 'button';
          b.dataset.k = k;
          if (d.getMonth() !== view.getMonth()) b.classList.add('out');
          if (d.getDay() === 0 || d.getDay() === 6) b.classList.add('we');
          if (k === todayK) b.classList.add('today');
          if (k === selKey) { b.classList.add('sel'); b.setAttribute('aria-current', 'date'); }
          if (k === focusK) b.classList.add('hi');
          grid.appendChild(b);
        }
      };
      const move = (days) => {
        const f = parseKey(focusK);
        const n = new Date(f.getFullYear(), f.getMonth(), f.getDate() + days);
        focusK = keyOf(n);
        if (n.getMonth() !== view.getMonth() || n.getFullYear() !== view.getFullYear()) view = new Date(n.getFullYear(), n.getMonth(), 1);
        draw();
      };
      prev.addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); draw(); });
      next.addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); draw(); });
      todayBtn.addEventListener('click', () => pick(todayK));
      grid.addEventListener('click', (ev) => { const b = ev.target.closest('.cal-day'); if (b) pick(b.dataset.k); });
      draw();
      openPop(btn, pop, (ev) => {
        if (ev.key === 'ArrowLeft') { move(-1); return true; }
        if (ev.key === 'ArrowRight') { move(1); return true; }
        if (ev.key === 'ArrowUp') { move(-7); return true; }
        if (ev.key === 'ArrowDown') { move(7); return true; }
        if (ev.key === 'PageUp') { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); draw(); return true; }
        if (ev.key === 'PageDown') { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); draw(); return true; }
        if (ev.key === 'Enter') { if (document.activeElement && pop.contains(document.activeElement) && document.activeElement !== grid) return false; pick(focusK); return true; }
        return false;
      }, false);
    });
  }

  // ---------- range slider: paint the filled part ----------
  function paintRange(r) {
    const min = +r.min || 0, max = +r.max || 100;
    r.style.setProperty('--fill', ((+r.value - min) / (max - min || 1) * 100) + '%');
  }
  document.addEventListener('input', (ev) => { if (ev.target.matches && ev.target.matches('input[type=range]')) paintRange(ev.target); }, true);

  // ---------- apply to whatever popup.js renders ----------
  function scan(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll('select:not([data-cx])').forEach(enhanceSelect);
    root.querySelectorAll('input[type=date]:not([data-cx])').forEach(enhanceDate);
    root.querySelectorAll('input[type=range]').forEach(paintRange);
  }
  const mo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) scan(n);
    if (open && !open.anchor.isConnected) closePop(false);
  });
  const start = () => { scan(document.body); mo.observe(document.body, { childList: true, subtree: true }); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
