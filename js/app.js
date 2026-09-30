(function () {
'use strict';
const $app = document.getElementById('app');
const CFG = window.ADATE_CONFIG || {};

/* ------------------------------------------------------------------ helpers */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const safeImg = (u) => typeof u === 'string' && (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(u) || /^https:\/\/[^\s"'()<>]+$/.test(u));
const safeHex = (c) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : null);
const digits = (s) => String(s || '').replace(/\D/g, '');
const deepCopy = (o) => JSON.parse(JSON.stringify(o));
function fill(str, cfg) {
  return String(str || '').replace(/\{to\}/g, cfg.to || 'Hey you').replace(/\{from\}/g, cfg.from || 'me');
}
function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
}

/* ---- link packing: JSON -> deflate -> base64url (falls back to plain JSON) */
const toB64u = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromB64u = (t) => { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; const s = atob(t); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
async function pipe(bytes, stream) { const w = stream.writable.getWriter(); w.write(bytes); w.close(); return new Uint8Array(await new Response(stream.readable).arrayBuffer()); }
async function pack(cfg) {
  const raw = new TextEncoder().encode(JSON.stringify(cfg));
  if (window.CompressionStream) return 'z' + toB64u(await pipe(raw, new CompressionStream('deflate-raw')));
  return 'j' + toB64u(raw);
}
async function unpack(s) {
  const kind = s[0], bytes = fromB64u(s.slice(1));
  const raw = kind === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes;
  return JSON.parse(new TextDecoder().decode(raw));
}

/* ---- images: shrink uploads so they fit inside a link */
async function shrinkImage(file, max, q) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  let out = c.toDataURL('image/webp', q);
  if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/png');
  return out;
}
function pickFile(accept) {
  return new Promise((res) => {
    const i = h('input', { type: 'file', accept });
    i.onchange = () => res(i.files[0] || null);
    i.click();
  });
}
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } }
};

/* ------------------------------------------------------------------ config */
function newConfig(type, rel) {
  const p = PRESETS[type];
  return {
    v: 1, type, rel: rel || '', from: '', to: '', contact: '',
    title: p.title, sub: p.sub, caption: '', yay: p.yay, yaySub: p.yaySub,
    dateTitle: p.dateTitle, dateSub: p.dateSub, dateMode: p.dateMode, fixedDate: '',
    actTitle: p.actTitle, acts: p.acts.slice(), doneTitle: p.doneTitle,
    theme: p.theme, color: '#ff7ab8', clouds: true, wall: null, photo: null, photoSticker: 'cat-white',
    steps: deepCopy(p.steps), yesFx: p.yesFx,
    stickers: [
      { k: 'lib:cat-orange', x: 86, y: 12, s: 20, r: 8, f: 1 },
      { k: 'lib:heart', x: 13, y: 15, s: 13, r: -12, f: 0 },
      { k: 'lib:sparkle', x: 88, y: 46, s: 9, r: 0, f: 0 },
      { k: 'lib:cat-white', x: 17, y: 82, s: 25, r: -5, f: 0 },
      { k: 'lib:star', x: 86, y: 84, s: 12, r: 14, f: 0 }
    ]
  };
}
function sanitize(c) { // config may come from a link: never trust it
  const t = (v, n = 200) => (typeof v === 'string' ? v.slice(0, n) : '');
  const base = newConfig(PRESETS[c && c.type] ? c.type : 'custom', '');
  const o = Object.assign(base, c || {});
  ['from', 'to', 'title', 'sub', 'caption', 'yay', 'yaySub', 'dateTitle', 'dateSub', 'actTitle', 'doneTitle', 'rel'].forEach((k) => (o[k] = t(o[k])));
  o.contact = digits(o.contact).slice(0, 16);
  o.fixedDate = /^\d{4}-\d{2}-\d{2}$/.test(o.fixedDate) ? o.fixedDate : '';
  o.theme = THEMES[o.theme] ? o.theme : 'pink';
  o.color = safeHex(o.color) || '#ff7ab8';
  o.wall = safeImg(o.wall) ? o.wall : null;
  o.photo = safeImg(o.photo) ? o.photo : null;
  o.photoSticker = STICKERS[o.photoSticker] ? o.photoSticker : 'cat-white';
  o.clouds = o.clouds !== false;
  o.dateMode = o.dateMode === 'fixed' ? 'fixed' : 'pick';
  o.yesFx = ['grow', 'pulse', 'none'].includes(o.yesFx) ? o.yesFx : 'grow';
  o.acts = (Array.isArray(o.acts) ? o.acts : []).map((a) => t(a, 60)).filter(Boolean).slice(0, 12);
  o.steps = (Array.isArray(o.steps) ? o.steps : []).slice(0, 20).map((s) => ({ t: t(s && s.t), e: ['shrink', 'dodge', 'shake', 'spin', 'fade', 'none'].includes(s && s.e) ? s.e : 'none' }));
  if (!o.steps.length) o.steps = [{ t: 'Are you sure?', e: 'shrink' }];
  o.stickers = (Array.isArray(o.stickers) ? o.stickers : []).slice(0, 40).map((s) => ({
    k: typeof s.k === 'string' && ((s.k.startsWith('lib:') && STICKERS[s.k.slice(4)]) || safeImg(s.k)) ? s.k : null,
    x: clamp(+s.x || 50, -10, 110), y: clamp(+s.y || 50, -10, 110), s: clamp(+s.s || 20, 4, 90), r: clamp(+s.r || 0, -180, 180), f: s.f ? 1 : 0
  })).filter((s) => s.k);
  return o;
}

/* ------------------------------------------------------------------ the stage */
function stickerNode(st) {
  const d = h('div', { class: 'st' });
  const inner = h('div', { class: 'bob' });
  if (st.k.startsWith('lib:')) inner.innerHTML = STICKERS[st.k.slice(4)].svg;
  else inner.append(h('img', { src: st.k, alt: '', draggable: 'false' }));
  d.append(inner);
  placeSticker(d, st);
  return d;
}
function placeSticker(d, st) {
  d.style.left = st.x + '%'; d.style.top = st.y + '%'; d.style.width = st.s + '%';
  d.style.transform = `translate(-50%,-50%) rotate(${st.r || 0}deg) scaleX(${st.f ? -1 : 1})`;
}
function frameContent(cfg) {
  const f = h('div', { class: 'frame' });
  if (cfg.photo) f.append(h('img', { src: cfg.photo, alt: '' }));
  else f.innerHTML = STICKERS[cfg.photoSticker].svg;
  return f;
}
function confetti(stage) {
  const c = h('canvas', { class: 'confetti' });
  stage.append(c);
  const r = stage.getBoundingClientRect();
  c.width = r.width * 1.5; c.height = r.height * 1.5;
  const g = c.getContext('2d');
  const cols = ['#ff4d8d', '#ffd84d', '#7fd6ff', '#9be27f', '#c58bff', '#fff'];
  const ps = Array.from({ length: 110 }, () => ({ x: c.width / 2, y: c.height * 0.45, vx: rand(-9, 9), vy: rand(-16, -3), w: rand(6, 13), c: cols[(Math.random() * cols.length) | 0], a: rand(0, 6), va: rand(-.3, .3) }));
  let t = 0;
  (function tick() {
    g.clearRect(0, 0, c.width, c.height);
    ps.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += .42; p.a += p.va; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); g.restore(); });
    if (++t < 120) requestAnimationFrame(tick); else c.remove();
  })();
}

/** Builds one stage. opts.edit: static screen + draggable stickers. Otherwise plays the real flow. */
function buildStage(cfg, opts) {
  opts = opts || {};
  const th = THEMES[cfg.theme];
  const el = h('div', { class: 'stage' + (opts.edit ? ' editing' : ''), 'data-theme': cfg.theme });
  const col = safeHex(cfg.color) || '#ff7ab8';
  const vars = cfg.theme === 'custom'
    ? { '--sky': `linear-gradient(color-mix(in srgb,${col} 30%,#fff),${col})`, '--accent': col, '--accent2': `color-mix(in srgb,${col} 65%,#000)`, '--ink': `color-mix(in srgb,${col} 30%,#000)` }
    : { '--sky': th.sky, '--accent': th.accent, '--accent2': th.accent2, '--ink': th.ink };
  vars['--font'] = th.font;
  for (const k in vars) el.style.setProperty(k, vars[k]);

  const wall = h('div', { class: 'wall' });
  if (cfg.wall) wall.style.backgroundImage = `url("${cfg.wall}")`;
  el.append(wall);
  if (!cfg.wall) {
    if (th.sky2) el.append(h('div', { class: 'sky2', html: '' }, ''));
    if (th.sky2) el.querySelector('.sky2').innerHTML = th.sky2();
    el.append(h('div', { class: 'scene' })); el.querySelector('.scene').innerHTML = th.scene();
  }
  if (cfg.clouds) {
    const cl = h('div', { class: 'clouds' });
    [[6, 46, 0], [22, 62, -20], [48, 54, -35], [70, 70, -8]].forEach(([top, dur, delay], i) => {
      const s = h('span'); s.innerHTML = `<svg viewBox="-16 -30 90 62" xmlns="http://www.w3.org/2000/svg">${th.cloud(0, 0, 1, th.cloudColor)}</svg>`;
      const svg = s.firstChild; svg.style.top = top + '%'; svg.style.animationDuration = dur + 's'; svg.style.animationDelay = delay + 's'; svg.style.transform = i % 2 ? 'scale(.8)' : '';
      cl.append(svg);
    });
    el.append(cl);
  }
  const deco = h('div', { class: 'deco' });
  const em = cfg.theme === 'minecraft' ? ['🟩', '⬜', '✨'] : cfg.theme === 'night' ? ['✨', '⭐', '💜'] : ['💗', '✨', '💖'];
  for (let i = 0; i < 7; i++) deco.append(h('i', { style: `left:${8 + i * 13}%;animation-delay:${-i * 1.7}s;animation-duration:${8 + (i % 3) * 2}s` }, em[i % em.length]));
  el.append(deco);

  const content = h('div', { class: 'content' });
  const stickers = h('div', { class: 'stickers' });
  el.append(content, stickers);

  /* ---- sticker layer */
  const nodes = [];
  cfg.stickers.forEach((st, i) => {
    const n = stickerNode(st);
    n.style.zIndex = i;
    nodes.push(n);
    stickers.append(n);
    if (opts.edit) {
      n.addEventListener('pointerdown', (e) => {
        e.preventDefault(); n.setPointerCapture(e.pointerId);
        opts.onSelect && opts.onSelect(i);
        const rect = el.getBoundingClientRect();
        const sx = e.clientX, sy = e.clientY, ox = st.x, oy = st.y;
        const move = (ev) => { st.x = clamp(ox + (ev.clientX - sx) / rect.width * 100, -5, 105); st.y = clamp(oy + (ev.clientY - sy) / rect.height * 100, -5, 105); placeSticker(n, st); };
        const up = () => { n.removeEventListener('pointermove', move); n.removeEventListener('pointerup', up); n.removeEventListener('pointercancel', up); opts.onChange && opts.onChange(); };
        n.addEventListener('pointermove', move); n.addEventListener('pointerup', up); n.addEventListener('pointercancel', up);
      });
      if (opts.sel === i) n.classList.add('sel');
    }
  });

  /* ---- screens */
  const state = { date: cfg.dateMode === 'fixed' ? cfg.fixedDate : '', act: '' };
  const F = (s) => fill(s, cfg);
  const T = (cls, tag, text) => h(tag, { class: cls }, F(text));

  function screenAsk() {
    let noCount = 0, noScale = 1, yesScale = 1, tx = 0, ty = 0, rot = 0, fade = 1;
    const cap = h('p', { class: 'nocap' }, ' ');
    const yes = h('button', { class: 'gbtn yes' }, 'YES ✦');
    const no = h('button', { class: 'gbtn no' }, 'No');
    const apply = () => { no.style.transform = `translate(${tx}px,${ty}px) scale(${noScale}) rotate(${rot}deg)`; no.style.opacity = fade; yes.style.transform = `scale(${yesScale})`; btns.style.margin = `${3 + (yesScale - 1) * 7}cqw 0 ${(yesScale - 1) * 7}cqw`; };
    const btns = h('div', { class: 'btns' }, yes, no);
    yes.onclick = () => go('yay');
    no.onclick = () => {
      const step = cfg.steps[Math.min(noCount, cfg.steps.length - 1)];
      noCount++;
      cap.textContent = F(step.t) || ' ';
      if (step.e === 'shrink') noScale = Math.max(.35, noScale * .72);
      else if (step.e === 'fade') fade = Math.max(.25, fade * .6);
      else if (step.e === 'spin') { rot += 360; }
      else if (step.e === 'shake') no.animate([{ translate: '0' }, { translate: '-2.5cqw' }, { translate: '2.5cqw' }, { translate: '-2cqw' }, { translate: '2cqw' }, { translate: '0' }], { duration: 420 });
      else if (step.e === 'dodge') {
        const S = el.getBoundingClientRect(), b = no.getBoundingClientRect();
        const left = S.left + rand(8, Math.max(9, S.width - b.width - 8));
        const top = S.top + S.height * .3 + rand(0, Math.max(1, S.height * .6 - b.height));
        tx += left - b.left; ty += top - b.top;
      }
      if (cfg.yesFx === 'grow') yesScale = Math.min(2.4, yesScale + .3);
      else if (cfg.yesFx === 'pulse') yes.animate([{ scale: 1 }, { scale: 1.25 }, { scale: 1 }], { duration: 380 });
      apply();
    };
    return [frameContent(cfg), T('title', 'h1', cfg.title), cfg.sub ? T('subt', 'p', cfg.sub) : null, cfg.caption ? T('caption', 'p', cfg.caption) : null,
      btns, cap];
  }
  function screenYay() {
    setTimeout(() => confetti(el), 60);
    return [frameContent(cfg), T('title', 'h1', cfg.yay), T('sub2', 'p', cfg.yaySub), h('button', { class: 'gbtn', onclick: () => go(cfg.dateMode === 'fixed' ? 'act' : 'date') }, 'Continue →')];
  }
  function screenDate() {
    const inp = h('input', { type: 'date', min: new Date().toISOString().slice(0, 10), value: state.date });
    const next = h('button', { class: 'gbtn', disabled: !state.date, onclick: () => go('act') }, 'Next →');
    inp.oninput = () => { state.date = inp.value; next.disabled = !inp.value; };
    return [h('div', { class: 'frame', style: 'width:26cqw' }, ''), T('title', 'h1', cfg.dateTitle), cfg.dateSub ? T('sub2', 'p', cfg.dateSub) : null, h('div', { class: 'datebox' }, inp), h('div', { style: 'height:5cqw' }), next]
      .map((n, i) => { if (i === 0) { n.innerHTML = STICKERS['cat-happy'].svg; } return n; });
  }
  function screenAct() {
    if (!cfg.acts.length) return screenDone();
    const grid = h('div', { class: 'opts' });
    const lock = h('button', { class: 'gbtn', disabled: !state.act, onclick: () => go('done') }, 'Lock it in 🔒');
    cfg.acts.forEach((a) => {
      const b = h('button', { class: 'opt', 'aria-pressed': state.act === a ? 'true' : 'false' }, a);
      b.onclick = () => { state.act = a; grid.querySelectorAll('.opt').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); lock.disabled = false; };
      grid.append(b);
    });
    return [T('title', 'h1', cfg.actTitle), grid, lock];
  }
  function screenDone() {
    setTimeout(() => confetti(el), 60);
    const label = cfg.type === 'birthday' ? 'Bringing' : cfg.type === 'coffee' ? 'Order' : 'Plan';
    const t = h('div', { class: 'ticket' });
    if (state.date) t.append(h('div', null, h('b', null, 'DATE: '), fmtDate(state.date)));
    if (state.act) t.append(h('div', null, h('b', null, label.toUpperCase() + ': '), state.act));
    const msg = `${F('{to}')} said YES! 🎉\n${state.date ? 'Date: ' + fmtDate(state.date) + '\n' : ''}${state.act ? label + ': ' + state.act : ''}`.trim();
    const send = h('button', { class: 'gbtn', onclick: async () => {
      const phone = digits(cfg.contact);
      if (phone) return window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
      try { if (navigator.share) return await navigator.share({ text: msg }); } catch (e) { return; }
      try { await navigator.clipboard.writeText(msg); send.textContent = 'Copied! Paste it to them 💌'; } catch (e) { send.textContent = 'Screenshot this page 📸'; }
    } }, 'Send my answer 💌');
    return [frameContent(cfg), T('title', 'h1', cfg.doneTitle), (state.date || state.act) ? t : null, send];
  }
  const screens = { ask: screenAsk, yay: screenYay, date: screenDate, act: screenAct, done: screenDone };
  function go(name) {
    content.replaceChildren(...screens[name]().filter(Boolean));
    content.style.animation = 'none'; void content.offsetWidth; content.style.animation = '';
  }
  if (opts.edit) {
    const s = opts.screen || 'ask';
    if (s === 'done') { state.date = state.date || (cfg.dateMode === 'fixed' ? cfg.fixedDate : new Date(Date.now() + 864e5 * 5).toISOString().slice(0, 10)); state.act = cfg.acts[0] || ''; }
    if (s === 'date') { /* empty date shows placeholder */ }
    go(s);
  } else go('ask');
  return { el, go };
}

/* ------------------------------------------------------------------ viewer */
async function viewer(data) {
  let cfg;
  try { cfg = sanitize(await unpack(data)); } catch (e) {
    $app.replaceChildren(h('div', { class: 'viewer' }, h('div', { class: 'err' }, h('h2', null, 'This link looks broken 🥲'), h('p', null, 'Ask the sender to share it again.'), h('a', { href: '#/', style: 'color:#ffb3dd' }, 'Make your own'))));
    return;
  }
  document.title = fill(cfg.title, cfg).slice(0, 60);
  const { el } = buildStage(cfg);
  $app.replaceChildren(h('div', { class: 'viewer' }, el));
}

/* ------------------------------------------------------------------ home */
function home() {
  document.title = 'ADate – Make a cute invite';
  document.body.removeAttribute('data-tab');
  let rel = null;
  const draft = store.get('adate.draft', null);
  const step2 = h('div');
  const relRow = h('div', { class: 'row' });
  function drawTypes() {
    step2.replaceChildren();
    if (!rel) return;
    const allowed = RELATIONS.find((r) => r[0] === rel)[2];
    step2.append(h('h2', null, '2. What is the occasion?'),
      h('div', { class: 'cards' }, PRESET_ORDER.filter((k) => allowed.includes(k)).map((k) => {
        const p = PRESETS[k];
        return h('button', { class: 'card', onclick: () => { store.set('adate.draft', newConfig(k, rel)); location.hash = '#/make'; } },
          h('span', { class: 'em' }, p.emoji), h('b', null, p.label), h('small', null, p.blurb));
      })));
  }
  RELATIONS.forEach(([id, label]) => {
    const b = h('button', { class: 'chip', 'aria-pressed': 'false', onclick: () => { rel = id; relRow.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === b ? 'true' : 'false')); drawTypes(); } }, label);
    relRow.append(b);
  });
  $app.replaceChildren(h('div', { class: 'wrap' },
    h('div', { class: 'brand' }, '🐱 ', h('span', null, 'A', h('b', null, 'Date'))),
    h('div', { class: 'hero' }, h('h1', null, 'Make a cute little invite for your person.'), h('p', null, 'Pick the vibe, add their name, drop in stickers, then send them the link. The "No" button has a mind of its own 😌')),
    draft ? h('div', { class: 'panel' }, h('h2', null, 'Pick up where you left off'), h('button', { class: 'btn pri', onclick: () => (location.hash = '#/make') }, 'Continue my invite →')) : null,
    h('div', { class: 'panel' }, h('h2', null, '1. Who is it for?'), relRow, h('div', { style: 'height:16px' }), step2),
    h('div', { class: 'foot' }, 'Free forever · no sign-up · your invite lives inside the link')));
}

/* ------------------------------------------------------------------ editor */
function editor() {
  document.title = 'ADate – Editor';
  let cfg = store.get('adate.draft', null);
  if (!cfg) { location.hash = '#/'; return; }
  cfg = sanitize(cfg);
  let sel = null, mode = 'edit', screen = 'ask', tab = 'edit';
  document.body.setAttribute('data-tab', tab);

  const pv = h('div', { class: 'stagewrap' });
  const save = () => store.set('adate.draft', cfg);
  function refresh() {
    let inst;
    if (mode === 'edit') inst = buildStage(cfg, { edit: true, screen, sel, onSelect: (i) => { sel = i; refreshSticker(); markSel(); }, onChange: save });
    else inst = buildStage(cfg, {});
    pv.replaceChildren(inst.el);
    screenRow.classList.toggle('hidden', mode !== 'edit');
  }
  function markSel() { pv.querySelectorAll('.st').forEach((n, i) => n.classList.toggle('sel', i === sel)); }
  function change() { save(); refresh(); }

  /* --- field helpers */
  const text = (label, key, o) => {
    o = o || {};
    const inp = o.area ? h('textarea') : h('input', { type: o.type || 'text', maxlength: o.max || 120, placeholder: o.ph || '' });
    inp.value = o.get ? o.get() : cfg[key];
    inp.oninput = () => { if (o.set) o.set(inp.value); else cfg[key] = inp.value; change(); };
    return h('label', { class: 'f' }, label, o.hint ? h('small', null, o.hint) : null, inp);
  };
  const upload = async (accept, max, q) => { const f = await pickFile(accept); return f ? shrinkImage(f, max, q) : null; };

  /* --- sections */
  const secNames = h('details', { class: 'sec', open: '' }, h('summary', null, '👤 Names'),
    h('div', { class: 'body' },
      text('Your name', 'from', { ph: 'e.g. Sam' }), text('Their name', 'to', { ph: 'e.g. Lina' }),
      text('Your WhatsApp number (optional)', 'contact', { type: 'tel', max: 20, ph: '96170123456', hint: 'Their answer is sent straight to you. It will be visible inside the link, so leave it empty if you prefer.' })));

  const secWords = h('details', { class: 'sec' }, h('summary', null, '✏️ Words'));
  const wordsBody = h('div', { class: 'body' });
  function drawWords() {
    wordsBody.replaceChildren(
      h('p', { class: 'hint' }, 'Use {to} and {from} to insert the names.'),
      text('Big question', 'title'), text('Line under it', 'sub'), text('Extra line (pet name, place, inside joke…)', 'caption'),
      text('When they say yes: headline', 'yay'), text('When they say yes: message', 'yaySub'),
      h('label', { class: 'f' }, 'Day',
        h('select', { onchange: (e) => { cfg.dateMode = e.target.value; drawWords(); change(); } },
          h('option', { value: 'pick', selected: cfg.dateMode === 'pick' }, 'They pick the day'), h('option', { value: 'fixed', selected: cfg.dateMode === 'fixed' }, 'I set the day'))),
      cfg.dateMode === 'fixed' ? text('The day', 'fixedDate', { type: 'date' }) : text('Day screen: title', 'dateTitle'),
      cfg.dateMode === 'fixed' ? null : text('Day screen: line', 'dateSub'),
      text('Options screen: title', 'actTitle'),
      text('Options (one per line)', 'acts', { area: true, max: 600, get: () => cfg.acts.join('\n'), set: (v) => (cfg.acts = v.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 12)) }),
      text('Final screen: title', 'doneTitle'));
  }
  secWords.append(wordsBody); drawWords();

  const secPic = h('details', { class: 'sec' }, h('summary', null, '🖼️ Main picture'));
  const picBody = h('div', { class: 'body' });
  function drawPic() {
    const g = h('div', { class: 'grid' });
    STICKER_ORDER.filter((id) => id.startsWith('cat') || ['bear', 'bunny'].includes(id)).forEach((id) => {
      const b = h('button', { class: 'tile', 'aria-pressed': !cfg.photo && cfg.photoSticker === id ? 'true' : 'false', title: STICKERS[id].name, onclick: () => { cfg.photoSticker = id; cfg.photo = null; drawPic(); change(); } });
      b.innerHTML = STICKERS[id].svg; g.append(b);
    });
    picBody.replaceChildren(h('p', { class: 'hint' }, 'Shown in the frame on every screen. Pick one of mine, or upload their photo, an anime you both like, their pet or their place.'), g,
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: async () => { const d = await upload('image/*', 240, .75); if (d) { cfg.photo = d; drawPic(); change(); } } }, '⬆ Upload picture'),
        cfg.photo ? h('button', { class: 'btn sm danger', onclick: () => { cfg.photo = null; drawPic(); change(); } }, 'Remove') : null));
  }
  secPic.append(picBody); drawPic();

  const secLook = h('details', { class: 'sec' }, h('summary', null, '🎨 Look & wallpaper'));
  const lookBody = h('div', { class: 'body' });
  function drawLook() {
    lookBody.replaceChildren(
      h('div', { class: 'row' }, THEME_ORDER.map((id) => h('button', { class: 'chip', 'aria-pressed': cfg.theme === id ? 'true' : 'false', onclick: () => { cfg.theme = id; drawLook(); change(); } }, THEMES[id].emoji + ' ' + THEMES[id].name))),
      cfg.theme === 'custom' ? h('label', { class: 'f' }, 'Pick your colour', h('input', { type: 'color', value: cfg.color, oninput: (e) => { cfg.color = e.target.value; change(); } })) : null,
      h('label', { class: 'row', style: 'align-items:center;gap:10px' }, h('input', { type: 'checkbox', checked: cfg.clouds, onchange: (e) => { cfg.clouds = e.target.checked; change(); } }), 'Floating clouds'),
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: async () => { const d = await upload('image/*', 520, .6); if (d) { cfg.wall = d; drawLook(); change(); } } }, '⬆ Upload my own wallpaper'),
        cfg.wall ? h('button', { class: 'btn sm danger', onclick: () => { cfg.wall = null; drawLook(); change(); } }, 'Remove wallpaper') : null),
      h('p', { class: 'hint' }, 'Uploaded images travel inside the link, so they are shrunk to keep it short.'));
  }
  secLook.append(lookBody); drawLook();

  const secNo = h('details', { class: 'sec' }, h('summary', null, '😈 The "No" button'));
  const noBody = h('div', { class: 'body' });
  const FX = [['shrink', 'Gets smaller'], ['dodge', 'Runs away'], ['shake', 'Shakes'], ['spin', 'Spins'], ['fade', 'Fades a bit'], ['none', 'Nothing']];
  function drawNo() {
    const list = h('div', { class: 'col', style: 'align-items:stretch' });
    cfg.steps.forEach((s, i) => {
      const last = i === cfg.steps.length - 1;
      list.append(h('div', { class: 'stepbox' },
        h('div', { class: 'n' }, last ? `Press ${i + 1} and every press after` : `Press ${i + 1}`),
        h('div', { class: 'r' }, h('input', { type: 'text', maxlength: 90, value: s.t, placeholder: 'What it says', oninput: (e) => { s.t = e.target.value; save(); } }),
          h('select', { onchange: (e) => { s.e = e.target.value; save(); } }, FX.map(([v, l]) => h('option', { value: v, selected: s.e === v }, l)))),
        cfg.steps.length > 1 ? h('div', null, h('button', { class: 'btn sm danger', onclick: () => { cfg.steps.splice(i, 1); drawNo(); change(); } }, 'Delete this press')) : null));
    });
    noBody.replaceChildren(
      h('p', { class: 'hint' }, 'Decide what each press on "No" does. The last one repeats forever. "No" never lets them continue: only YES does.'),
      list,
      h('button', { class: 'btn sm', onclick: () => { cfg.steps.push({ t: '', e: 'shrink' }); drawNo(); change(); } }, '+ Add another press'),
      h('label', { class: 'f' }, 'What happens to YES on each "No" press',
        h('select', { onchange: (e) => { cfg.yesFx = e.target.value; change(); } }, [['grow', 'It grows bigger'], ['pulse', 'It bounces'], ['none', 'Nothing']].map(([v, l]) => h('option', { value: v, selected: cfg.yesFx === v }, l)))),
      h('button', { class: 'btn sm', onclick: () => { mode = 'play'; syncMode(); refresh(); } }, '▶ Try it'));
  }
  secNo.append(noBody); drawNo();

  /* --- stickers */
  const secSt = h('details', { class: 'sec' }, h('summary', null, '🐱 Stickers'));
  const stBody = h('div', { class: 'body' });
  const selBox = h('div', { class: 'stepbox' });
  function refreshSticker() {
    selBox.classList.toggle('hidden', sel == null || !cfg.stickers[sel]);
    if (sel == null || !cfg.stickers[sel]) return;
    const st = cfg.stickers[sel];
    const upd = () => { placeSticker(pv.querySelectorAll('.st')[sel], st); save(); };
    selBox.replaceChildren(h('div', { class: 'n' }, 'Selected sticker'),
      h('label', { class: 'f' }, 'Size', h('input', { type: 'range', min: 5, max: 70, value: st.s, oninput: (e) => { st.s = +e.target.value; upd(); } })),
      h('label', { class: 'f' }, 'Tilt', h('input', { type: 'range', min: -90, max: 90, value: st.r, oninput: (e) => { st.r = +e.target.value; upd(); } })),
      h('div', { class: 'row' },
        h('button', { class: 'btn sm', onclick: () => { st.f = st.f ? 0 : 1; upd(); } }, '↔ Flip'),
        h('button', { class: 'btn sm', onclick: () => { cfg.stickers.push(cfg.stickers.splice(sel, 1)[0]); sel = cfg.stickers.length - 1; change(); refreshSticker(); } }, '⬆ Bring to front'),
        h('button', { class: 'btn sm danger', onclick: () => removeSel() }, '🗑 Delete')));
  }
  function removeSel() { if (sel == null) return; cfg.stickers.splice(sel, 1); sel = null; change(); refreshSticker(); }
  function addSticker(k) {
    cfg.stickers.push({ k, x: rand(30, 70), y: rand(30, 70), s: 22, r: 0, f: 0 });
    sel = cfg.stickers.length - 1; mode = 'edit'; syncMode(); change(); refreshSticker();
  }
  const libGrid = h('div', { class: 'grid' }), myGrid = h('div', { class: 'grid' }), netGrid = h('div', { class: 'grid' });
  STICKER_ORDER.forEach((id) => { const b = h('button', { class: 'tile', title: STICKERS[id].name, onclick: () => addSticker('lib:' + id) }); b.innerHTML = STICKERS[id].svg; libGrid.append(b); });
  function drawMine() {
    const mine = store.get('adate.mystickers', []);
    myGrid.replaceChildren(...mine.map((u, i) => {
      const b = h('button', { class: 'tile', title: 'Add (right-click / long-press to remove)', onclick: () => addSticker(u), oncontextmenu: (e) => { e.preventDefault(); store.set('adate.mystickers', mine.filter((_, j) => j !== i)); drawMine(); } }, h('img', { src: u, alt: '' }));
      return b;
    }));
  }
  drawMine();
  const q = h('input', { type: 'text', placeholder: 'Search stickers online (cat, love, coffee…)' });
  async function searchNet() {
    const term = q.value.trim(); if (!term) return;
    if (!CFG.tenorKey) { netGrid.replaceChildren(h('p', { class: 'note', style: 'grid-column:1/-1' }, 'Online search is switched off. To turn it on for free, put a Tenor API key in config.js (see README).')); return; }
    netGrid.replaceChildren(h('p', { class: 'hint', style: 'grid-column:1/-1' }, 'Searching…'));
    try {
      const r = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(term)}&key=${encodeURIComponent(CFG.tenorKey)}&client_key=adate&searchfilter=sticker&media_filter=tinygif_transparent,tinygif&limit=24`);
      const j = await r.json();
      netGrid.replaceChildren(...(j.results || []).map((x) => {
        const u = (x.media_formats.tinygif_transparent || x.media_formats.tinygif || {}).url;
        return u && safeImg(u) ? h('button', { class: 'tile', onclick: () => addSticker(u) }, h('img', { src: u, alt: '', loading: 'lazy' })) : null;
      }).filter(Boolean));
      if (!netGrid.children.length) netGrid.append(h('p', { class: 'hint' }, 'Nothing found.'));
    } catch (e) { netGrid.replaceChildren(h('p', { class: 'note', style: 'grid-column:1/-1' }, 'Search failed. Check your connection.')); }
  }
  q.onkeydown = (e) => { if (e.key === 'Enter') searchNet(); };
  stBody.append(
    h('p', { class: 'hint' }, 'Tap a sticker to add it, then drag it on the preview. Drag to move, use the sliders to resize.'),
    selBox, h('div', { class: 'n' , style:'font-weight:700'}, 'My stickers'),
    h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: async () => { const d = await upload('image/*', 160, .8); if (!d) return; const mine = store.get('adate.mystickers', []); mine.unshift(d); store.set('adate.mystickers', mine.slice(0, 30)); drawMine(); addSticker(d); } }, '⬆ Upload a sticker (transparent PNG works best)')),
    myGrid, h('div', { style: 'font-weight:700' }, 'Search online'), h('div', { class: 'row', style: 'flex-wrap:nowrap' }, q, h('button', { class: 'btn sm', onclick: searchNet }, 'Search')), netGrid,
    h('div', { style: 'font-weight:700' }, 'Ready-made'), libGrid);
  secSt.append(stBody); refreshSticker();

  /* --- share */
  const secShare = h('details', { class: 'sec', open: '' }, h('summary', null, '🔗 Send it'));
  const shareBody = h('div', { class: 'body' });
  async function makeLink() {
    const warn = [];
    if (!cfg.to.trim()) warn.push("You haven't written their name yet.");
    const data = await pack(cfg);
    const url = location.href.split('#')[0] + '#/v/' + data;
    const pct = clamp(url.length / 20000 * 100, 4, 100);
    const inp = h('input', { type: 'text', readonly: '', value: url, onfocus: (e) => e.target.select() });
    const msg = `${cfg.from ? cfg.from + ' made this for you 💌' : 'Someone made this for you 💌'}\n${url}`;
    shareBody.replaceChildren(
      warn.length ? h('div', { class: 'note' }, warn.join(' ')) : null,
      h('div', { class: 'sharebox' }, inp,
        h('div', { class: 'meter' }, h('i', { style: `width:${pct}%;${pct > 60 ? 'background:#e4572e' : ''}` })),
        h('p', { class: 'hint' }, `Link length: ${url.length.toLocaleString()} characters.` + (url.length > 9000 ? ' That is long: some chat apps may cut it. Use a smaller wallpaper/fewer uploads.' : ' Nice and short.')),
        h('div', { class: 'row' },
          h('button', { class: 'btn pri', onclick: async (e) => { try { await navigator.clipboard.writeText(url); e.target.textContent = 'Copied ✓'; } catch (x) { inp.select(); } } }, 'Copy link'),
          h('a', { class: 'btn', href: 'https://wa.me/?text=' + encodeURIComponent(msg), target: '_blank', rel: 'noopener' }, 'WhatsApp'),
          navigator.share ? h('button', { class: 'btn', onclick: () => navigator.share({ text: msg }).catch(() => {}) }, 'Share…') : null,
          h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener' }, 'Open as them ↗'))));
  }
  shareBody.append(h('p', { class: 'hint' }, 'When you are happy with the preview, make the link and send it.'), h('button', { class: 'btn pri', onclick: makeLink }, 'Create my link'));
  secShare.append(shareBody);

  /* --- preview toolbar */
  const modeBtns = {
    edit: h('button', { class: 'chip', onclick: () => { mode = 'edit'; syncMode(); refresh(); } }, '✋ Edit view'),
    play: h('button', { class: 'chip', onclick: () => { mode = 'play'; syncMode(); refresh(); } }, '▶ Test it')
  };
  const screenRow = h('div', { class: 'pvtools' }, [['ask', 'Ask'], ['yay', 'Yay'], ['date', 'Day'], ['act', 'Options'], ['done', 'Final']].map(([id, l]) =>
    h('button', { class: 'chip', 'data-s': id, 'aria-pressed': id === screen ? 'true' : 'false', onclick: () => { screen = id; screenRow.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.s === id ? 'true' : 'false')); refresh(); } }, l)));
  function syncMode() { for (const k in modeBtns) modeBtns[k].setAttribute('aria-pressed', mode === k ? 'true' : 'false'); }
  syncMode();

  const tabs = h('div', { class: 'tabs' }, ['edit', 'preview'].map((t) => h('button', { class: 'chip', 'aria-pressed': t === tab ? 'true' : 'false', onclick: (e) => { tab = t; document.body.setAttribute('data-tab', t); tabs.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === e.currentTarget ? 'true' : 'false')); } }, t === 'edit' ? '✏️ Edit' : '👀 Preview')));

  $app.replaceChildren(h('div', { class: 'editor' },
    h('div', { class: 'side' },
      h('div', { class: 'top' }, h('a', { class: 'brand', href: '#/', style: 'margin:0;text-decoration:none;color:inherit' }, '🐱 A', h('b', null, 'Date')),
        h('span', { class: 'hint' }, PRESETS[cfg.type].emoji + ' ' + PRESETS[cfg.type].label), h('button', { class: 'btn sm', onclick: () => { if (confirm('Start over? Your current invite will be cleared.')) { store.set('adate.draft', null); location.hash = '#/'; } } }, 'Start over')),
      secNames, secWords, secPic, secLook, secNo, secSt, secShare),
    h('div', { class: 'pv' }, h('div', { class: 'pvtools' }, modeBtns.edit, modeBtns.play), screenRow, pv)), tabs);
  refresh();

  const onKey = (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) removeSel(); };
  document.addEventListener('keydown', onKey);
  editor.cleanup = () => document.removeEventListener('keydown', onKey);
}

/* ------------------------------------------------------------------ router */
async function route() {
  if (editor.cleanup) { editor.cleanup(); editor.cleanup = null; }
  const hash = location.hash || '#/';
  document.body.removeAttribute('data-tab');
  if (hash.startsWith('#/v/')) return viewer(hash.slice(4));
  if (hash === '#/make') return editor();
  return home();
}
window.addEventListener('hashchange', route);
route();
})();
