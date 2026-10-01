(function () {
'use strict';
const $app = document.getElementById('app');
const CFG = window.ADATE_CONFIG || {};
const GITHUB = CFG.githubUrl || 'https://github.com/moemenakari/adate';

/* ------------------------------------------------------------------ helpers */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const safeImg = (u) => typeof u === 'string' && u.length < 600000 && (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(u) || /^https:\/\/[^\s"'()<>]+$/.test(u));
const safeHex = (c) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : null);
const digits = (s) => String(s || '').replace(/\D/g, '');
const deepCopy = (o) => JSON.parse(JSON.stringify(o));
const fill = (str, cfg) => String(str || '').replace(/\{to\}/g, cfg.to || 'Hey you').replace(/\{from\}/g, cfg.from || 'me');
const svgIcon = (id) => (STICKERS[id] || STICKERS['cat-white']).svg;
function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }) : (iso || '');
}
function fmtTime(t) {
  const m = /^(\d{2}):(\d{2})$/.exec(t || ''); if (!m) return '';
  const hh = +m[1]; return `${((hh + 11) % 12) + 1}:${m[2]} ${hh < 12 ? 'AM' : 'PM'}`;
}
function daysUntil(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((new Date(+m[1], +m[2] - 1, +m[3]) - t) / 864e5));
}
function pickupText(tpl, iso) {
  const d = daysUntil(iso); if (d == null) return '';
  return String(tpl || '').replace(/\{days\}\s*days?/gi, d === 1 ? '1 day' : d + ' days').replace(/\{days\}/g, d);
}
const ago = (iso) => { const s = (Date.now() - new Date(iso)) / 1000; if (!iso || isNaN(s)) return ''; if (s < 90) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago'; return Math.round(s / 86400) + ' d ago'; };

const COUNTRIES = [['961', '🇱🇧 Lebanon +961'], ['966', '🇸🇦 Saudi Arabia +966'], ['971', '🇦🇪 UAE +971'], ['974', '🇶🇦 Qatar +974'], ['965', '🇰🇼 Kuwait +965'], ['973', '🇧🇭 Bahrain +973'], ['968', '🇴🇲 Oman +968'], ['962', '🇯🇴 Jordan +962'], ['963', '🇸🇾 Syria +963'], ['964', '🇮🇶 Iraq +964'], ['20', '🇪🇬 Egypt +20'], ['90', '🇹🇷 Turkey +90'], ['357', '🇨🇾 Cyprus +357'], ['33', '🇫🇷 France +33'], ['49', '🇩🇪 Germany +49'], ['44', '🇬🇧 UK +44'], ['1', '🇺🇸 USA / Canada +1'], ['55', '🇧🇷 Brazil +55'], ['61', '🇦🇺 Australia +61'], ['46', '🇸🇪 Sweden +46'], ['39', '🇮🇹 Italy +39'], ['34', '🇪🇸 Spain +34']];
// Lebanese numbers: just the 8 digits (03 123 456 or 70 123 456). Others: country code + number.
const IG_BAD = ['p', 'reel', 'reels', 'explore', 'accounts', 'stories', 'direct', 'tv'];
function igHandle(s) { // "@sam.lee", "sam.lee" or an instagram.com link -> "sam.lee" (format only: we cannot check the account exists from the browser)
  let t = String(s || '').trim();
  const m = t.match(/instagram\.com\/([^/?#\s]+)/i); if (m) t = m[1];
  t = t.replace(/^@/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(t) && !/^\.+$/.test(t) && !IG_BAD.includes(t.toLowerCase()) ? t : '';
}
/** "WhatsApp number or Instagram" picker. onChange gets { kind, cc, phone, ig, contact } where contact is '' until it is valid. */
function contactPicker(init, onChange) {
  const st = { kind: init.kind === 'ig' ? 'ig' : 'wa', cc: COUNTRIES.some((c) => c[0] === init.cc) ? init.cc : '961', phone: digits(init.phone), ig: init.ig || '' };
  const out = () => ({ kind: st.kind, cc: st.cc, phone: digits(st.phone), ig: st.ig, contact: st.kind === 'wa' ? normalizePhone(st.cc, st.phone) : (igHandle(st.ig) ? '@' + igHandle(st.ig) : '') });
  const status = h('p', { class: 'hint' });
  const sel = h('select', { style: 'flex:0 0 46%', 'aria-label': 'Country' }, COUNTRIES.map(([c, l]) => h('option', { value: c, selected: c === st.cc }, l)));
  const tel = h('input', { type: 'tel', inputmode: 'numeric', maxlength: 16, value: st.phone, 'aria-label': 'WhatsApp number' });
  const row = h('div', { class: 'fieldrow' }, sel, tel);
  const igIn = h('input', { type: 'text', maxlength: 80, value: st.ig, placeholder: '@username or instagram.com/username', autocapitalize: 'none', autocomplete: 'off', spellcheck: false, 'aria-label': 'Instagram account' });
  const chips = h('div', { class: 'row' });
  const paint = () => {
    const o = out(); row.style.display = st.kind === 'wa' ? '' : 'none'; igIn.style.display = st.kind === 'ig' ? '' : 'none';
    tel.placeholder = st.cc === '961' ? '70 123 456' : 'number';
    [...chips.children].forEach((c) => c.setAttribute('aria-pressed', c.dataset.k === st.kind ? 'true' : 'false'));
    const raw = st.kind === 'wa' ? st.phone : st.ig.trim();
    status.textContent = !raw ? (st.kind === 'wa' ? (st.cc === '961' ? 'Lebanon: just the 8 digits.' : 'Number without the country code.') : 'The account name or its link.') : o.contact ? '✓ ' + (st.kind === 'wa' ? '+' + o.contact : o.contact + ' · instagram.com/' + o.contact.slice(1)) : '✗ That doesn’t look right yet.';
    status.style.color = raw && !o.contact ? '#c0392b' : '';
    onChange && onChange(o);
  };
  [['wa', '💬 WhatsApp'], ['ig', '📸 Instagram']].forEach(([k, l]) => chips.append(h('button', { class: 'chip', type: 'button', 'data-k': k, onclick: () => { st.kind = k; paint(); } }, l)));
  tel.oninput = () => { st.phone = tel.value; paint(); }; sel.onchange = () => { st.cc = sel.value; paint(); }; igIn.oninput = () => { st.ig = igIn.value; paint(); };
  const box = h('div', { class: 'stack' }, chips, row, igIn, status);
  paint(); box.value = out;
  return box;
}
function normalizePhone(cc, raw) {
  let d = digits(raw).replace(/^00/, '');
  if (!d) return '';
  if (cc === '961') { d = d.replace(/^961/, '').replace(/^0+/, ''); return d.length === 7 || d.length === 8 ? '961' + d : ''; }
  d = d.replace(/^0+/, ''); if (d.startsWith(cc) && d.length > cc.length + 6) d = d.slice(cc.length);
  return d.length >= 6 && d.length <= 13 ? cc + d : '';
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad2 = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseIso = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const todayIso = () => isoOf(new Date());

/** Tap-only calendar: month names, no typing. */
function calendar(value, min, onPick) {
  const minD = parseIso(min), sel = parseIso(value);
  let view = sel || minD || new Date(); view = new Date(view.getFullYear(), view.getMonth(), 1);
  const box = h('div', { class: 'pk' });
  function draw() {
    const y = view.getFullYear(), m = view.getMonth(), lead = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
    const prevOk = !minD || new Date(y, m, 0) >= minD;
    const grid = h('div', { class: 'pk-grid' }, ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => h('span', { class: 'pk-dow' }, d)));
    for (let i = 0; i < lead; i++) grid.append(h('span'));
    for (let d = 1; d <= days; d++) {
      const dt = new Date(y, m, d), iso = isoOf(dt);
      grid.append(h('button', { type: 'button', class: 'pk-cell' + (iso === todayIso() ? ' today' : ''), 'aria-pressed': iso === value ? 'true' : 'false', disabled: !!(minD && dt < minD),
        onclick: () => { value = iso; onPick(iso); draw(); } }, d));
    }
    box.replaceChildren(
      h('div', { class: 'pk-head' }, h('button', { type: 'button', class: 'pk-nav', 'aria-label': 'Previous month', disabled: !prevOk, onclick: () => { view = new Date(y, m - 1, 1); draw(); } }, '‹'),
        h('b', null, `${MONTHS[m]} ${y}`), h('button', { type: 'button', class: 'pk-nav', 'aria-label': 'Next month', onclick: () => { view = new Date(y, m + 1, 1); draw(); } }, '›')), grid);
  }
  draw(); return box;
}
/** Tap-only time picker: hour, minutes (5-min steps), AM/PM. */
function timePicker(value, onPick) {
  const m0 = /^(\d{2}):(\d{2})$/.exec(value || '');
  const st = m0 ? { h: ((+m0[1] + 11) % 12) + 1, m: +m0[2], ap: +m0[1] < 12 ? 'AM' : 'PM' } : { h: null, m: null, ap: 'PM' };
  const box = h('div', { class: 'pk' }), sum = h('div', { class: 'pk-sum' });
  const out = () => { if (st.h && st.m != null) { onPick(`${pad2((st.h % 12) + (st.ap === 'PM' ? 12 : 0))}:${pad2(st.m)}`); } };
  function group(label, items, cur, set, cls) {
    return h('div', null, h('div', { class: 'pk-lab' }, label), h('div', { class: 'pk-times ' + (cls || '') }, items.map(([v, l]) =>
      h('button', { type: 'button', class: 'pk-cell sq', 'aria-pressed': v === cur ? 'true' : 'false', onclick: () => { set(v); draw(); out(); } }, l))));
  }
  function draw() {
    sum.textContent = st.h && st.m != null ? `${st.h}:${pad2(st.m)} ${st.ap}` : 'Pick an hour and minutes';
    box.replaceChildren(group('Hour', Array.from({ length: 12 }, (_, i) => [i + 1, String(i + 1)]), st.h, (v) => (st.h = v)),
      group('Minutes', Array.from({ length: 12 }, (_, i) => [i * 5, pad2(i * 5)]), st.m, (v) => (st.m = v)),
      group('', [['AM', 'AM ☀️'], ['PM', 'PM 🌙']], st.ap, (v) => (st.ap = v), 'two'), sum);
  }
  draw(); return box;
}

const toB64u = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromB64u = (t) => { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; const s = atob(t); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
async function pipe(bytes, stream) { const w = stream.writable.getWriter(); w.write(bytes); w.close(); return new Uint8Array(await new Response(stream.readable).arrayBuffer()); }
async function pack(cfg) { const raw = new TextEncoder().encode(JSON.stringify(cfg)); return window.CompressionStream ? 'z' + toB64u(await pipe(raw, new CompressionStream('deflate-raw'))) : 'j' + toB64u(raw); }
async function unpack(s) { const bytes = fromB64u(s.slice(1)); const raw = s[0] === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes; return JSON.parse(new TextDecoder().decode(raw)); }

async function shrinkImage(file, max, q, square) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  if (square) { // centre-crop to a square so a round frame never shows edges
    const side = Math.min(bmp.width, bmp.height), size = Math.min(max, side);
    c.width = c.height = size;
    c.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  } else {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  }
  let out = c.toDataURL('image/webp', q);
  if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/png');
  return out;
}
const pickFile = (accept) => new Promise((res) => { const i = h('input', { type: 'file', accept }); i.onchange = () => res(i.files[0] || null); i.click(); });
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* blocked or full */ } }
};
const copyText = async (t) => { try { await navigator.clipboard.writeText(t); return true; } catch (e) { return false; } };

/* ------------------------------------------------------------------ config */
const DEFAULT_VIBE = { romantic: 'sweet', friends: 'funny', coffee: 'sweet', birthday: 'funny', custom: 'sweet' };
const DEFAULT_PICKUP = '{days} days until I pick you up from your doorstep 🚗';
function newConfig(type, rel) {
  const p = PRESETS[type];
  return {
    v: 3, type, rel: rel || '', vibe: DEFAULT_VIBE[type] || 'sweet', from: '', to: '', cc: '961', phone: '', contact: '', waReply: true, toKind: 'wa', toCc: '961', toPhone: '', toIg: '', toContact: '',
    title: p.title, sub: p.sub, caption: '', yay: p.yay, yaySub: p.yaySub,
    dateTitle: p.dateTitle, dateSub: p.dateSub, pickup: type === 'birthday' ? '' : DEFAULT_PICKUP, dateMode: p.dateMode, fixedDate: '', fixedTime: '',
    actTitle: p.actTitle, acts: p.acts.slice(), doneTitle: p.doneTitle,
    theme: p.theme, color: '#ff7ab8', clouds: true, wall: null, photo: null, photoSticker: 'cat-white',
    steps: deepCopy(p.steps), yesFx: p.yesFx,
    stickers: [
      { k: 'lib:cat-orange', x: 87, y: 8, s: 16, r: 8, f: 1 },
      { k: 'lib:heart', x: 13, y: 15, s: 13, r: -12, f: 0 },
      { k: 'lib:sparkle', x: 88, y: 46, s: 9, r: 0, f: 0 },
      { k: 'lib:cat-white', x: 17, y: 82, s: 25, r: -5, f: 0 },
      { k: 'lib:star', x: 86, y: 84, s: 12, r: 14, f: 0 }
    ]
  };
}
function sanitize(c) { // anything from a link or the server is untrusted
  const t = (v, n = 200) => (typeof v === 'string' ? v.slice(0, n) : '');
  const base = newConfig(PRESETS[c && c.type] ? c.type : 'custom', '');
  const o = Object.assign(base, c || {});
  ['from', 'to', 'title', 'sub', 'caption', 'yay', 'yaySub', 'dateTitle', 'dateSub', 'pickup', 'actTitle', 'doneTitle', 'rel'].forEach((k) => (o[k] = t(o[k])));
  o.vibe = AI.VIBES.some((v) => v[0] === o.vibe) ? o.vibe : 'sweet';
  o.cc = COUNTRIES.some((c) => c[0] === o.cc) ? o.cc : '961';
  o.phone = digits(o.phone).slice(0, 15);
  o.contact = normalizePhone(o.cc, o.phone) || digits(o.contact).slice(0, 16);
  o.waReply = o.waReply !== false;
  o.toKind = o.toKind === 'ig' ? 'ig' : 'wa';
  o.toCc = COUNTRIES.some((c) => c[0] === o.toCc) ? o.toCc : '961';
  o.toPhone = digits(o.toPhone).slice(0, 15); o.toIg = t(o.toIg, 80);
  o.toContact = o.toKind === 'wa' ? normalizePhone(o.toCc, o.toPhone) : (igHandle(o.toIg) ? '@' + igHandle(o.toIg) : '');
  o.fixedDate = /^\d{4}-\d{2}-\d{2}$/.test(o.fixedDate) ? o.fixedDate : '';
  o.fixedTime = /^\d{2}:\d{2}$/.test(o.fixedTime) ? o.fixedTime : '';
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
  const d = h('div', { class: 'st' }); const inner = h('div', { class: 'bob' });
  if (st.k.startsWith('lib:')) inner.innerHTML = STICKERS[st.k.slice(4)].svg;
  else inner.append(h('img', { src: st.k, alt: '', draggable: 'false' }));
  d.append(inner); placeSticker(d, st); return d;
}
function placeSticker(d, st) {
  d.style.left = st.x + '%'; d.style.top = st.y + '%'; d.style.width = st.s + '%';
  d.style.transform = `translate(-50%,-50%) rotate(${st.r || 0}deg) scaleX(${st.f ? -1 : 1})`;
}
function frameContent(cfg) {
  const f = h('div', { class: 'frame' });
  if (cfg.photo) f.append(h('img', { class: 'ph', src: cfg.photo, alt: '' })); else f.innerHTML = svgIcon(cfg.photoSticker);
  return f;
}
function confetti(stage) {
  const c = h('canvas', { class: 'confetti' }); stage.append(c);
  const r = stage.getBoundingClientRect(); c.width = r.width * 1.5; c.height = r.height * 1.5;
  const g = c.getContext('2d'), cols = ['#ff4d8d', '#ffd84d', '#7fd6ff', '#9be27f', '#c58bff', '#fff'];
  const ps = Array.from({ length: 70 }, () => ({ x: c.width / 2, y: c.height * .45, vx: rand(-9, 9), vy: rand(-16, -3), w: rand(6, 13), c: cols[(Math.random() * cols.length) | 0], a: rand(0, 6), va: rand(-.3, .3) }));
  let t = 0;
  (function tick() {
    g.clearRect(0, 0, c.width, c.height);
    ps.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += .42; p.a += p.va; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); g.restore(); });
    if (++t < 120) requestAnimationFrame(tick); else c.remove();
  })();
}

/** opts: edit (static screen + draggable stickers) | screen | sel | onSelect | onChange | inviteId | onSent */
function buildStage(cfg, opts) {
  opts = opts || {};
  const th = THEMES[cfg.theme];
  const el = h('div', { class: 'stage' + (opts.edit ? ' editing' : ''), 'data-theme': cfg.theme, 'data-dark': th.dark ? '1' : null });
  const col = safeHex(cfg.color) || '#ff7ab8';
  const vars = cfg.theme === 'custom'
    ? { '--sky': `linear-gradient(color-mix(in srgb,${col} 30%,#fff),${col})`, '--accent': col, '--accent2': `color-mix(in srgb,${col} 65%,#000)`, '--ink': `color-mix(in srgb,${col} 30%,#000)` }
    : { '--sky': th.sky, '--accent': th.accent, '--accent2': th.accent2, '--ink': th.ink };
  vars['--font'] = th.font; vars['--sceneH'] = th.sceneH || '34%';
  for (const k in vars) el.style.setProperty(k, vars[k]);

  const wall = h('div', { class: 'wall' });
  if (cfg.wall) wall.style.backgroundImage = `url("${cfg.wall}")`;
  el.append(wall);
  if (!cfg.wall) {
    if (th.sky2) { const s2 = h('div', { class: 'sky2' }); s2.innerHTML = th.sky2(); el.append(s2); }
    const sc = h('div', { class: 'scene' }); sc.innerHTML = th.scene(); el.append(sc);
  }
  if (cfg.clouds) {
    const cl = h('div', { class: 'clouds' });
    [[6, 46, 0], [22, 62, -20], [48, 54, -35], [70, 70, -8]].forEach(([top, dur, delay], i) => {
      const s = h('span'); s.innerHTML = `<svg viewBox="-16 -30 90 62" xmlns="http://www.w3.org/2000/svg">${th.cloud(0, 0, 1, th.cloudColor)}</svg>`;
      const svg = s.firstChild; svg.style.top = top + '%'; svg.style.animationDuration = dur + 's'; svg.style.animationDelay = delay + 's'; svg.style.transform = i % 2 ? 'scale(.8)' : ''; cl.append(svg);
    });
    el.append(cl);
  }
  const deco = h('div', { class: 'deco' });
  const em = cfg.theme === 'minecraft' ? ['🟩', '⬜', '✨'] : th.dark ? ['✨', '⭐', '💜'] : ['💗', '✨', '💖'];
  for (let i = 0; i < 7; i++) deco.append(h('i', { style: `left:${8 + i * 13}%;animation-delay:${-i * 1.7}s;animation-duration:${8 + (i % 3) * 2}s` }, em[i % em.length]));
  el.append(deco);

  const content = h('div', { class: 'content' }); const stickers = h('div', { class: 'stickers' });
  el.append(content, stickers);
  cfg.stickers.forEach((st, i) => {
    const n = stickerNode(st); n.style.zIndex = i; stickers.append(n);
    if (!opts.edit) return;
    n.addEventListener('pointerdown', (e) => {
      e.preventDefault(); n.setPointerCapture(e.pointerId); opts.onSelect && opts.onSelect(i);
      const rect = el.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, ox = st.x, oy = st.y;
      const move = (ev) => { st.x = clamp(ox + (ev.clientX - sx) / rect.width * 100, -5, 105); st.y = clamp(oy + (ev.clientY - sy) / rect.height * 100, -5, 105); placeSticker(n, st); };
      const up = () => { n.removeEventListener('pointermove', move); n.removeEventListener('pointerup', up); n.removeEventListener('pointercancel', up); opts.onChange && opts.onChange(); };
      n.addEventListener('pointermove', move); n.addEventListener('pointerup', up); n.addEventListener('pointercancel', up);
    });
    if (opts.sel === i) n.classList.add('sel');
  });

  /* ---- screens */
  const state = { date: cfg.dateMode === 'fixed' ? cfg.fixedDate : '', time: cfg.dateMode === 'fixed' ? cfg.fixedTime : '', act: '', noCount: 0, msg: '', sent: false };
  const F = (s) => fill(s, cfg);
  const T = (cls, tag, text) => h(tag, { class: cls }, F(text));
  const track = (kind, data) => { if (!opts.edit && opts.inviteId && window.API && API.enabled) API.track(opts.inviteId, kind, data); };
  let cur = 'ask';
  if (!opts.edit && opts.inviteId && window.API && API.enabled) document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && !state.sent) track('leave', { s: cur }); });

  function screenAsk() {
    let noScale = 1, yesScale = 1, tx = 0, ty = 0, rot = 0, fade = 1;
    const cap = h('p', { class: 'nocap' }, ' ');
    const yes = h('button', { class: 'gbtn yes' }, 'YES ✦'), no = h('button', { class: 'gbtn no' }, 'No');
    const btns = h('div', { class: 'btns' }, yes, no);
    const apply = () => { no.style.transform = `translate(${tx}px,${ty}px) scale(${noScale}) rotate(${rot}deg)`; no.style.opacity = fade; yes.style.transform = `scale(${yesScale})`; btns.style.margin = `${3 + (yesScale - 1) * 7}cqw 0 ${(yesScale - 1) * 7}cqw`; };
    yes.onclick = () => go('yay');
    no.onclick = () => {
      const step = cfg.steps[Math.min(state.noCount, cfg.steps.length - 1)]; state.noCount++;
      track('no', { n: state.noCount, t: F(step.t).slice(0, 60) });
      cap.textContent = F(step.t) || ' ';
      if (step.e === 'shrink') noScale = Math.max(.35, noScale * .72);
      else if (step.e === 'fade') fade = Math.max(.25, fade * .6);
      else if (step.e === 'spin') rot += 360;
      else if (step.e === 'shake') no.animate([{ translate: '0' }, { translate: '-2.5cqw' }, { translate: '2.5cqw' }, { translate: '-2cqw' }, { translate: '2cqw' }, { translate: '0' }], { duration: 420 });
      else if (step.e === 'dodge') {
        const S = el.getBoundingClientRect(), b = no.getBoundingClientRect();
        tx += S.left + rand(8, Math.max(9, S.width - b.width - 8)) - b.left;
        ty += S.top + S.height * .3 + rand(0, Math.max(1, S.height * .6 - b.height)) - b.top;
      }
      if (cfg.yesFx === 'grow') yesScale = Math.min(2.4, yesScale + .3);
      else if (cfg.yesFx === 'pulse') yes.animate([{ scale: 1 }, { scale: 1.25 }, { scale: 1 }], { duration: 380 });
      apply();
    };
    return [frameContent(cfg), T('title', 'h1', cfg.title), cfg.sub ? T('subt', 'p', cfg.sub) : null, cfg.caption ? T('caption', 'p', cfg.caption) : null, btns, cap, !opts.edit && opts.inviteId && cfg.from ? h('p', { class: 'fine' }, `💌 ${cfg.from} can see how far you get`) : null];
  }
  function screenYay() {
    setTimeout(() => confetti(el), 60);
    return [frameContent(cfg), T('title', 'h1', cfg.yay), T('sub2', 'p', cfg.yaySub), h('button', { class: 'gbtn', onclick: () => go(cfg.dateMode === 'fixed' ? 'act' : 'date') }, 'Continue →')];
  }
  function screenDate() { // step 1 of 2: the day (calendar, month names, no typing)
    const pk = h('p', { class: 'caption' });
    const next = h('button', { class: 'gbtn', disabled: !state.date, onclick: () => go('time') }, 'Next →');
    const show = () => { pk.textContent = cfg.pickup && state.date ? pickupText(F(cfg.pickup), state.date) : ''; next.disabled = !state.date; };
    const cal = calendar(state.date, todayIso(), (iso) => { state.date = iso; show(); });
    show();
    return [T('title', 'h1', cfg.dateTitle), cfg.dateSub ? T('sub2', 'p', cfg.dateSub) : null, cal, h('div', { style: 'height:3cqw' }), pk, next];
  }
  function screenTime() { // step 2 of 2: the time
    const next = h('button', { class: 'gbtn', disabled: !state.time, onclick: () => go('act') }, 'Next →');
    const tp = timePicker(state.time, (t) => { state.time = t; next.disabled = false; });
    const when = state.date ? h('p', { class: 'caption' }, '📅 ' + fmtDate(state.date)) : null;
    return [h('h1', { class: 'title' }, 'What time?'), when, tp, h('div', { style: 'height:3cqw' }), next];
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
    if (!state.sent) setTimeout(() => confetti(el), 60);
    const label = cfg.type === 'birthday' ? 'Bringing' : cfg.type === 'coffee' ? 'Order' : 'Plan';
    const when = state.date ? fmtDate(state.date) + (state.time ? ' · ' + fmtTime(state.time) : '') : '';
    if (state.sent) {
      const wa = cfg.contact && cfg.waReply ? h('a', { class: 'gbtn', style: 'text-decoration:none;display:inline-block', target: '_blank', rel: 'noopener', href: `https://wa.me/${cfg.contact}?text=${encodeURIComponent(`*💖 ${cfg.to || 'They'} said YES! 💖*\n\n${state.msg || ''}\n\n_Sent with ADate · ${location.host}_`)}` }, `💬 Open WhatsApp again`) : null;
      return [frameContent(cfg), h('h1', { class: 'title' }, 'Sent! 💌'), h('p', { class: 'sub2' }, cfg.from ? `${cfg.from} will see your answer very soon.` : 'Your answer is on its way.'), wa,
        h('a', { class: 'gbtn no', style: 'text-decoration:none;display:inline-block;margin-top:3cqw;font-size:.8em', href: location.pathname + '#/' }, '✨ Make your own invite')];
    }
    const ctxFor = (extra) => Object.assign({ vibe: cfg.type === 'romantic' ? 'flirty' : cfg.vibe, variant: n, from: cfg.from, to: cfg.to, date: fmtDate(state.date), time: fmtTime(state.time), act: state.act, label,
      pickup: cfg.pickup && state.date ? pickupText(F(cfg.pickup), state.date) : '' }, extra);
    let n = 0, touched = false;
    state.msg = AI.compose(ctxFor());                                     // ready instantly, so it is never empty
    const ta = h('textarea', { class: 'msg big', rows: '9', maxlength: '900', 'aria-label': 'Your message' }); ta.value = state.msg;
    ta.oninput = () => { touched = true; state.msg = ta.value; };
    const tag = h('p', { class: 'caption', style: 'margin:0' }, '✨ written for you · edit it if you like');
    async function upgrade() { // the AI may replace the opening lines, but only if she hasn't touched the text
      const op = await AI.opening(ctxFor());
      if (op && !touched && ta.isConnected) { state.msg = AI.compose(ctxFor({ opening: op })); ta.value = state.msg; tag.textContent = '✨ written by AI · edit it if you like'; }
    }
    function another() { n++; touched = false; state.msg = AI.compose(ctxFor()); ta.value = state.msg; tag.textContent = '✨ new version · edit it if you like'; upgrade(); }
    const again = h('button', { class: 'gbtn no', style: 'font-size:.75em', onclick: another }, '↻ Another version');
    const needContact = !!(opts.inviteId && window.API && API.enabled);   // the preview in the editor does not ask
    let me = { contact: '' }, sendBtn = null;
    const mine = contactPicker({ kind: cfg.toKind, cc: cfg.toCc || cfg.cc, phone: '', ig: '' }, (v) => { me = v; if (sendBtn) sendBtn.disabled = needContact && !v.contact; });
    const contactBox = needContact ? h('div', { class: 'stack', style: 'margin-top:1cqw' }, h('b', { style: 'font-size:.75em' }, `Your WhatsApp or Instagram *`), h('p', { class: 'caption', style: 'margin:0' }, `So ${cfg.from || 'they'} can reach you. Only they and the site owner see it.`), mine) : null;
    const waOn = !!(cfg.contact && cfg.waReply);
    const waText = (m) => `*💖 ${cfg.to || 'They'} said YES! 💖*\n\n${m}\n\n_Sent with ADate · ${location.host}_`;
    const waUrl = (m) => `https://wa.me/${cfg.contact}?text=${encodeURIComponent(waText(m))}`;
    const send = h('button', { class: 'gbtn', disabled: needContact && !me.contact }, waOn ? '💬 Send on WhatsApp' : 'Send to ' + (cfg.from || 'them') + ' 💌');
    sendBtn = send;
    const siteOnly = waOn && opts.inviteId && window.API && API.enabled ? h('button', { class: 'gbtn no', style: 'font-size:.7em', onclick: () => deliver(false) }, 'Send on the website only') : null;
    const note = h('p', { class: 'nocap' }, ' ');
    async function deliver(openWa) {
      const msg = (ta.value || '').trim() || AI.compose(ctxFor()); state.msg = msg;
      const answer = { yes: true, date: state.date, time: state.time, act: state.act, noCount: state.noCount, label };
      if (needContact && !me.contact) { note.textContent = 'Add your WhatsApp number or Instagram first 🙏'; return; }
      const myNum = me.kind === 'wa' ? me.contact : '', myIg = me.kind === 'ig' ? me.contact.slice(1) : '';
      send.disabled = true;
      if (openWa && waOn) window.open(waUrl(msg), '_blank', 'noopener'); // must happen inside the tap
      if (opts.inviteId && window.API && API.enabled) {
        try { await API.respond(opts.inviteId, answer, msg, myNum, myIg); state.sent = true; go('done'); opts.onSent && opts.onSent(); return; }
        catch (e) { note.textContent = e && e.message ? e.message : 'Could not save it on the website. Try again.'; send.disabled = false; return; }
      }
      if (openWa && waOn) { state.sent = true; go('done'); return; }
      try { if (navigator.share) return await navigator.share({ text: waText(msg) }); } catch (e) { return; }
      note.textContent = (await copyText(waText(msg))) ? 'Copied. Paste it to them 💌' : 'Screenshot this page 📸'; send.disabled = false;
    }
    send.onclick = () => deliver(true);
    setTimeout(upgrade, 50);
    return [h('h1', { class: 'title', style: 'font-size:1.35em;margin-bottom:.1em' }, F(cfg.doneTitle)), ta, tag, h('div', { class: 'btns', style: 'min-height:0;margin-top:1cqw;flex-wrap:wrap' }, send, again), contactBox, siteOnly, note];
  }
  const screens = { ask: screenAsk, yay: screenYay, date: screenDate, time: screenTime, act: screenAct, done: screenDone };
  function go(name) {
    cur = name;
    if (!state.sent) track('step', { s: name, date: state.date || undefined, time: state.time || undefined, act: state.act || undefined });
    content.replaceChildren(...screens[name]().filter(Boolean));
    content.style.animation = 'none'; void content.offsetWidth; content.style.animation = '';
  }
  if (opts.edit) {
    const s = opts.screen || 'ask';
    const soon = isoOf(new Date(Date.now() + 864e5 * 5));
    if (['done', 'act', 'time'].includes(s)) { state.date = state.date || soon; }
    if (s === 'done' || s === 'act') { state.time = state.time || '19:30'; state.act = cfg.acts[0] || ''; }
    go(s);
  } else go('ask');
  return { el, go };
}

/* ------------------------------------------------------------------ shared pieces */
function footer() {
  return h('footer', { class: 'foot' },
    h('div', { class: 'star' }, '⭐ Like this free demo? Star it on GitHub and play it with your partner 💕'),
    h('a', { class: 'btn pri', href: GITHUB, target: '_blank', rel: 'noopener' }, '⭐ Star on GitHub'),
    h('div', { class: 'by' }, h('a', { href: '#/privacy' }, 'Privacy')));
}
const myInvites = () => store.get('adate.mine', []);
function rememberInvite(rec) { const l = myInvites().filter((x) => x.id !== rec.id); l.unshift(rec); store.set('adate.mine', l.slice(0, 30)); }
const inviteUrl = (id) => location.href.split('#')[0] + '#/i/' + id;
const privateUrl = (id, tok) => location.href.split('#')[0] + '#/d/' + id + '.' + tok;

/* ------------------------------------------------------------------ viewer */
function brokenLink() {
  $app.replaceChildren(h('div', { class: 'viewer' }, h('div', { class: 'err' }, h('h2', null, 'This link looks broken 🥲'), h('p', null, 'Ask the sender to share it again.'), h('a', { href: '#/', style: 'color:#ffb3dd' }, 'Make your own'))));
}
async function viewer(kind, data) {
  let cfg, inviteId = null;
  try {
    if (kind === 'i') { cfg = sanitize(await API.open(data)); inviteId = data; if (!cfg) throw 0; }
    else cfg = sanitize(await unpack(data));
  } catch (e) { return brokenLink(); }
  document.title = fill(cfg.title, cfg).slice(0, 60);
  $app.replaceChildren(h('div', { class: 'viewer' }, buildStage(cfg, { inviteId }).el));
}

/* ------------------------------------------------------------------ home */
const ICON = { romantic: 'cat-love', friends: 'cat-happy', coffee: 'cat-coffee', birthday: 'cat-party', custom: 'sparkle' };
const TONE = { romantic: 'c-rose', friends: 'c-sky', coffee: 'c-butter', birthday: 'c-lav', custom: 'c-mint' };
function home() {
  document.title = 'ADate – Make a cute invite';
  const draft = store.get('adate.draft', null);
  const cards = PRESET_ORDER.map((k) => {
    const p = PRESETS[k], c = h('button', { class: `card ${TONE[k]}` + (k === 'custom' ? ' wide' : ''), onclick: () => { store.set('adate.draft', newConfig(k, '')); store.set('adate.draftmeta', null); store.set('adate.step', 0); location.hash = '#/make'; } },
      h('span', { class: 'ic' }), h('span', null, h('b', null, p.label), h('br'), h('small', null, p.blurb)));
    c.querySelector('.ic').innerHTML = svgIcon(ICON[k]); return c;
  });
  const notif = h('div'), badge = h('span', { class: 'badge warn hidden' });
  if (API.enabled && API.session) API.me().then((d) => {
    const n = d.unseen.length;
    if (n) { badge.textContent = n; badge.classList.remove('hidden'); notif.replaceChildren(h('a', { class: 'notif', href: '#/mine' }, h('span', { class: 'bc-bell' }, '🔔'), h('span', null, h('b', null, `${d.unseen[0].to_name || 'Someone'} answered your invite!`), h('br'), h('small', null, n > 1 ? `${n} new answers · tap to read` : 'Tap to read the message')))); }
  }).catch((e) => { if (/log in/i.test(e.message)) API.clear(); });
  const stk = (id, st) => { const d = h('div', { class: 'stk', style: st }); d.innerHTML = svgIcon(id); return d; };
  $app.replaceChildren(h('div', { class: 'wrap' },
    h('a', { class: 'promo', href: GITHUB, target: '_blank', rel: 'noopener' }, '⭐ Free demo · Star it on GitHub and play it with your partner'),
    notif,
    h('div', { class: 'topbar' }, h('div', { class: 'brand' }, '🐱 A', h('b', null, 'Date')),
      API.enabled ? (API.session ? h('a', { class: 'btn sm pri', href: '#/mine' }, '📬 Inbox ', badge) : h('a', { class: 'btn sm', href: '#/login' }, 'Log in')) : h('span', { class: 'pill' }, 'Free demo')),
    h('div', { class: 'hero' }, h('div', { class: 'stks' }, stk('cat-orange', 'animation-delay:-1s'), stk('cat-love', 'width:72px'), stk('cat-white', 'animation-delay:-2s')),
      h('h1', null, 'Create your private invite'), h('p', null, 'For your girlfriend, your boyfriend, a friend or your birthday. Add their name, pick a vibe, and send a link with a sneaky “No” button.')),
    draft ? h('div', { class: 'row', style: 'justify-content:center;margin-bottom:6px' }, h('button', { class: 'btn pri sm', onclick: () => (location.hash = '#/make') }, '✏️ Continue my invite')) : null,
    h('div', { class: 'h2' }, 'What’s the occasion?'), h('div', { class: 'cards' }, cards),
    footer()));
}

/* ------------------------------------------------------------------ editor (wizard) */
const ACT_IDEAS = {
  romantic: ['Dinner date', 'Movie night', 'Sunset walk', 'Picnic', 'Stargazing', 'Coffee & dessert', 'Sea-side drive', 'Board games', 'Cook together', 'Mini golf', 'Surprise me'],
  friends: ['Gaming night', 'Food run', 'Movie marathon', 'Walk & talk', 'Karaoke', 'Beach day', 'Bowling', 'Road trip', 'Chaos, surprise me'],
  coffee: ['Latte', 'Iced coffee', 'Cappuccino', 'Hot chocolate', 'Tea', 'Croissant & coffee', 'Surprise me'],
  birthday: ['Cake', 'A gift', 'Drinks', 'Snacks', 'Music', 'Good vibes only', 'Balloons'],
  custom: ['Option one', 'Option two', 'Surprise me']
};
const REL = [['girlfriend', 'My girlfriend'], ['boyfriend', 'My boyfriend'], ['partner', 'My partner'], ['friend', 'A friend'], ['bestie', 'My bestie']];
const FX = [['shrink', 'Gets smaller'], ['dodge', 'Runs away'], ['shake', 'Shakes'], ['spin', 'Spins'], ['fade', 'Fades a bit'], ['none', 'Nothing']];

function editor() {
  document.title = 'ADate – Editor';
  let cfg = store.get('adate.draft', null);
  if (!cfg) { location.hash = '#/'; return; }
  cfg = sanitize(cfg);
  let step = clamp(store.get('adate.step', 0) | 0, 0, 6), sel = null, mode = 'edit', screen = 'ask';
  const meta = () => store.get('adate.draftmeta', null); // {id, token} once the invite exists
  const save = () => store.set('adate.draft', cfg);

  /* --- live previews (desktop side pane, inline stage on the sticker step) */
  const pvSide = h('div', { class: 'stagewrap' }); let inline = null;
  const screenRow = h('div', { class: 'row', style: 'justify-content:center' }, [['ask', 'Ask'], ['yay', 'Yay'], ['date', 'Day'], ['time', 'Time'], ['act', 'Options'], ['done', 'Final']].map(([id, l]) =>
    h('button', { class: 'chip', 'data-s': id, 'aria-pressed': id === screen ? 'true' : 'false', onclick: () => { screen = id; screenRow.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.s === id ? 'true' : 'false')); mode = 'edit'; syncMode(); refresh(); } }, l)));
  const modeBtns = { edit: h('button', { class: 'chip', onclick: () => { mode = 'edit'; syncMode(); refresh(); } }, '✋ Edit view'), play: h('button', { class: 'chip', onclick: () => { mode = 'play'; syncMode(); refresh(); } }, '▶ Test it') };
  function syncMode() { for (const k in modeBtns) modeBtns[k].setAttribute('aria-pressed', mode === k ? 'true' : 'false'); screenRow.classList.toggle('hidden', mode !== 'edit'); }
  function mountStage(box, m) {
    const inst = m === 'edit' ? buildStage(cfg, { edit: true, screen: box === inline ? 'ask' : screen, sel, onSelect: (i) => { sel = i; markSel(); drawSel(); }, onChange: save }) : buildStage(cfg, {});
    box.replaceChildren(inst.el);
  }
  function refresh() { mountStage(pvSide, mode); if (inline) mountStage(inline, 'edit'); }
  const stagesOf = () => [pvSide, inline].filter(Boolean).map((b) => b.querySelector('.stickers'));
  function markSel() { stagesOf().forEach((s) => s && s.querySelectorAll('.st').forEach((n, i) => n.classList.toggle('sel', i === sel))); }
  function change() { save(); refresh(); }
  function openPreview() {
    const m = h('div', { class: 'modal' }); const box = h('div', { class: 'stagewrap' });
    const play = () => box.replaceChildren(buildStage(cfg, {}).el);
    m.append(h('div', { class: 'mt' }, h('button', { class: 'btn sm', onclick: play }, '↻ Restart'), h('button', { class: 'btn pri sm', onclick: () => m.remove() }, '✕ Close')), box);
    m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
    play(); document.body.append(m);
  }

  /* --- fields with ✨ AI suggestions */
  const ctx = () => ({ vibe: cfg.vibe, type: cfg.type, typeLabel: PRESETS[cfg.type].label, rel: cfg.rel, to: cfg.to, from: cfg.from });
  const showTxt = (s) => fill(s, cfg).replace(/\{days\}/g, '7');
  function suggestBox(field, apply, ctxFn) {
    const box = h('div', { class: 'sugg hidden' }); let run = 0;
    async function load() {
      const me = ++run; box.classList.remove('hidden');
      const render = (lines, status) => { if (me !== run) return; box.replaceChildren(...lines.map((l) => h('button', { class: 'sug', type: 'button', onclick: () => { apply(l); box.classList.add('hidden'); run++; } }, showTxt(l))),
        h('div', { class: 'sugg-foot' }, h('span', { class: status === 'wait' ? 'spark' : '' }, status === 'ai' ? '✨ written by AI' : status === 'wait' ? '✨ asking the AI…' : 'quick ideas'),
          h('span', null, h('button', { type: 'button', onclick: load }, '↻ More'), h('button', { type: 'button', onclick: () => { box.classList.add('hidden'); run++; } }, 'Close')))); };
      const res = await AI.suggest(field, ctxFn ? ctxFn() : ctx(), (loc) => render(loc, 'wait'));
      render(res.lines, res.ai ? 'ai' : 'local');
    }
    return { box, load };
  }
  function aiField(label, key, o) {
    o = o || {};
    const inp = o.area ? h('textarea') : h('input', { type: 'text', maxlength: o.max || 140, placeholder: o.ph || '' });
    inp.value = o.get ? o.get() : cfg[key];
    inp.oninput = () => { (o.set || ((v) => (cfg[key] = v)))(inp.value); change(); };
    const row = h('div', { class: 'fieldrow' }, inp);
    const wrap = h('label', { class: 'f' }, label, o.hint ? h('small', null, o.hint) : null);
    const out = [wrap, row];
    if (o.field !== false) {
      const sg = suggestBox(o.field || key, (v) => { (o.set || ((x) => (cfg[key] = x)))(v); inp.value = v; change(); });
      row.append(h('button', { class: 'ai-btn', type: 'button', onclick: sg.load }, '✨ Suggest')); out.push(sg.box);
    }
    return h('div', { class: 'stack' }, out);
  }
  const plain = (label, key, o) => aiField(label, key, Object.assign({ field: false }, o));
  const upload = async (accept, max, q) => { const f = await pickFile(accept); return f ? shrinkImage(f, max, q) : null; };

  /* --- steps */
  function phoneField() {
    const status = h('p', { class: 'hint' });
    const inp = h('input', { type: 'tel', inputmode: 'numeric', maxlength: 16, placeholder: cfg.cc === '961' ? '70 123 456' : 'your number', value: cfg.phone, 'aria-label': 'WhatsApp number' });
    const sel = h('select', { style: 'flex:0 0 46%', 'aria-label': 'Country' }, COUNTRIES.map(([c, l]) => h('option', { value: c, selected: c === cfg.cc }, l)));
    const check = () => {
      cfg.phone = digits(inp.value); cfg.cc = sel.value; cfg.contact = normalizePhone(cfg.cc, cfg.phone); save();
      inp.placeholder = cfg.cc === '961' ? '70 123 456' : 'your number';
      status.textContent = !cfg.phone ? (cfg.cc === '961' ? 'Lebanon: just the 8 digits, no 961 and no 0 needed.' : 'Your number without the country code.') : cfg.contact ? '✓ Looks good: +' + cfg.contact : '✗ That number doesn’t look right yet.';
      status.style.color = cfg.phone && !cfg.contact ? '#c0392b' : '';
    };
    inp.oninput = check; sel.onchange = check; check();
    return h('div', { class: 'stack' }, h('b', null, 'Your WhatsApp number *'), h('div', { class: 'fieldrow' }, sel, inp), status,
      h('label', { class: 'row', style: 'gap:10px' }, h('input', { type: 'checkbox', checked: cfg.waReply, onchange: (e) => { cfg.waReply = e.target.checked; save(); } }), 'Let them also reply to me on WhatsApp'));
  }
  function stepNames() {
    return [
      h('div', { class: 'stack' }, h('b', null, 'They are…'), h('div', { class: 'row' }, REL.map(([id, l]) => h('button', { class: 'chip', 'aria-pressed': cfg.rel === id ? 'true' : 'false', onclick: (e) => { cfg.rel = id; e.currentTarget.parentNode.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === e.currentTarget ? 'true' : 'false')); save(); } }, l)))),
      plain('Your name', 'from', { ph: 'e.g. Sam' }), plain('Their name', 'to', { ph: 'e.g. Lina' }),
      h('div', { class: 'stack' }, h('b', null, 'The vibe of your words'), h('p', { class: 'hint' }, 'The ✨ suggestions will write in this style.'),
        h('div', { class: 'row' }, AI.VIBES.map(([id, l]) => h('button', { class: 'chip', 'aria-pressed': cfg.vibe === id ? 'true' : 'false', onclick: (e) => { cfg.vibe = id; e.currentTarget.parentNode.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === e.currentTarget ? 'true' : 'false')); save(); } }, l)))),
      phoneField(),
      h('div', { class: 'stack' }, h('b', null, 'Their WhatsApp number or Instagram *'), h('p', { class: 'hint' }, 'So you know exactly who this is for. Only you and the site owner see it.'),
        contactPicker({ kind: cfg.toKind, cc: cfg.toCc, phone: cfg.toPhone, ig: cfg.toIg }, (v) => { cfg.toKind = v.kind; cfg.toCc = v.cc; cfg.toPhone = v.phone; cfg.toIg = v.ig; cfg.toContact = v.contact; save(); }))
    ];
  }
  function stepWords() {
    const out = [h('p', { class: 'hint' }, 'Tap ✨ on any line and pick a suggestion, or write your own. {to} and {from} become the names.'),
      aiField('The big question', 'title'), aiField('Line under it', 'sub'), aiField('Tiny extra line (inside joke, pet name…)', 'caption'),
      aiField('When they say YES: headline', 'yay'), aiField('When they say YES: message', 'yaySub'),
      h('label', { class: 'f' }, 'The day', h('select', { onchange: (e) => { cfg.dateMode = e.target.value; change(); drawBody(); } },
        h('option', { value: 'pick', selected: cfg.dateMode === 'pick' }, 'They pick the day and time'), h('option', { value: 'fixed', selected: cfg.dateMode === 'fixed' }, 'I set the day and time')))];
    if (cfg.dateMode === 'fixed') out.push(h('b', null, 'Pick the day'), calendar(cfg.fixedDate, todayIso(), (iso) => { cfg.fixedDate = iso; change(); }), h('b', null, 'Pick the time'), timePicker(cfg.fixedTime, (t) => { cfg.fixedTime = t; change(); }));
    else out.push(aiField('Day screen: title', 'dateTitle'), aiField('Day screen: line', 'dateSub'), aiField('Pick-up line (shows a countdown under the day)', 'pickup', { field: 'pickup', hint: 'Use {days} for the number of days left. Say where you’ll pick them up!' }));
    const chips = h('div', { class: 'row' }, cfg.acts.map((a, i) => h('span', { class: 'chip', style: 'display:inline-flex;gap:.4em;align-items:center' }, a, h('button', { type: 'button', 'aria-label': 'Remove ' + a, style: 'border:0;background:none;font-weight:700;color:inherit;padding:0 .2em', onclick: () => { cfg.acts.splice(i, 1); change(); drawBody(); } }, '×'))));
    const add = h('input', { type: 'text', maxlength: 40, placeholder: 'Write your own idea…', 'aria-label': 'New option' });
    const addIt = () => { const v = add.value.trim(); if (v && !cfg.acts.includes(v) && cfg.acts.length < 12) { cfg.acts.push(v); change(); drawBody(); } };
    add.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addIt(); } };
    const ideas = h('div', { class: 'row' });
    (ACT_IDEAS[cfg.type] || ACT_IDEAS.custom).filter((a) => !cfg.acts.includes(a)).forEach((a) => ideas.append(h('button', { class: 'chip', onclick: () => { if (cfg.acts.length < 12) { cfg.acts.push(a); change(); drawBody(); } } }, '+ ' + a)));
    const acts = h('div', { class: 'stack' }, h('b', null, 'Options they choose from'), chips, h('div', { class: 'fieldrow' }, add, h('button', { class: 'btn pri', type: 'button', style: 'flex:none;min-height:48px', 'aria-label': 'Add option', onclick: addIt }, '＋')), h('p', { class: 'hint' }, 'Write your own, or tap an idea:'), ideas);
    out.push(aiField('Options screen: title', 'actTitle'), acts, aiField('Final screen: title', 'doneTitle'));
    return out;
  }
  function stepPic() {
    const g = h('div', { class: 'grid' });
    STICKER_ORDER.filter((id) => id.startsWith('cat') || ['bear', 'bunny'].includes(id)).forEach((id) => { const b = h('button', { class: 'tile', 'aria-pressed': !cfg.photo && cfg.photoSticker === id ? 'true' : 'false', title: STICKERS[id].name, onclick: () => { cfg.photoSticker = id; cfg.photo = null; change(); drawBody(); } }); b.innerHTML = svgIcon(id); g.append(b); });
    return [h('p', { class: 'hint' }, 'It shows in a round frame in the middle of every screen (we crop it to a circle for you). Pick one of mine, or upload their photo, an anime you both love, their pet or their place.'), g,
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: async () => { const f = await pickFile('image/*'); if (f) { cfg.photo = await shrinkImage(f, 320, .78, true); change(); drawBody(); } } }, '⬆ Upload my own picture'), cfg.photo ? h('button', { class: 'btn sm danger', onclick: () => { cfg.photo = null; change(); drawBody(); } }, 'Remove') : null)];
  }
  function thumb(id) {
    const t = THEMES[id];
    const b = h('button', { class: 'wpt', 'aria-pressed': cfg.theme === id ? 'true' : 'false', title: t.name, onclick: () => { cfg.theme = id; change(); drawBody(); } });
    const sk = h('div', { class: 'sk', style: `background:${t.sky || 'linear-gradient(#ffe3f4,' + cfg.color + ')'}` }), sc = h('div', { class: 'sc' });
    sc.innerHTML = t.scene(); b.append(sk, sc, h('span', { style: `color:${t.ink}` }, t.emoji + ' ' + t.name)); return b;
  }
  function stepLook() {
    const out = [h('p', { class: 'hint' }, 'Pick a place. The colours of the page follow it.')];
    THEME_GROUPS.forEach(([g, ids]) => out.push(h('div', { class: 'h2', style: 'margin:0' }, g === 'Lebanon' ? '🇱🇧 Lebanon' : g === 'World' ? '🌍 World' : '🎨 Vibes'), h('div', { class: 'wp' }, ids.map(thumb))));
    if (cfg.theme === 'custom') out.push(h('label', { class: 'f' }, 'Pick your colour', h('input', { type: 'color', value: cfg.color, oninput: (e) => { cfg.color = e.target.value; change(); } })));
    out.push(h('label', { class: 'row', style: 'gap:10px' }, h('input', { type: 'checkbox', checked: cfg.clouds, onchange: (e) => { cfg.clouds = e.target.checked; change(); } }), 'Floating clouds'),
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: async () => { const d = await upload('image/*', 520, .6); if (d) { cfg.wall = d; change(); drawBody(); } } }, '⬆ Use my own picture as wallpaper'), cfg.wall ? h('button', { class: 'btn sm danger', onclick: () => { cfg.wall = null; change(); drawBody(); } }, 'Remove it') : null));
    return out;
  }
  function stepNo() {
    const list = h('div', { style: 'display:flex;flex-direction:column;gap:10px' });
    cfg.steps.forEach((s, i) => {
      const inp = h('input', { type: 'text', maxlength: 90, value: s.t, placeholder: 'What it says', oninput: (e) => { s.t = e.target.value; save(); } });
      const sg = suggestBox('noLine', (v) => { s.t = v; inp.value = v; change(); });
      list.append(h('div', { class: 'stepbox' }, h('div', { class: 'n' }, i === cfg.steps.length - 1 ? `Press ${i + 1} and every press after` : `Press ${i + 1}`),
        h('div', { class: 'fieldrow' }, inp, h('button', { class: 'ai-btn', type: 'button', onclick: sg.load }, '✨')), sg.box,
        h('div', { class: 'row' }, h('select', { style: 'flex:1', onchange: (e) => { s.e = e.target.value; save(); } }, FX.map(([v, l]) => h('option', { value: v, selected: s.e === v }, l))),
          cfg.steps.length > 1 ? h('button', { class: 'btn sm danger', onclick: () => { cfg.steps.splice(i, 1); change(); drawBody(); } }, 'Delete') : null)));
    });
    return [h('p', { class: 'hint' }, 'Decide what each press on “No” says and does. The last one repeats forever. “No” never lets them continue: only YES does.'), list,
      h('button', { class: 'btn sm', onclick: () => { cfg.steps.push({ t: '', e: 'shrink' }); change(); drawBody(); } }, '+ Add another press'),
      h('label', { class: 'f' }, 'What happens to YES on each “No” press', h('select', { onchange: (e) => { cfg.yesFx = e.target.value; change(); } }, [['grow', 'It grows bigger'], ['pulse', 'It bounces'], ['none', 'Nothing']].map(([v, l]) => h('option', { value: v, selected: cfg.yesFx === v }, l)))),
      h('button', { class: 'btn pri sm', onclick: openPreview }, '▶ Try it')];
  }
  /* stickers */
  const selBox = h('div', { class: 'stepbox hidden' });
  function drawSel() {
    selBox.classList.toggle('hidden', sel == null || !cfg.stickers[sel]); if (sel == null || !cfg.stickers[sel]) return;
    const st = cfg.stickers[sel];
    const upd = () => { stagesOf().forEach((s) => s && placeSticker(s.querySelectorAll('.st')[sel], st)); save(); };
    selBox.replaceChildren(h('div', { class: 'n' }, 'Selected sticker'),
      h('label', { class: 'f' }, 'Size', h('input', { type: 'range', min: 5, max: 70, value: st.s, oninput: (e) => { st.s = +e.target.value; upd(); } })),
      h('label', { class: 'f' }, 'Tilt', h('input', { type: 'range', min: -90, max: 90, value: st.r, oninput: (e) => { st.r = +e.target.value; upd(); } })),
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { st.f = st.f ? 0 : 1; upd(); } }, '↔ Flip'),
        h('button', { class: 'btn sm', onclick: () => { cfg.stickers.push(cfg.stickers.splice(sel, 1)[0]); sel = cfg.stickers.length - 1; change(); drawSel(); } }, '⬆ Front'),
        h('button', { class: 'btn sm danger', onclick: removeSel }, '🗑 Delete')));
  }
  function removeSel() { if (sel == null) return; cfg.stickers.splice(sel, 1); sel = null; change(); drawSel(); }
  function addSticker(k) { cfg.stickers.push({ k, x: rand(30, 70), y: rand(30, 70), s: 22, r: 0, f: 0 }); sel = cfg.stickers.length - 1; mode = 'edit'; syncMode(); change(); drawSel(); }
  function stepStickers() {
    inline = h('div', { class: 'inline-stage' });
    const lib = h('div', { class: 'grid' }), mineG = h('div', { class: 'grid' });
    STICKER_ORDER.forEach((id) => { const b = h('button', { class: 'tile', title: STICKERS[id].name, onclick: () => addSticker('lib:' + id) }); b.innerHTML = svgIcon(id); lib.append(b); });
    const drawMine = () => { const m = store.get('adate.mystickers', []); mineG.replaceChildren(...m.map((u, i) => h('button', { class: 'tile', title: 'Tap to add · long-press to remove', onclick: () => addSticker(u), oncontextmenu: (e) => { e.preventDefault(); store.set('adate.mystickers', m.filter((_, j) => j !== i)); drawMine(); } }, h('img', { src: u, alt: '' })))); };
    drawMine(); drawSel();
    return [h('p', { class: 'hint' }, 'Tap a sticker to add it, drag it on the phone, then resize with the sliders.'), inline, selBox,
      h('b', null, 'Ready-made'), lib, h('b', null, 'My stickers'),
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: async () => { const d = await upload('image/*', 160, .8); if (!d) return; const m = store.get('adate.mystickers', []); m.unshift(d); store.set('adate.mystickers', m.slice(0, 30)); drawMine(); addSticker(d); } }, '⬆ Upload a sticker (transparent PNG is best)')), mineG];
  }
  /* send */
  function stepSend() {
    const out = h('div', { class: 'sharebox' });
    const consent = h('input', { type: 'checkbox', id: 'consent', checked: store.get('adate.consent', false), onchange: (e) => store.set('adate.consent', e.target.checked) });
    const acct = { mode: 'signup', password: '', email: '', question: (API.questions || [])[0] || 'What is your pet’s name?', answer: '' };
    const needAcct = () => API.enabled && !API.session;
    const problems = () => [!cfg.to.trim() && 'their name (step 1)', API.enabled && !cfg.contact && 'your WhatsApp number (step 1)', !cfg.toContact && 'their WhatsApp number or Instagram (step 1)',
      needAcct() && acct.password.length < 6 && 'a password (6+ characters)', needAcct() && acct.mode === 'signup' && acct.answer.trim().length < 2 && 'an answer to the security question',
      API.enabled && !consent.checked && 'tick the privacy box below'].filter(Boolean);
    function acctBlock() {
      if (!API.enabled) return null;
      const sess = API.session;
      if (sess) return h('div', { class: 'note' }, '✅ Logged in as +' + sess.phone + '. ', h('button', { class: 'btn sm', onclick: async () => { await API.logout(); drawBody(); } }, 'Not you? Log out'));
      const login = acct.mode === 'login';
      const pw = h('input', { type: 'password', autocomplete: login ? 'current-password' : 'new-password', placeholder: login ? 'Your password' : 'Choose a password (6+ characters)', value: acct.password, 'aria-label': 'Password', oninput: (e) => { acct.password = e.target.value; } });
      return h('div', { class: 'stepbox' }, h('b', null, login ? '🔐 Log in' : '🔐 Create your account'),
        h('p', { class: 'hint', style: 'margin:0' }, (login ? 'Welcome back. ' : 'So you can read their answer anytime, on any phone. ') + 'Your login is your WhatsApp number' + (cfg.contact ? ': +' + cfg.contact : '') + '.'), pw,
        login ? h('a', { href: '#/recover', class: 'hint' }, 'Forgot your password?') : [
          h('input', { type: 'text', autocomplete: 'email', inputmode: 'email', placeholder: 'Email (optional)', value: acct.email, 'aria-label': 'Email', oninput: (e) => { acct.email = e.target.value; } }),
          h('label', { class: 'f' }, 'If you forget your password:', h('select', { onchange: (e) => { acct.question = e.target.value; } }, ((API.questions && API.questions.length) ? API.questions : [acct.question]).map((q) => h('option', { value: q, selected: q === acct.question }, q)))),
          h('input', { type: 'text', placeholder: 'Your answer', value: acct.answer, 'aria-label': 'Security answer', oninput: (e) => { acct.answer = e.target.value; } })],
        h('button', { class: 'btn sm', onclick: () => { acct.mode = login ? 'signup' : 'login'; out.replaceChildren(warn(), ...ask()); } }, login ? 'New here? Create an account' : 'I already have an account'));
    }
    const warn = () => { const p = problems(); return p.length ? h('div', { class: 'note' }, 'Almost there. Still needed: ' + p.join(', ') + '.') : null; };
    async function publish(createNew) {
      if (problems().length) { out.replaceChildren(warn(), ...ask()); return; }
      if (needAcct()) {
        try { if (acct.mode === 'login') await API.login(cfg.contact, acct.password); else await API.signup({ phone: cfg.contact, name: cfg.from, email: acct.email, password: acct.password, question: acct.question, answer: acct.answer }); }
        catch (e) { if (/already has an account/i.test(e.message)) acct.mode = 'login'; out.replaceChildren(h('div', { class: 'note' }, e.message), ...ask()); return; }
      }
      out.replaceChildren(h('p', { class: 'hint spark' }, '✨ creating your link…'));
      try {
        let link, priv, m = meta();
        if (API.enabled) {
          if (m && !createNew) { await API.update(m.id, m.token, cfg); }
          else { m = { id: API.newId(), token: API.newToken() }; await API.create(m.id, m.token, cfg, consent.checked); store.set('adate.draftmeta', m); }
          rememberInvite({ id: m.id, token: m.token, to: cfg.to || 'Someone', type: cfg.type, at: Date.now() });
          link = inviteUrl(m.id); priv = privateUrl(m.id, m.token);
        } else link = location.href.split('#')[0] + '#/v/' + await pack(cfg);
        const msg = `${cfg.from ? cfg.from + ' made this for you 💌' : 'Someone made this for you 💌'}\n${link}`;
        const pct = clamp(link.length / 20000 * 100, 4, 100);
        out.replaceChildren(...[warn(),
          h('input', { type: 'text', readonly: '', value: link, onfocus: (e) => e.target.select(), 'aria-label': 'Your link' }),
          API.enabled ? null : h('div', { class: 'meter' }, h('i', { style: `width:${pct}%` })),
          API.enabled ? null : h('p', { class: 'hint' }, `Demo mode: the whole invite lives inside the link (${link.length.toLocaleString()} characters), and her answer goes to you by WhatsApp or share.`),
          h('div', { class: 'row' }, h('button', { class: 'btn pri', onclick: async (e) => { e.currentTarget.textContent = (await copyText(link)) ? 'Copied ✓' : 'Select & copy'; } }, 'Copy link'),
            h('a', { class: 'btn', href: 'https://wa.me/?text=' + encodeURIComponent(msg), target: '_blank', rel: 'noopener' }, 'WhatsApp'),
            navigator.share ? h('button', { class: 'btn', onclick: () => navigator.share({ text: msg }).catch(() => {}) }, 'Share…') : null),
          priv ? h('div', { class: 'note' }, h('b', null, '📬 Her answer lands in your inbox. '), 'Log in with your number any time to read it. A big card shows up when she answers.',
            h('div', { class: 'row', style: 'margin-top:8px' }, h('a', { class: 'btn sm pri', href: '#/mine' }, '📬 Open my inbox'),
              h('button', { class: 'btn sm', onclick: async (e) => { e.currentTarget.textContent = (await copyText(priv)) ? 'Copied ✓' : 'Select & copy'; } }, 'Copy backup link (no login)'),
              cfg.contact ? h('a', { class: 'btn sm', target: '_blank', rel: 'noopener', href: 'https://wa.me/' + cfg.contact + '?text=' + encodeURIComponent('My ADate inbox: ' + location.href.split('#')[0] + '#/mine') }, '📲 Save it on my WhatsApp') : null)) : null,
          API.enabled ? h('button', { class: 'btn sm', onclick: () => publish(true) }, 'Create a brand-new link instead') : null].filter(Boolean));
      } catch (e) { out.replaceChildren(h('div', { class: 'note' }, 'Something went wrong: ' + e.message), h('button', { class: 'btn pri', onclick: () => publish(false) }, 'Try again')); }
    }
    const m = meta();
    const ask = () => [acctBlock(), API.enabled ? h('label', { class: 'row', style: 'gap:10px;align-items:flex-start', for: 'consent' }, consent, h('span', { class: 'hint' }, 'I agree that ADate keeps this invite, my number and their answer so it can be delivered to me. ', h('a', { href: '#/privacy' }, 'Privacy'))) : null,
      h('p', { class: 'hint' }, 'Happy with it? Try the whole thing once, then create the link.'),
      h('button', { class: 'btn block', onclick: openPreview }, '▶ Try it like they will'),
      h('button', { class: 'btn pri block', onclick: () => publish(false) }, API.enabled && m ? 'Save changes to my link' : 'Create my link')].filter(Boolean);
    out.append(...[warn(), ...ask()].filter(Boolean));
    return [out];
  }
  const STEPS = [['👤', 'You & them', stepNames], ['✍️', 'Words', stepWords], ['🖼️', 'Main picture', stepPic], ['🌍', 'Wallpaper', stepLook], ['😈', 'The “No” button', stepNo], ['🐱', 'Stickers', stepStickers], ['💌', 'Send it', stepSend]];

  /* --- shell */
  const dots = h('div', { class: 'steps' }), title = h('h2'), body = h('div', { class: 'body' });
  const prev = h('button', { class: 'btn prev', onclick: () => go(step - 1) }, '←'), next = h('button', { class: 'btn pri', onclick: () => go(step + 1) }, 'Next →');
  const pvBtn = h('button', { class: 'btn pvbtn', onclick: openPreview }, '👀 Preview');
  function drawBody() {
    inline = null; sel = step === 5 ? sel : sel;
    body.replaceChildren(...STEPS[step][2]().filter(Boolean));
    if (inline) mountStage(inline, 'edit');
  }
  function go(n) {
    step = clamp(n, 0, STEPS.length - 1); store.set('adate.step', step);
    dots.replaceChildren(...STEPS.map((s, i) => h('button', { class: 'dot' + (i < step ? ' done' : ''), 'aria-current': i === step ? 'step' : null, 'aria-label': s[1], title: s[1], onclick: () => go(i) }, s[0])));
    title.textContent = `${step + 1}. ${STEPS[step][1]}`;
    prev.classList.toggle('hidden', step === 0); next.classList.toggle('hidden', step === STEPS.length - 1);
    drawBody(); window.scrollTo({ top: 0 });
  }
  const pv = h('div', { class: 'pvside' }, h('div', { class: 'row', style: 'justify-content:center' }, modeBtns.edit, modeBtns.play), screenRow, pvSide);
  $app.replaceChildren(h('div', { class: 'wiz' },
    h('div', { class: 'head' }, h('div', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, '🐱 A', h('b', null, 'Date')),
      h('button', { class: 'btn sm', onclick: () => { if (confirm('Start over? Your current invite will be cleared.')) { store.set('adate.draft', null); store.set('adate.draftmeta', null); location.hash = '#/'; } } }, 'Start over')), dots, title),
    h('div', { class: 'bodycol' }, body), pv),
    h('div', { class: 'bar' }, prev, pvBtn, next));
  syncMode(); refresh(); go(step);
  const onKey = (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) removeSel(); };
  document.addEventListener('keydown', onKey);
  editor.cleanup = () => document.removeEventListener('keydown', onKey);
}

/* ------------------------------------------------------------------ accounts + inbox */
let pollTimer = null;
function phoneRow(sel, inp) { return h('div', { class: 'fieldrow' }, sel, inp); }
function phoneInputs(cc0) {
  const sel = h('select', { style: 'flex:0 0 46%', 'aria-label': 'Country' }, COUNTRIES.map(([c, l]) => h('option', { value: c, selected: c === cc0 }, l)));
  const inp = h('input', { type: 'tel', inputmode: 'numeric', placeholder: '70 123 456', autocomplete: 'username', 'aria-label': 'Phone number' });
  return { sel, inp, get value() { return normalizePhone(sel.value, inp.value); } };
}
function authShell(title, ...kids) {
  $app.replaceChildren(h('div', { class: 'wrap' }, h('div', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, '🐱 A', h('b', null, 'Date'))),
    h('div', { class: 'panel stack' }, h('h2', { style: 'margin:0' }, title), ...kids), footer()));
}
function login() {
  document.title = 'ADate – Log in';
  const ph = phoneInputs('961'), pw = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Password', 'aria-label': 'Password' }), msg = h('div');
  const go = async () => {
    if (!ph.value) return msg.replaceChildren(h('div', { class: 'note' }, 'Check your number first.'));
    msg.replaceChildren(h('p', { class: 'hint spark' }, 'Logging in…'));
    try { await API.login(ph.value, pw.value); location.hash = '#/mine'; } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, e.message)); }
  };
  pw.onkeydown = (e) => { if (e.key === 'Enter') go(); };
  authShell('📬 Log in to your inbox', h('p', { class: 'hint' }, 'Your login is your WhatsApp number. Lebanon: just the 8 digits.'), phoneRow(ph.sel, ph.inp), pw,
    h('button', { class: 'btn pri block', onclick: go }, 'Log in'), msg, h('a', { href: '#/recover' }, 'Forgot your password?'), h('a', { href: '#/' }, 'No account yet? Create an invite →'));
}
function recover() {
  document.title = 'ADate – Reset password';
  const ph = phoneInputs('961'), box = h('div', { class: 'stack' });
  async function askQuestion() {
    if (!ph.value) return box.replaceChildren(h('div', { class: 'note' }, 'Check your number first.'));
    try {
      const { question } = await API.recoverQuestion(ph.value);
      const ans = h('input', { type: 'text', placeholder: 'Your answer', 'aria-label': 'Answer' }), pw = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'New password (6+ characters)' }), msg = h('div');
      box.replaceChildren(h('b', null, question), ans, pw, h('button', { class: 'btn pri block', onclick: async () => {
        try { await API.recover(ph.value, ans.value, pw.value); location.hash = '#/mine'; } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, e.message)); }
      } }, 'Set new password'), msg);
    } catch (e) { box.replaceChildren(h('div', { class: 'note' }, e.message)); }
  }
  authShell('🔑 Reset your password', h('p', { class: 'hint' }, 'Enter your number and answer the question you picked when you created your account.'), phoneRow(ph.sel, ph.inp), h('button', { class: 'btn block', onclick: askQuestion }, 'Continue'), box,
    h('p', { class: 'hint' }, 'Still stuck? Message the site owner on GitHub and we will reset it for you.'));
}
function details(a) {
  return h('div', { class: 'kv' }, a.date ? h('div', null, h('b', null, '📅 '), fmtDate(a.date) + (a.time ? ' · ' + fmtTime(a.time) : '')) : null, a.act ? h('div', null, h('b', null, '✨ ' + (a.label || 'Plan') + ': '), a.act) : null,
    a.noCount ? h('div', null, h('b', null, '😈 Pressed “No”: '), a.noCount + ' time' + (a.noCount > 1 ? 's 😂' : '')) : null);
}
/** The big "notification" card: one new answer. */
function bigCard(r) {
  const card = h('div', { class: 'bigcard' }, h('div', { class: 'bc-top' }, h('span', { class: 'bc-bell' }, '🔔'), h('b', null, `${r.to_name || 'Someone'} answered your invite!`), h('span', { class: 'hint' }, ago(r.at))),
    h('h2', { class: 'bc-yes' }, '💖 ' + (r.to_name || 'They') + ' said YES!'), details(r.answer || {}), r.message ? h('div', { class: 'bubble big' }, r.message) : null,
    h('div', { class: 'row' }, r.phone ? h('a', { class: 'btn pri', target: '_blank', rel: 'noopener', href: 'https://wa.me/' + r.phone + '?text=' + encodeURIComponent('Can’t wait! 💖') }, '💬 Reply on WhatsApp') : null,
      r.ig ? h('a', { class: 'btn pri', target: '_blank', rel: 'noopener', href: 'https://instagram.com/' + encodeURIComponent(r.ig) }, '📸 @' + r.ig) : null,
      h('button', { class: 'btn', onclick: () => card.remove() }, 'Got it')));
  return card;
}
const SCREEN_NAME = { ask: 'The question', yay: 'Said YES', date: 'Choosing a day', time: 'Choosing a time', act: 'Choosing a plan', done: 'Writing the reply' };
function journey(s) {
  const ev = s.events || [], resp = s.responses || [], fixed = s.config && s.config.dateMode === 'fixed';
  const order = ['ask', 'yay'].concat(fixed ? [] : ['date', 'time'], ['act', 'done']);
  const reached = new Set(ev.filter((e) => e.kind === 'step').map((e) => e.data && e.data.s)); if (resp.length) order.forEach((k) => reached.add(k));
  const noMax = Math.max(0, ...ev.filter((e) => e.kind === 'no').map((e) => (e.data && e.data.n) || 0));
  const hm = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const line = (e) => {
    const d = e.data || {};
    if (e.kind === 'leave') return `👋 Left the page (was on “${SCREEN_NAME[d.s] || d.s}”)`;
    if (e.kind === 'no') return `😈 Pressed “No” #${d.n}${d.t ? ': “' + d.t + '”' : ''}`;
    if (d.s === 'ask') return '👀 Opened the invite';
    if (d.s === 'yay') return '💖 Pressed YES';
    if (d.s === 'date') return '📅 Choosing a day';
    if (d.s === 'time') return '⏰ Picked ' + (d.date ? fmtDate(d.date) : 'a day') + ', choosing a time';
    if (d.s === 'act') return '✨ Picked ' + (d.time ? fmtTime(d.time) : 'a time') + ', choosing a plan';
    if (d.s === 'done') return '✍️ Picked “' + (d.act || 'a plan') + '”, writing the reply';
    return '• ' + (d.s || e.kind);
  };
  const items = ev.filter((e) => e.kind !== 'open').map((e) => ({ at: e.at, text: line(e), step: e.kind === 'step' })).concat(resp.map((r) => ({ at: r.at, text: '💌 Sent the answer' })));
  items.sort((a, b) => new Date(a.at) - new Date(b.at));
  items.forEach((it, i) => { const nx = items[i + 1]; if (it.step && nx) { const sec = (new Date(nx.at) - new Date(it.at)) / 1000; if (sec >= 1 && sec < 900) it.text += ' · ' + (sec < 90 ? Math.round(sec) + 's' : Math.round(sec / 60) + ' min'); } });
  const last = order.filter((k) => reached.has(k)).pop();
  const visitors = new Set(ev.map((e) => e.visitor).filter(Boolean)).size;
  const lastLeave = ev.filter((e) => e.kind === 'leave').pop();
  const verdict = resp.length ? '✅ Finished all the steps and sent the answer.' : !ev.length ? 'No steps recorded yet.' : last === 'ask' ? '⏸ Stopped at the question' + (noMax ? ` (pressed “No” ${noMax} time${noMax > 1 ? 's' : ''})` : '') + '.' : `⏸ Stopped at “${SCREEN_NAME[last]}”` + (lastLeave ? ' and left the page.' : '.');
  return h('details', { class: 'journey', open: '' }, h('summary', null, '🧭 Their journey'),
    h('div', { class: 'row', style: 'margin:6px 0' }, order.map((k) => h('span', { class: 'badge ' + (reached.has(k) ? 'ok' : '') }, (reached.has(k) ? '✓ ' : '· ') + SCREEN_NAME[k])), resp.length ? null : null),
    h('p', { style: 'margin:4px 0;font-weight:600' }, verdict), visitors > 1 ? h('p', { class: 'hint', style: 'margin:0' }, `Opened from ${visitors} different phones/browsers.`) : null,
    items.length ? h('div', { class: 'tl' }, items.slice(-40).map((i) => h('div', null, h('span', { class: 'hint', style: 'min-width:4.5em' }, hm(i.at)), i.text))) : null);
}
function inviteCard(rec, loader) {
  const card = h('div', { class: 'inv' }), head = h('header', null, h('h3', null, `${PRESETS[rec.type] ? PRESETS[rec.type].emoji : '💌'} For ${rec.to}`), h('span', { class: 'badge' }, 'loading…'));
  const body = h('div', { class: 'tl' }); card.append(head, body);
  async function load() {
    try {
      const s = await loader(rec);
      const answered = s.responses && s.responses.length;
      head.lastChild.replaceWith(h('span', { class: 'badge ' + (answered ? 'ok' : s.opens ? 'warn' : '') }, answered ? '✅ Answered' : s.opens ? '👀 Opened' : '⏳ Not opened yet'));
      const rows = [h('div', null, '📨 Created ' + ago(s.created_at)), h('div', null, s.opens ? `👀 Opened ${s.opens} time${s.opens > 1 ? 's' : ''} · last ${ago(s.last_opened_at)}` : '👀 Not opened yet'), journey(s)];
      (s.responses || []).forEach((r) => rows.push(h('div', { class: 'inv', style: 'box-shadow:none;background:var(--bg);margin:0' }, h('b', null, '💖 They said YES · ' + ago(r.at)), details(r.answer || {}),
        r.phone ? h('div', { class: 'kv' }, h('div', null, h('b', null, '📱 '), h('a', { href: 'https://wa.me/' + r.phone, target: '_blank', rel: 'noopener' }, '+' + r.phone))) : null,
        r.ig ? h('div', { class: 'kv' }, h('div', null, h('b', null, '📸 '), h('a', { href: 'https://instagram.com/' + encodeURIComponent(r.ig), target: '_blank', rel: 'noopener' }, '@' + r.ig))) : null, r.message ? h('div', { class: 'bubble' }, r.message) : null)));
      if (s.config && !s.config.toContact) { // older invites were made before this was required
        let v = { contact: '' }; const save = h('button', { class: 'btn sm pri', disabled: true }), msg = h('span', { class: 'hint' });
        const pick = contactPicker({ kind: 'wa', cc: s.config.cc || '961', phone: '', ig: '' }, (x) => { v = x; save.disabled = !x.contact; });
        save.textContent = 'Save'; save.onclick = async () => { save.disabled = true; try { await API.update(rec.id, rec.token, Object.assign({}, s.config, { toKind: v.kind, toCc: v.cc, toPhone: v.phone, toIg: v.ig, toContact: v.contact })); msg.textContent = 'Saved ✓'; } catch (e) { msg.textContent = e.message || 'Could not save'; save.disabled = false; } };
        rows.push(h('div', { class: 'note' }, h('b', null, 'Add who this is for'), h('p', { class: 'hint', style: 'margin:4px 0' }, 'Their WhatsApp number or Instagram. Only you and the site owner see it.'), pick, h('div', { class: 'row' }, save, msg)));
      }
      rows.push(h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: async (e) => { e.currentTarget.textContent = (await copyText(inviteUrl(rec.id))) ? 'Copied ✓' : 'Copy failed'; } }, 'Copy invite link'),
        h('button', { class: 'btn sm danger', onclick: async () => { if (confirm('Delete this invite and its answers for good?')) { try { await API.remove(rec.id, rec.token); } catch (e) { /* already gone */ } store.set('adate.mine', myInvites().filter((x) => x.id !== rec.id)); route(); } } }, 'Delete')));
      body.replaceChildren(...rows);
    } catch (e) { head.lastChild.replaceWith(h('span', { class: 'badge warn' }, 'Not found')); body.replaceChildren(h('p', { class: 'hint' }, 'This invite could not be loaded. It may have been deleted.')); }
  }
  load(); card.reload = load; return card;
}
const b64ToBytes = (b) => { const p = '='.repeat((4 - (b.length % 4)) % 4), r = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
async function pushControl() { // "tell me on my phone when they open / answer"
  if (!API.vapid) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
    return h('div', { class: 'note' }, ios && !standalone ? '📲 To get phone notifications on iPhone: tap Share, then “Add to Home Screen”, open ADate from your home screen, and come back here.' : 'This browser can’t show phone notifications. Try Chrome on Android, or add ADate to your iPhone home screen.');
  const box = h('div');
  async function draw() {
    const reg = await navigator.serviceWorker.getRegistration('/'), sub = reg && await reg.pushManager.getSubscription();
    if (Notification.permission === 'denied') return box.replaceChildren(h('div', { class: 'note' }, '🔕 Notifications are blocked for this site. Allow them in your browser settings, then reload.'));
    if (sub && Notification.permission === 'granted') return box.replaceChildren(h('div', { class: 'note' }, '🔔 Notifications are on for this phone. ', h('button', { class: 'btn sm', onclick: async () => { try { await API.pushUnsubscribe(sub.endpoint); await sub.unsubscribe(); } catch (e) { /* ignore */ } draw(); } }, 'Turn off')));
    box.replaceChildren(h('button', { class: 'btn pri block', onclick: async (e) => {
      e.currentTarget.disabled = true;
      try {
        if (await Notification.requestPermission() !== 'granted') return draw();
        const r = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
        const s = (await r.pushManager.getSubscription()) || await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(API.vapid) });
        await API.pushSubscribe(s.toJSON());
      } catch (x) { box.replaceChildren(h('div', { class: 'note' }, 'Could not turn notifications on: ' + x.message)); return; }
      draw();
    } }, '🔔 Notify me on this phone when they open or answer'));
  }
  await draw(); return box;
}
async function inbox() { // logged-in inbox: new answers first as big cards, then all invites
  document.title = 'ADate – My inbox';
  if (!API.enabled) { $app.replaceChildren(h('div', { class: 'wrap' }, h('div', { class: 'panel' }, h('h2', null, 'Inbox is off in demo mode'), h('p', null, 'The inbox needs the backend.'), h('a', { class: 'btn', href: '#/' }, 'Back')))); return; }
  if (!API.session) { location.hash = '#/login'; return; }
  const top = h('div'), list = h('div'), who = h('span', { class: 'hint' }), push = h('div', { style: 'margin:8px 0' });
  $app.replaceChildren(h('div', { class: 'wrap' }, h('div', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, '🐱 A', h('b', null, 'Date')),
    h('button', { class: 'btn sm', onclick: async () => { await API.logout(); location.hash = '#/'; } }, 'Log out')),
    h('div', { class: 'h2' }, '📬 My inbox'), who, push, top, list, h('p', { class: 'hint', style: 'margin-top:14px' }, 'This page updates by itself.'), footer()));
  pushControl().then((n) => n && push.replaceChildren(n)).catch(() => {});
  let cards = [];
  async function load() {
    let d;
    try { d = await API.me(); } catch (e) { if (/log in/i.test(e.message)) { API.clear(); location.hash = '#/login'; return; } top.replaceChildren(h('div', { class: 'note' }, e.message)); return; }
    who.textContent = (d.user.name ? d.user.name + ' · ' : '') + '+' + d.user.phone;
    top.replaceChildren(...d.unseen.map(bigCard));
    if (!d.invites.length) { list.replaceChildren(h('div', { class: 'panel' }, h('p', null, 'No invites yet. Create one and her answer shows up here.'), h('a', { class: 'btn pri', href: '#/' }, '+ New invite'))); return; }
    cards = d.invites.map((i) => inviteCard({ id: i.id, to: i.to_name || 'Someone', type: i.type }, (r) => API.inbox(r.id)));
    list.replaceChildren(h('div', { class: 'row', style: 'margin:10px 0' }, h('a', { class: 'btn sm pri', href: '#/' }, '+ New invite')), ...cards);
    const seen = new Set(d.unseen.map((u) => u.invite_id)); seen.forEach((id) => API.inbox(id).catch(() => {})); // showing them marks them as read
  }
  await load();
  clearInterval(pollTimer); pollTimer = setInterval(load, 20000);
}
function dash(arg) { // legacy private link (works without login)
  const [id, token] = String(arg).split('.');
  if (!/^[a-z0-9]{6,16}$/.test(id || '') || !/^[a-z0-9]{16,40}$/.test(token || '')) return brokenLink();
  document.title = 'ADate – Invite';
  const card = inviteCard({ id, token, to: 'your invite', type: 'custom' }, (r) => API.status(r.id, r.token));
  $app.replaceChildren(h('div', { class: 'wrap' }, h('div', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, '🐱 A', h('b', null, 'Date'))), h('div', { class: 'h2' }, '📬 Your invite'), card, footer()));
  clearInterval(pollTimer); pollTimer = setInterval(() => card.reload(), 15000);
}

/* ------------------------------------------------------------------ privacy + owner dashboard */
function privacy() {
  document.title = 'ADate – Privacy';
  $app.replaceChildren(h('div', { class: 'wrap' }, h('div', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, '🐱 A', h('b', null, 'Date'))),
    h('div', { class: 'panel' }, h('h2', null, 'Privacy, in plain words'),
      h('p', null, 'ADate is a free demo. To deliver an invite and its answer we keep: the names you type, your WhatsApp number, the WhatsApp number or Instagram of the person the invite is for, the invite you design (including any pictures you upload), and the answer, message and the WhatsApp number or Instagram the other person sends back.'),
      h('p', null, 'While someone goes through an invite we also keep which screens they reached and how many times they pressed “No”, so the sender can see how far they got. The invite page says so.'),
      h('p', null, 'The invite is reachable by anyone who has its link. Only you (through your private link) can see its answers. The site owner can see the numbers and names to run and improve the service.'),
      h('p', null, 'You can delete an invite and all its answers any time from “My invites”. We never sell your data. Don’t upload pictures of people who haven’t agreed to it.')), footer()));
}
async function admin() {
  document.title = 'ADate – Owner';
  const key0 = (() => { try { return sessionStorage.getItem('adate.key') || ''; } catch (e) { return ''; } })();
  const out = h('div'), inp = h('input', { type: 'text', placeholder: 'Owner key', value: key0, autocomplete: 'off' });
  let tab = 'contacts';
  async function load() {
    const key = inp.value.trim(); if (!key) return;
    out.replaceChildren(h('p', { class: 'hint spark' }, 'Loading…'));
    try {
      const d = await API.admin(key); try { sessionStorage.setItem('adate.key', key); } catch (e) { /* ignore */ }
      const st = d.stats, num = (v) => h('div', { class: 'panel', style: 'flex:1;min-width:96px;text-align:center;margin:0;padding:10px' }, h('b', { style: 'font-size:1.5rem' }, v[0]), h('div', { class: 'hint' }, v[1]));
      const wa = (n) => (n ? h('a', { href: 'https://wa.me/' + n, target: '_blank', rel: 'noopener' }, '+' + n) : '—');
      const contactLink = (c) => (!c ? '—' : c[0] === '@' ? h('a', { href: 'https://instagram.com/' + encodeURIComponent(c.slice(1)), target: '_blank', rel: 'noopener' }, c) : wa(c));
      const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const csv = () => { const cols = ['created_at', 'type', 'sender_name', 'sender_phone', 'to_name', 'opens', 'answers', 'last_answer_at', 'to_contact', 'receiver_phone', 'receiver_ig', 'id']; const blob = new Blob([[cols.join(',')].concat(d.invites.map((r) => cols.map((c) => q(r[c])).join(','))).join('\n')], { type: 'text/csv' }); h('a', { href: URL.createObjectURL(blob), download: 'adate-invites.csv' }).click(); };
      const csvUsers = () => { const cols = ['created_at', 'name', 'phone', 'email', 'last_login_at', 'invites']; const blob = new Blob([[cols.join(',')].concat(d.users.map((r) => cols.map((c) => q(r[c])).join(','))).join('\n')], { type: 'text/csv' }); h('a', { href: URL.createObjectURL(blob), download: 'adate-users.csv' }).click(); };
      const note = h('div');
      const views = {
        users: () => [h('div', { class: 'row', style: 'margin:8px 0' }, h('button', { class: 'btn sm pri', onclick: csvUsers }, '⬇ Export users CSV')), note, ...d.users.map((u) => h('div', { class: 'inv' }, h('header', null, h('h3', null, '👤 ' + (u.name || 'No name')), h('span', { class: 'badge' }, u.invites + ' invites')),
          h('div', { class: 'kv' }, h('div', null, h('b', null, 'Number: '), wa(u.phone)), h('div', null, h('b', null, 'Email: '), u.email || '—'), h('div', null, h('b', null, 'Joined: '), ago(u.created_at) + (u.last_login_at ? ' · last login ' + ago(u.last_login_at) : '')),
            h('div', { class: 'hint' }, 'Passwords are stored scrambled (nobody can read them). Reset gives a temporary one.')),
          h('button', { class: 'btn sm', onclick: async () => { if (!confirm('Reset the password for +' + u.phone + '?')) return; try { const r = await API.adminReset(key, u.phone); note.replaceChildren(h('div', { class: 'note' }, 'Temporary password for +' + r.phone + ': ', h('b', null, r.temp), '. Send it to them; they can change it with “Forgot password”.')); } catch (e) { note.replaceChildren(h('div', { class: 'note' }, e.message)); } } }, 'Reset password')))],
        invites: () => [h('div', { class: 'row', style: 'margin:8px 0' }, h('button', { class: 'btn sm pri', onclick: csv }, '⬇ Export invites CSV')), ...d.invites.map((r) => h('div', { class: 'inv' }, h('header', null, h('h3', null, `${(PRESETS[r.type] || {}).emoji || '💌'} ${r.sender_name || '?'} → ${r.to_name || '?'}`), h('span', { class: 'badge ' + (r.answers ? 'ok' : r.opens ? 'warn' : '') }, r.answers ? '✅ answered' : r.opens ? '👀 opened' : '⏳ new')),
          h('div', { class: 'kv' }, h('div', null, h('b', null, 'Sender: '), wa(r.sender_phone)), h('div', null, h('b', null, 'For: '), contactLink(r.to_contact)), r.receiver_phone || r.receiver_ig ? h('div', null, h('b', null, 'They left: '), r.receiver_phone ? wa(r.receiver_phone) : null, r.receiver_phone && r.receiver_ig ? ' · ' : '', r.receiver_ig ? contactLink('@' + r.receiver_ig) : null) : null, h('div', null, h('b', null, 'Created: '), ago(r.created_at) + ' · opened ' + r.opens + '×' + (r.last_answer_at ? ' · answered ' + ago(r.last_answer_at) : ''))),
          (() => { const slot = h('div'); return h('div', null, h('button', { class: 'btn sm', onclick: async (e) => { e.currentTarget.disabled = true; try { slot.replaceChildren(journey(await API.adminInvite(key, r.id))); } catch (x) { slot.replaceChildren(h('div', { class: 'note' }, x.message)); } } }, '🧭 Journey'), slot); })()))],
        contacts: () => {
          const rows = d.invites.map((r) => ({ r, got: !!(r.receiver_phone || r.receiver_ig) }));
          const csvC = () => { const cols = ['created_at', 'sender_name', 'sender_phone', 'to_name', 'to_contact', 'receiver_phone', 'receiver_ig', 'confirmed']; const body = rows.map(({ r, got }) => cols.map((c) => q(c === 'confirmed' ? (got ? 'yes' : 'no') : r[c])).join(',')); const blob = new Blob([[cols.join(',')].concat(body).join('\n')], { type: 'text/csv' }); h('a', { href: URL.createObjectURL(blob), download: 'adate-contacts.csv' }).click(); };
          return [h('p', { class: 'hint' }, `${rows.filter((x) => x.got).length} of ${rows.length} receivers confirmed their own contact. “For” is what the sender typed; “They left” is what the receiver typed herself.`),
            h('div', { class: 'row', style: 'margin:8px 0' }, h('button', { class: 'btn sm pri', onclick: csvC }, '⬇ Export contacts CSV')),
            ...rows.map(({ r, got }) => h('div', { class: 'inv' }, h('header', null, h('h3', null, `${r.sender_name || '?'} → ${r.to_name || '?'}`), h('span', { class: 'badge ' + (got ? 'ok' : 'warn') }, got ? '✅ confirmed by her' : '⏳ not confirmed')),
              h('div', { class: 'kv' }, h('div', null, h('b', null, 'Sender: '), wa(r.sender_phone)), h('div', null, h('b', null, 'For (typed by sender): '), contactLink(r.to_contact)),
                got ? h('div', null, h('b', null, 'They left: '), r.receiver_phone ? wa(r.receiver_phone) : null, r.receiver_phone && r.receiver_ig ? ' · ' : '', r.receiver_ig ? contactLink('@' + r.receiver_ig) : null) : null)))];
        },
        answers: () => d.answers.map((a) => h('div', { class: 'inv' }, h('header', null, h('h3', null, `💖 ${a.to_name || '?'} → ${a.sender_name || '?'}`), h('span', { class: 'hint' }, ago(a.at))),
          h('div', { class: 'kv' }, h('div', null, h('b', null, 'Sender: '), wa(a.sender_phone)), a.receiver_phone || a.receiver_ig ? h('div', null, h('b', null, 'Receiver: '), a.receiver_phone ? wa(a.receiver_phone) : null, a.receiver_phone && a.receiver_ig ? ' · ' : '', a.receiver_ig ? contactLink('@' + a.receiver_ig) : null) : null, a.answer && a.answer.date ? h('div', null, h('b', null, 'Date: '), fmtDate(a.answer.date) + (a.answer.time ? ' · ' + fmtTime(a.answer.time) : '') + (a.answer.act ? ' · ' + a.answer.act : '')) : null),
          a.message ? h('div', { class: 'bubble' }, a.message) : h('div', { class: 'note' }, 'No message was saved.')))
      };
      const draw = () => out.replaceChildren(h('div', { class: 'row' }, num([st.users, 'accounts']), num([st.invites, 'invites']), num([st.opened, 'opened']), num([st.answered, 'answered']), num([st.phones, 'numbers'])),
        h('div', { class: 'row', style: 'margin:12px 0' }, [['contacts', '📇 Contacts'], ['invites', '💌 Invites'], ['answers', '💖 Answers'], ['users', '👤 Accounts']].map(([id, l]) => h('button', { class: 'chip', 'aria-pressed': tab === id ? 'true' : 'false', onclick: () => { tab = id; draw(); } }, l)), h('button', { class: 'btn sm', onclick: load }, '↻ Refresh')), ...views[tab]());
      draw();
    } catch (e) { out.replaceChildren(h('div', { class: 'note' }, e.message)); }
  }
  inp.onkeydown = (e) => { if (e.key === 'Enter') load(); };
  $app.replaceChildren(h('div', { class: 'wrap' }, h('div', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, '🐱 A', h('b', null, 'Date')), h('span', { class: 'pill' }, 'Owner')),
    h('div', { class: 'h2' }, '🔐 Owner dashboard'), h('div', { class: 'fieldrow' }, inp, h('button', { class: 'btn pri', onclick: load }, 'Open')), h('div', { style: 'height:12px' }), out));
  if (key0) load();
}

/* ------------------------------------------------------------------ router */
function setRobots(index) { // invites, inboxes and the owner page must never show up in search results
  let m = document.querySelector('meta[name=robots]');
  if (!m) { m = document.createElement('meta'); m.name = 'robots'; document.head.append(m); }
  m.content = index ? 'index,follow,max-image-preview:large' : 'noindex,nofollow';
}
async function route() {
  await API.ready;
  setRobots(!/^#\/(i|v|d|mine|admin|make|login|recover)/.test(location.hash || ''));
  if (editor.cleanup) { editor.cleanup(); editor.cleanup = null; }
  clearInterval(pollTimer);
  document.querySelectorAll('.modal').forEach((m) => m.remove());
  const hash = location.hash || '#/';
  if (hash.startsWith('#/v/')) return viewer('v', hash.slice(4));
  if (hash.startsWith('#/i/')) return API.enabled ? viewer('i', hash.slice(4)) : brokenLink();
  if (hash.startsWith('#/d/')) return dash(hash.slice(4));
  if (hash === '#/mine') return inbox();
  if (hash === '#/login') return login();
  if (hash === '#/recover') return recover();
  if (hash === '#/privacy') return privacy();
  if (hash === '#/admin') return admin();
  if (hash === '#/make') return editor();
  return home();
}
window.addEventListener('hashchange', route);
// A tab left open for hours keeps old code. When it comes back to the front, reload if a newer build is live.
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !CFG.build) return;
  try { const j = await (await fetch('/version.json', { cache: 'no-store' })).json(); if (j && j.build && j.build !== CFG.build) location.reload(); } catch (e) { /* offline: keep going */ }
});
route();
})();
