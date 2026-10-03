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
/** The receiver's WhatsApp number: picked from her phone's contacts where the browser allows it (so it is a real number, not typed), typed otherwise. Instagram is optional. */
function waPicker(cc0, onChange) {
  const canPick = !!(navigator.contacts && navigator.contacts.select);
  const st = { cc: COUNTRIES.some((c) => c[0] === cc0) ? cc0 : '961', phone: '', ig: '', src: '', contact: '' };
  const out = () => ({ contact: st.contact, ig: igHandle(st.ig), src: st.src });
  const status = h('p', { class: 'hint' });
  const sel = h('select', { style: 'flex:0 0 46%', 'aria-label': 'Country' }, COUNTRIES.map(([c, l]) => h('option', { value: c, selected: c === st.cc }, l)));
  const tel = h('input', { type: 'tel', inputmode: 'numeric', maxlength: 16, 'aria-label': 'WhatsApp number' });
  const row = h('div', { class: 'fieldrow' }, sel, tel);
  const igIn = h('input', { type: 'text', maxlength: 80, placeholder: '@username (optional)', autocapitalize: 'none', autocomplete: 'off', spellcheck: false, 'aria-label': 'Instagram account' });
  const paint = () => { status.textContent = st.contact ? '✓ +' + st.contact + (st.src === 'contact' ? ' · from your contacts' : '') : (canPick ? 'Tap the button and choose your own contact card.' : st.phone ? 'That number doesn’t look right yet.' : 'Your number without the country code.'); status.style.color = !st.contact && st.phone ? '#c0392b' : ''; onChange(out()); };
  tel.oninput = () => { st.phone = digits(tel.value); st.contact = normalizePhone(st.cc, st.phone); st.src = st.contact ? 'typed' : ''; paint(); };
  sel.onchange = () => { st.cc = sel.value; tel.oninput(); };
  igIn.oninput = () => { st.ig = igIn.value; paint(); };
  const pickBtn = canPick ? h('button', { class: 'btn pri', type: 'button', onclick: async () => {
    try {
      const r = await navigator.contacts.select(['tel'], { multiple: false }), raw = r && r[0] && r[0].tel && r[0].tel[0]; if (!raw) return;
      const d = digits(raw), n = /^\s*(\+|00)/.test(raw) ? d.replace(/^00/, '') : (normalizePhone(st.cc, d) || '');
      st.contact = n.length >= 8 && n.length <= 15 ? n : ''; st.src = st.contact ? 'contact' : ''; st.phone = st.contact; paint();
      if (!st.contact) status.textContent = 'That contact has no usable number. Pick another.';
    } catch (e) { /* cancelled */ }
  } }, 'Choose my number from contacts') : null;
  const box = h('div', { class: 'stack' }, pickBtn, canPick ? null : row, status, h('b', null, 'Instagram (optional)'), igIn);
  paint();
  return box;
}
/** "WhatsApp number or Instagram" picker. onChange gets { kind, cc, phone, ig, contact } where contact is '' until it is valid. */
function contactPicker(init, onChange) {
  const st = { kind: init.kind === 'ig' ? 'ig' : 'wa', cc: COUNTRIES.some((c) => c[0] === init.cc) ? init.cc : '961', phone: digits(init.phone), ig: init.ig || '' };
  const out = () => ({ kind: st.kind, cc: st.cc, phone: digits(st.phone), ig: st.ig, contact: st.kind === 'wa' ? normalizePhone(st.cc, st.phone) : (igHandle(st.ig) ? '@' + igHandle(st.ig) : '') });
  const status = h('p', { class: 'hint' });
  const sel = h('select', { style: 'flex:0 0 46%', 'aria-label': 'Country' }, COUNTRIES.map(([c, l]) => h('option', { value: c, selected: c === st.cc }, l)));
  const tel = h('input', { type: 'tel', inputmode: 'numeric', maxlength: 16, value: st.phone, 'aria-label': 'WhatsApp number' });
  const row = h('div', { class: 'fieldrow' }, sel, tel);
  const igLabel = h('b', null, 'Instagram (optional)'), igIn = h('input', { type: 'text', maxlength: 80, value: st.ig, placeholder: '@username or instagram.com/username', autocapitalize: 'none', autocomplete: 'off', spellcheck: false, 'aria-label': 'Instagram account' });
  const chips = h('div', { class: 'row' });
  const paint = () => {
    const o = out(); row.style.display = st.kind === 'wa' ? '' : 'none'; igIn.style.display = st.kind === 'ig' ? '' : 'none';
    tel.placeholder = st.cc === '961' ? '70 123 456' : 'number';
    [...chips.children].forEach((c) => c.setAttribute('aria-pressed', c.dataset.k === st.kind ? 'true' : 'false'));
    const raw = st.kind === 'wa' ? st.phone : st.ig.trim();
    status.textContent = !raw ? (st.kind === 'wa' ? (st.cc === '961' ? 'Lebanon: just the 8 digits.' : 'Number without the country code.') : 'The account name or its link.') : o.contact ? '✓ ' + (st.kind === 'wa' ? '+' + o.contact : o.contact + ' · instagram.com/' + o.contact.slice(1)) : 'That doesn’t look right yet.';
    status.style.color = raw && !o.contact ? '#c0392b' : '';
    onChange && onChange(o);
  };
  [['wa', 'WhatsApp'], ['ig', 'Instagram']].forEach(([k, l]) => chips.append(h('button', { class: 'chip', type: 'button', 'data-k': k, onclick: () => { st.kind = k; paint(); } }, l)));
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
      const wa = cfg.contact && cfg.waReply ? h('a', { class: 'gbtn', style: 'text-decoration:none;display:inline-block', target: '_blank', rel: 'noopener', href: `https://wa.me/${cfg.contact}?text=${encodeURIComponent(`*💖 ${cfg.to || 'They'} said YES! 💖*\n\n${state.msg || ''}\n\n_Sent with O HUB · ${location.host}_`)}` }, `Open WhatsApp again`) : null;
      return [frameContent(cfg), h('h1', { class: 'title' }, 'Sent! 💌'), h('p', { class: 'sub2' }, cfg.from ? `${cfg.from} will see your answer very soon.` : 'Your answer is on its way.'), wa,
        h('a', { class: 'gbtn no', style: 'text-decoration:none;display:inline-block;margin-top:3cqw;font-size:.8em', href: location.pathname + '#/' }, 'Make your own invite')];
    }
    const ctxFor = (extra) => Object.assign({ vibe: cfg.type === 'romantic' ? 'flirty' : cfg.vibe, variant: n, from: cfg.from, to: cfg.to, date: fmtDate(state.date), time: fmtTime(state.time), act: state.act, label,
      pickup: cfg.pickup && state.date ? pickupText(F(cfg.pickup), state.date) : '' }, extra);
    let n = 0, touched = false;
    state.msg = AI.compose(ctxFor());                                     // ready instantly, so it is never empty
    const ta = h('textarea', { class: 'msg big', rows: '9', maxlength: '900', 'aria-label': 'Your message' }); ta.value = state.msg;
    ta.oninput = () => { touched = true; state.msg = ta.value; };
    const tag = h('p', { class: 'caption', style: 'margin:0' }, 'written for you · edit it if you like');
    async function upgrade() { // the AI may replace the opening lines, but only if she hasn't touched the text
      const op = await AI.opening(ctxFor());
      if (op && !touched && ta.isConnected) { state.msg = AI.compose(ctxFor({ opening: op })); ta.value = state.msg; tag.textContent = 'written by AI · edit it if you like'; }
    }
    function another() { n++; touched = false; state.msg = AI.compose(ctxFor()); ta.value = state.msg; tag.textContent = 'new version · edit it if you like'; upgrade(); }
    const again = h('button', { class: 'gbtn no', style: 'font-size:.75em', onclick: another }, '↻ Another version');
    const needContact = !!(opts.inviteId && window.API && API.enabled);   // the preview in the editor does not ask
    let me = { contact: '', ig: '', src: '' }, sendBtn = null;
    let capT = null, lastCap = '';
    const capture = () => { clearTimeout(capT); capT = setTimeout(() => { const k = (me.contact || '') + '|' + (me.ig || ''); if ((me.contact || me.ig) && k !== lastCap) { lastCap = k; track('contact', { phone: me.contact, ig: me.ig, src: me.src }); } }, 1200); };
    const mine = waPicker(cfg.cc, (v) => { me = v; if (sendBtn) sendBtn.disabled = needContact && !v.contact; capture(); });
    const contactBox = h('div', { class: 'stack cbox', style: 'margin-top:7cqw' }, h('b', null, 'Your WhatsApp number *'), h('p', { class: 'caption', style: 'margin:0' }, needContact ? `So ${cfg.from || 'they'} can reach you. Only they and the site owner see it. We save it as soon as you type it.` : 'Preview: she must add her own WhatsApp number here before she can send.'), mine);
    const waOn = !!(cfg.contact && cfg.waReply);
    const waText = (m) => `*💖 ${cfg.to || 'They'} said YES! 💖*\n\n${m}\n\n_Sent with O HUB · ${location.host}_`;
    const waUrl = (m) => `https://wa.me/${cfg.contact}?text=${encodeURIComponent(waText(m))}`;
    const send = h('button', { class: 'gbtn', disabled: needContact && !me.contact }, waOn ? 'Send on WhatsApp' : 'Send to ' + (cfg.from || 'them') + ' 💌');
    sendBtn = send;
    const siteOnly = waOn && opts.inviteId && window.API && API.enabled ? h('button', { class: 'gbtn no', style: 'font-size:.7em', onclick: () => deliver(false) }, 'Send on the website only') : null;
    const note = h('p', { class: 'nocap' }, ' ');
    async function deliver(openWa) {
      const msg = (ta.value || '').trim() || AI.compose(ctxFor()); state.msg = msg;
      const answer = { yes: true, date: state.date, time: state.time, act: state.act, noCount: state.noCount, label, src: me.src || undefined };
      if (needContact && !me.contact) { note.textContent = 'Add your WhatsApp number first 🙏'; return; }
      const myNum = me.contact, myIg = me.ig;
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
  document.title = 'O HUB – Make a cute invite';
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
    notif,
    h('div', { class: 'topbar' }, h('div', { class: 'brand' }, h('b', null, 'HUB')),
      API.enabled ? (API.session ? h('a', { class: 'btn sm pri', href: '#/mine' }, 'Inbox ', badge) : [h('a', { class: 'btn sm', href: '#/login' }, 'Log in'), h('a', { class: 'btn sm pri', href: '#/signup' }, 'Sign up')]) : null),
    h('div', { class: 'hero' }, h('div', { class: 'stks' }, stk('cat-orange', 'animation-delay:-1s'), stk('cat-love', 'width:72px'), stk('cat-white', 'animation-delay:-2s')),
      h('h1', null, 'Create your private invite'), h('p', null, 'For your girlfriend, your boyfriend, a friend or your birthday. Add their name, pick a vibe, and send a link with a sneaky “No” button.')),
    draft ? h('div', { class: 'row', style: 'justify-content:center;margin-bottom:6px' }, h('button', { class: 'btn pri sm', onclick: () => (location.hash = '#/make') }, 'Continue my invite')) : null,
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
  document.title = 'O HUB – Editor';
  let cfg = store.get('adate.draft', null);
  if (!cfg) { location.hash = '#/'; return; }
  cfg = sanitize(cfg);
  const me = API.enabled ? API.session : null;                       // signed in: the number and name come from the profile, nothing to type twice
  if (me && me.phone) { cfg.contact = digits(me.phone); cfg.phone = ''; if (!cfg.from) cfg.from = me.name || ''; }
  let step = clamp(store.get('adate.step', 0) | 0, 0, 6), sel = null, mode = 'edit', screen = 'ask';
  const meta = () => store.get('adate.draftmeta', null); // {id, token} once the invite exists
  const save = () => store.set('adate.draft', cfg);

  /* --- live previews (desktop side pane, inline stage on the sticker step) */
  const pvSide = h('div', { class: 'stagewrap' }); let inline = null;
  const screenRow = h('div', { class: 'row', style: 'justify-content:center' }, [['ask', 'Ask'], ['yay', 'Yay'], ['date', 'Day'], ['time', 'Time'], ['act', 'Options'], ['done', 'Final']].map(([id, l]) =>
    h('button', { class: 'chip', 'data-s': id, 'aria-pressed': id === screen ? 'true' : 'false', onclick: () => { screen = id; screenRow.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.s === id ? 'true' : 'false')); mode = 'edit'; syncMode(); refresh(); } }, l)));
  const modeBtns = { edit: h('button', { class: 'chip', onclick: () => { mode = 'edit'; syncMode(); refresh(); } }, 'Edit view'), play: h('button', { class: 'chip', onclick: () => { mode = 'play'; syncMode(); refresh(); } }, '▶ Test it') };
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
    m.append(h('div', { class: 'mt' }, h('button', { class: 'btn sm', onclick: play }, '↻ Restart'), h('button', { class: 'btn pri sm', onclick: () => m.remove() }, 'Close')), box);
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
        h('div', { class: 'sugg-foot' }, h('span', { class: status === 'wait' ? 'spark' : '' }, status === 'ai' ? 'written by AI' : status === 'wait' ? 'asking the AI…' : 'quick ideas'),
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
      row.append(h('button', { class: 'ai-btn', type: 'button', onclick: sg.load }, 'Suggest')); out.push(sg.box);
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
      status.textContent = !cfg.phone ? (cfg.cc === '961' ? 'Lebanon: just the 8 digits, no 961 and no 0 needed.' : 'Your number without the country code.') : cfg.contact ? 'Looks good: +' + cfg.contact : 'That number doesn’t look right yet.';
      status.style.color = cfg.phone && !cfg.contact ? '#c0392b' : '';
    };
    inp.oninput = check; sel.onchange = check; check();
    return h('div', { class: 'stack' }, h('b', null, 'Your WhatsApp number *'), h('div', { class: 'fieldrow' }, sel, inp), status,
      h('label', { class: 'row', style: 'gap:10px' }, h('input', { type: 'checkbox', checked: cfg.waReply, onchange: (e) => { cfg.waReply = e.target.checked; save(); } }), 'Let them also reply to me on WhatsApp'));
  }
  /** Their WhatsApp number (required) and Instagram (optional), laid out as one clear card. */
  function theirContact() {
    const status = h('p', { class: 'hint' }), igStatus = h('p', { class: 'hint' });
    const sel = h('select', { style: 'flex:0 0 46%', 'aria-label': 'Their country' }, COUNTRIES.map(([c, l]) => h('option', { value: c, selected: c === cfg.toCc }, l)));
    const tel = h('input', { type: 'tel', inputmode: 'numeric', maxlength: 16, value: cfg.toPhone, placeholder: cfg.toCc === '961' ? '70 123 456' : 'number', 'aria-label': 'Their WhatsApp number' });
    const ig = h('input', { type: 'text', maxlength: 80, value: cfg.toIg, placeholder: '@username', autocapitalize: 'none', autocomplete: 'off', spellcheck: false, 'aria-label': 'Their Instagram (optional)' });
    const paint = () => {
      cfg.toKind = 'wa'; cfg.toCc = sel.value; cfg.toPhone = digits(tel.value); cfg.toContact = normalizePhone(cfg.toCc, cfg.toPhone); cfg.toIg = igHandle(ig.value) || ig.value.trim(); save();
      tel.placeholder = cfg.toCc === '961' ? '70 123 456' : 'number';
      status.textContent = !cfg.toPhone ? (cfg.toCc === '961' ? 'Lebanon: just the 8 digits, no 0.' : 'Their number without the country code.') : cfg.toContact ? '✓ +' + cfg.toContact : 'That number doesn’t look right yet.';
      status.style.color = cfg.toPhone && !cfg.toContact ? '#c0392b' : '';
      igStatus.textContent = !cfg.toIg ? '' : igHandle(cfg.toIg) ? 'instagram.com/' + igHandle(cfg.toIg) : 'That doesn’t look like an Instagram account.'; igStatus.style.color = cfg.toIg && !igHandle(cfg.toIg) ? '#c0392b' : '';
    };
    tel.oninput = paint; sel.onchange = paint; ig.oninput = paint; paint();
    return h('div', { class: 'stepbox stack' }, h('b', null, 'Their WhatsApp number *'), h('p', { class: 'hint', style: 'margin:0' }, 'Very important: this is how we know who the invite is for. Only you and the site owner see it.'),
      h('div', { class: 'fieldrow' }, sel, tel), status, h('b', null, 'Their Instagram (optional)'), ig, igStatus);
  }
  const step1Problem = () => (!cfg.to.trim() ? 'Write their name first.' : !cfg.toContact ? 'Add their WhatsApp number first. It is required.' : cfg.toIg && !igHandle(cfg.toIg) ? 'Their Instagram does not look right. Fix it or clear it.' : '');
  function stepNames() {
    return [
      h('div', { class: 'stack' }, h('b', null, 'They are…'), h('div', { class: 'row' }, REL.map(([id, l]) => h('button', { class: 'chip', 'aria-pressed': cfg.rel === id ? 'true' : 'false', onclick: (e) => { cfg.rel = id; e.currentTarget.parentNode.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === e.currentTarget ? 'true' : 'false')); save(); } }, l)))),
      plain('Their name *', 'to', { ph: 'e.g. Lina' }),
      theirContact(),
      h('div', { class: 'stack' }, h('b', null, 'What do they call you?'), h('p', { class: 'hint' }, 'Your first name or the nickname you use together. This is the name they see on the invite.'), plain('', 'from', { ph: 'e.g. Sam or Bebe' })),
      h('div', { class: 'stack' }, h('b', null, 'The vibe of your words'), h('p', { class: 'hint' }, 'The ✨ suggestions will write in this style.'),
        h('div', { class: 'row' }, AI.VIBES.map(([id, l]) => h('button', { class: 'chip', 'aria-pressed': cfg.vibe === id ? 'true' : 'false', onclick: (e) => { cfg.vibe = id; e.currentTarget.parentNode.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === e.currentTarget ? 'true' : 'false')); save(); } }, l)))),
      me && me.phone ? h('label', { class: 'row', style: 'gap:10px' }, h('input', { type: 'checkbox', checked: cfg.waReply, onchange: (e) => { cfg.waReply = e.target.checked; save(); } }), 'Let them also reply to me on WhatsApp (+' + me.phone + ')') : phoneField()
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
    THEME_GROUPS.forEach(([g, ids]) => out.push(h('div', { class: 'h2', style: 'margin:0' }, g === 'Lebanon' ? '🇱🇧 Lebanon' : g === 'World' ? 'World' : 'Vibes'), h('div', { class: 'wp' }, ids.map(thumb))));
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
        h('button', { class: 'btn sm danger', onclick: removeSel }, 'Delete')));
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
    const needAcct = () => API.enabled && !API.session;
    const problems = () => [!cfg.to.trim() && 'their name (step 1)', API.enabled && !cfg.contact && 'your WhatsApp number (step 1)', !cfg.toContact && 'their WhatsApp number or Instagram (step 1)',
      API.enabled && !consent.checked && 'tick the privacy box below'].filter(Boolean);
    function acctBlock() {
      if (!API.enabled) return null;
      const sess = API.session;
      if (sess) return h('div', { class: 'note' }, '✅ Signed in as ' + (sess.name || '+' + sess.phone) + '. ', h('button', { class: 'btn sm', onclick: async () => { await API.logout(); store.set('adate.after', '#/make'); location.hash = '#/login'; } }, 'Not you? Log out'));
      return h('div', { class: 'note' }, 'Please sign in first. ', h('a', { href: '#/login', onclick: () => store.set('adate.after', '#/make') }, 'Sign in →'));
    }
    const warn = () => { const p = problems(); return p.length ? h('div', { class: 'note' }, 'Almost there. Still needed: ' + p.join(', ') + '.') : null; };
    async function publish(createNew) {
      if (problems().length) { out.replaceChildren(warn(), ...ask()); return; }
      if (needAcct()) { store.set('adate.after', '#/make'); location.hash = '#/login'; return; }
      out.replaceChildren(h('p', { class: 'hint spark' }, 'creating your link…'));
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
          priv ? h('div', { class: 'note' }, h('b', null, 'Her answer lands in your inbox. '), 'Sign in any time to read it. A big card shows up when she answers.',
            h('div', { class: 'row', style: 'margin-top:8px' }, h('a', { class: 'btn sm pri', href: '#/mine' }, 'Open my inbox'),
              h('button', { class: 'btn sm', onclick: async (e) => { e.currentTarget.textContent = (await copyText(priv)) ? 'Copied ✓' : 'Select & copy'; } }, 'Copy backup link (no login)'),
              cfg.contact ? h('a', { class: 'btn sm', target: '_blank', rel: 'noopener', href: 'https://wa.me/' + cfg.contact + '?text=' + encodeURIComponent('My O HUB inbox: ' + location.href.split('#')[0] + '#/mine') }, 'Save it on my WhatsApp') : null)) : null,
          API.enabled ? h('button', { class: 'btn sm', onclick: () => publish(true) }, 'Create a brand-new link instead') : null].filter(Boolean));
      } catch (e) { out.replaceChildren(h('div', { class: 'note' }, 'Something went wrong: ' + e.message), h('button', { class: 'btn pri', onclick: () => publish(false) }, 'Try again')); }
    }
    const m = meta();
    const ask = () => [acctBlock(), API.enabled ? h('label', { class: 'row', style: 'gap:10px;align-items:flex-start', for: 'consent' }, consent, h('span', { class: 'hint' }, 'I agree that O HUB keeps this invite, my number and their answer so it can be delivered to me. ', h('a', { href: '#/privacy' }, 'Privacy'))) : null,
      h('div', { class: 'note' }, 'On the last page ' + (cfg.to || 'they') + ' must add their own WhatsApp number (picked from their contacts when the phone allows it) before sending. You will see it in your inbox. Their Instagram is optional.'),
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
  const pvBtn = h('button', { class: 'btn pvbtn', onclick: openPreview }, 'Preview');
  function drawBody() {
    inline = null; sel = step === 5 ? sel : sel;
    body.replaceChildren(...STEPS[step][2]().filter(Boolean));
    if (inline) mountStage(inline, 'edit');
  }
  function go(n) {
    if (n > step && step === 0) { const bad = step1Problem(); if (bad) { body.querySelectorAll('.gatenote').forEach((x) => x.remove()); body.append(h('div', { class: 'note gatenote' }, '👆 ' + bad)); (body.querySelector('.gatenote') || body).scrollIntoView({ block: 'center', behavior: 'smooth' }); return; } }
    step = clamp(n, 0, STEPS.length - 1); store.set('adate.step', step);
    dots.replaceChildren(...STEPS.map((s, i) => h('button', { class: 'dot' + (i < step ? ' done' : ''), 'aria-current': i === step ? 'step' : null, 'aria-label': s[1], title: s[1], onclick: () => go(i) }, s[0])));
    title.textContent = `${step + 1}. ${STEPS[step][1]}`;
    prev.classList.toggle('hidden', step === 0); next.classList.toggle('hidden', step === STEPS.length - 1);
    drawBody(); window.scrollTo({ top: 0 });
  }
  const pv = h('div', { class: 'pvside' }, h('div', { class: 'row', style: 'justify-content:center' }, modeBtns.edit, modeBtns.play), screenRow, pvSide);
  $app.replaceChildren(h('div', { class: 'wiz' },
    h('div', { class: 'head' }, h('div', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, h('b', null, 'HUB')),
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
  $app.replaceChildren(h('div', { class: 'authwall' }, h('div', { class: 'wrap authwrap' },
    h('div', { class: 'authlogo' }, window.OppaLogo ? window.OppaLogo(96) : null, h('b', null, h('i', null, 'HUB'))), h('p', { class: 'authtag' }, 'Meet people. Play games. Make friends.'),
    h('div', { class: 'panel stack authcard' }, h('h2', { style: 'margin:0' }, title), ...kids), footer())));
}
const INTERESTS = [['🎮', 'Gaming'], ['🎵', 'Music'], ['📚', 'Books'], ['🎬', 'Movies & series'], ['⚽', 'Football'], ['💪', 'Gym & fitness'], ['✈️', 'Travel'], ['🍳', 'Cooking'], ['🐶', 'Animals'], ['🎨', 'Art & drawing'], ['📷', 'Photography'], ['💻', 'Tech & coding'],
  ['👗', 'Fashion'], ['🌿', 'Nature & hiking'], ['🍥', 'Anime'], ['☕', 'Coffee spots'], ['🎤', 'Singing'], ['💃', 'Dancing'], ['🧠', 'Psychology'], ['🚗', 'Cars'], ['🏖️', 'Beach'], ['🎲', 'Board games'], ['✍️', 'Writing'], ['🗣️', 'Languages']];
function goAfterAuth() {
  const s = API.session, to = store.get('adate.after', null);
  const ref = store.get('adate.ref', null); if (ref && s) { API.refJoin(ref).catch(() => {}); store.set('adate.ref', null); }
  if (to === '#/make' && s && !s.profile_done) { location.hash = '#/welcome'; return; }
  store.set('adate.after', null); location.hash = to || (s && !s.profile_done ? '#/welcome' : '#/');
}
function loadGsi() {
  return new Promise((ok) => {
    if (window.google && window.google.accounts) return ok();
    const sc = h('script', { src: 'https://accounts.google.com/gsi/client', async: '', onload: () => ok(), onerror: () => ok() }); document.head.append(sc);
  });
}
/** The "Continue with Google" button. */
function googleButton(onError) {
  const host = h('div', { style: 'display:flex;justify-content:center;min-height:44px' }, h('span', { class: 'hint spark' }, 'Loading Google…'));
  loadGsi().then(() => {
    if (!(window.google && window.google.accounts)) { host.replaceChildren(h('span', { class: 'hint' }, 'Could not load Google. Check your connection.')); return; }
    google.accounts.id.initialize({ client_id: API.google, callback: async (r) => { try { await API.googleLogin(r.credential); goAfterAuth(); } catch (e) { onError(e.message); } } });
    host.replaceChildren(); google.accounts.id.renderButton(host, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: 280 });
  });
  return host;
}
/** Password box: dark readable text and an eye to show/hide what you typed. */
function pwField(placeholder, autocomplete, label) {
  const inp = h('input', { type: 'password', autocomplete, placeholder, 'aria-label': placeholder });
  const eye = h('button', { type: 'button', class: 'eye', 'aria-label': 'Show password', onclick: () => { const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; eye.textContent = show ? '🙈' : '👁️'; eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); } }, '👁️');
  const box = h('div', { class: 'pwwrap' }, h('b', { class: 'pwlabel' }, label || placeholder), h('div', { class: 'pwbox' }, inp, eye)); box.input = inp; return box;
}
function login(mode) {
  mode = mode === 'signup' ? 'signup' : 'login';
  document.title = 'O HUB – ' + (mode === 'signup' ? 'Sign up' : 'Log in');
  const ph = phoneInputs('961'), msg = h('div'), pw = pwField(mode === 'signup' ? 'Create a password (6+ characters)' : 'Password', mode === 'signup' ? 'new-password' : 'current-password', mode === 'signup' ? 'Create a password (6+ characters)' : 'Your password');
  const pw2 = pwField('Type the password again', 'new-password', 'Type the password again');
  const Q = (API.questions && API.questions.length) ? API.questions : ['What is your pet’s name?'], qa = { q: Q[0], a: h('input', { type: 'text', placeholder: 'Your answer', 'aria-label': 'Security answer' }), a2: h('input', { type: 'text', placeholder: 'Brand and model, e.g. iPhone 15', 'aria-label': 'Second answer' }), email: h('input', { type: 'text', inputmode: 'email', autocomplete: 'email', autocapitalize: 'none', placeholder: 'you@gmail.com', 'aria-label': 'Email' }) };
  const submit = async () => {
    if (!ph.value) return msg.replaceChildren(h('div', { class: 'note' }, 'Check your number first.'));
    if (mode === 'signup') {
      if (pw.input.value.length < 6) return msg.replaceChildren(h('div', { class: 'note' }, 'Password needs at least 6 characters.'));
      if (pw.input.value !== pw2.input.value) return msg.replaceChildren(h('div', { class: 'note' }, 'The two passwords are not the same.'));
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(qa.email.value.trim())) return msg.replaceChildren(h('div', { class: 'note' }, 'Write your email correctly. It is how you get your account back.'));
      if (qa.a.value.trim().length < 2 || qa.a2.value.trim().length < 2) return msg.replaceChildren(h('div', { class: 'note' }, 'Answer both security questions, they help you get back in.'));
    }
    msg.replaceChildren(h('p', { class: 'hint spark' }, mode === 'signup' ? 'Creating your account…' : 'Logging in…'));
    try {
      if (mode === 'signup') await API.signup({ phone: ph.value, name: '', email: qa.email.value.trim(), password: pw.input.value, question: qa.q, answer: qa.a.value, answer2: qa.a2.value });
      else await API.login(ph.value, pw.input.value);
      goAfterAuth();
    } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, e.message), /already has an account/i.test(e.message) ? h('button', { class: 'btn sm', onclick: () => login('login') }, 'Log in instead') : null); }
  };
  pw.input.onkeydown = (e) => { if (e.key === 'Enter' && mode === 'login') submit(); };
  const tabs = h('div', { class: 'tabs2' }, [['login', 'Log in'], ['signup', 'Sign up']].map(([m, l]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': m === mode ? 'true' : 'false', onclick: () => login(m) }, l)));
  const form = h('div', { class: 'stack' }, h('p', { class: 'hint' }, mode === 'signup' ? 'Your number is your login. Lebanon: just the 8 digits.' : 'Your WhatsApp number and your password.'), phoneRow(ph.sel, ph.inp), pw,
    mode === 'signup' ? [pw2, h('b', { class: 'pwlabel' }, 'Your email (to get your account back)'), qa.email, h('p', { class: 'hint' }, 'If you forget your password we ask you two questions. Only you should know the answers.'), h('label', { class: 'f' }, 'Question 1', h('select', { onchange: (e) => { qa.q = e.target.value; } }, Q.map((q) => h('option', { value: q }, q)))), qa.a, h('b', { class: 'pwlabel' }, 'Question 2: ' + API.q2), qa.a2] : null,
    h('button', { class: 'btn pri block', onclick: submit }, mode === 'signup' ? 'Create my account' : 'Log in'), mode === 'login' ? h('a', { href: '#/recover' }, 'Forgot your password?') : null);
  authShell(mode === 'signup' ? 'Create your account' : 'Welcome back', tabs,
    API.google ? [googleButton((m) => msg.replaceChildren(h('div', { class: 'note' }, m))), h('div', { class: 'or' }, 'or with your number')] : null, form, msg, h('a', { href: '#/' }, '← Back'));
}
/** After signing in: name, number, birthday and interests. Needed once, before the O HUB game. */
function profile() {
  document.title = 'O HUB – Your profile';
  if (!API.session) { location.hash = '#/login'; return; }
  const st = { first: '', last: '', d: '', m: '', y: '', interests: new Set(), email: '', q: (API.questions || [])[0] || 'What is your pet’s name?' }, U = {}, ph = phoneInputs('961'), pwP = pwField('Create a password (6+ characters)', 'new-password', 'Create a password (6+ characters)'), pwP2 = pwField('Type the password again', 'new-password', 'Type the password again'), ansA = h('input', { type: 'text', placeholder: 'Your answer', 'aria-label': 'Security answer' }), ansB = h('input', { type: 'text', placeholder: 'Brand and model, e.g. iPhone 15', 'aria-label': 'Second answer' }), msg = h('div'), host = h('div', { class: 'stack' }, h('p', { class: 'hint spark' }, 'Loading…'));
  const draw = () => {
    const chips = h('div', { class: 'row' }, INTERESTS.map(([e, l]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': st.interests.has(l) ? 'true' : 'false', onclick: (ev) => {
      if (st.interests.has(l)) st.interests.delete(l); else if (st.interests.size < 10) st.interests.add(l); else { msg.replaceChildren(h('div', { class: 'note' }, 'Up to 10 interests.')); return; }
      ev.currentTarget.setAttribute('aria-pressed', st.interests.has(l) ? 'true' : 'false'); count.textContent = st.interests.size + ' / 10'; msg.replaceChildren(); } }, e + ' ' + l)));
    const count = h('span', { class: 'hint' }, st.interests.size + ' / 10');
    const sel = (key, opts, ph0) => h('select', { 'aria-label': ph0, onchange: (e) => { st[key] = e.target.value; } }, h('option', { value: '' }, ph0), opts.map(([v, l]) => h('option', { value: v, selected: String(st[key]) === String(v) }, l)));
    const yr = new Date().getFullYear();
    const save = async () => {
      const bd = st.y && st.m && st.d ? `${st.y}-${String(st.m).padStart(2, '0')}-${String(st.d).padStart(2, '0')}` : '';
      const age = bd ? Math.floor((Date.now() - new Date(bd + 'T00:00:00Z')) / 31557600000) : 0;
      const em = st.email.trim(), badEmail = !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em), needPw = !U.has_password, needRec = !U.has_recovery;
      const bad = !st.first.trim() ? 'Add your first name.' : badEmail ? 'Write your email correctly.' : needPw && pwP.input.value.length < 6 ? 'Password needs at least 6 characters.' : needPw && pwP.input.value !== pwP2.input.value ? 'The two passwords are not the same.' : needRec && (ansA.value.trim().length < 2 || ansB.value.trim().length < 2) ? 'Answer both security questions.' : !st.last.trim() ? 'Add your last name.' : !ph.value ? 'Check your WhatsApp number.' : !bd || isNaN(new Date(bd)) ? 'Pick your birthday.' : age < 13 ? 'O HUB is for ages 13 and up.' : !st.interests.size ? 'Pick at least one interest.' : '';
      if (bad) return msg.replaceChildren(h('div', { class: 'note' }, bad));
      msg.replaceChildren(h('p', { class: 'hint spark' }, 'Saving…'));
      try { const r = await API.profileSet({ first_name: st.first.trim(), last_name: st.last.trim(), phone: ph.value, email: em, birthdate: bd, interests: [...st.interests], password: pwP.input.value, password2: pwP2.input.value, question: st.q, answer: ansA.value, answer2: ansB.value }); let cfgS = {}; try { cfgS = await API.publicSettings(); } catch (e) { /* optional */ } if (cfgS.owner_whatsapp && !(r.user && r.user.verified)) { location.hash = '#/verify'; return; } goAfterAuth(); }
      catch (e) { msg.replaceChildren(h('div', { class: 'note' }, e.message)); }
    };
    const lp = h('input', { type: 'tel', inputmode: 'numeric', placeholder: 'Old number', 'aria-label': 'Old phone number' }), lwb = pwField('Old password', 'current-password', 'Your old password'), lw = lwb.input, lmsg = h('div');
    const link = h('details', null, h('summary', { class: 'hint' }, 'Link my old account (number + password)'), h('div', { class: 'stack' }, h('p', { class: 'hint' }, 'Brings the invites and answers of your older account into this one.'), lp, lwb,
      h('button', { class: 'btn sm', onclick: async () => { try { await API.linkLegacy(digits(lp.value), lw.value); lmsg.replaceChildren(h('div', { class: 'note' }, '✅ Linked. Your old invites are here now.')); } catch (e) { lmsg.replaceChildren(h('div', { class: 'note' }, e.message)); } } }, 'Link it'), lmsg));
    host.replaceChildren(
      h('div', { class: 'fieldrow' }, h('input', { type: 'text', placeholder: 'First name', value: st.first, autocomplete: 'given-name', 'aria-label': 'First name', oninput: (e) => { st.first = e.target.value; } }), h('input', { type: 'text', placeholder: 'Last name', value: st.last, autocomplete: 'family-name', 'aria-label': 'Last name', oninput: (e) => { st.last = e.target.value; } })),
      h('b', null, 'Your WhatsApp number *'), phoneRow(ph.sel, ph.inp),
      h('b', null, 'Your email *'), h('input', { type: 'text', inputmode: 'email', autocomplete: 'email', autocapitalize: 'none', value: st.email, readonly: U.google ? '' : null, 'aria-label': 'Email', oninput: (e) => { st.email = e.target.value; } }), U.google ? h('p', { class: 'hint' }, 'From your Google account.') : null,
      h('b', null, 'Your birthday *'), h('div', { class: 'fieldrow' }, sel('d', Array.from({ length: 31 }, (_, i) => [i + 1, String(i + 1)]), 'Day'), sel('m', MONTHS.map((n, i) => [i + 1, n]), 'Month'), sel('y', Array.from({ length: 88 }, (_, i) => [yr - 13 - i, String(yr - 13 - i)]), 'Year')),
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('b', null, 'Your interests * (pick up to 10)'), count), chips,
      !U.has_password ? h('div', { class: 'stack' }, h('b', null, 'Choose a password *'), h('p', { class: 'hint' }, 'So you can also sign in with your number.'), pwP, pwP2) : null,
      !U.has_recovery ? h('div', { class: 'stack' }, h('b', null, 'If you forget your password *'), h('p', { class: 'hint' }, 'We ask you two questions. Only you should know the answers.'), h('label', { class: 'f' }, 'Question 1', h('select', { onchange: (e) => { st.q = e.target.value; } }, ((API.questions && API.questions.length) ? API.questions : [st.q]).map((q) => h('option', { value: q, selected: q === st.q }, q)))), ansA, h('b', null, 'Question 2: ' + API.q2), ansB) : null,
      h('button', { class: 'btn pri block', onclick: save }, 'Save and continue'), msg, link);
  };
  (async () => {
    try {
      const u = (await API.me()).user || {}; Object.assign(U, u); st.email = u.email || '';
      st.first = u.first_name || u.name || ''; st.last = u.last_name || '';
      if (u.birthdate) { const [y, m, d] = u.birthdate.split('-').map(Number); st.y = y; st.m = m; st.d = d; }
      (u.interests || []).forEach((i) => st.interests.add(i));
      if (u.phone) { const c = COUNTRIES.map((x) => x[0]).sort((a, b) => b.length - a.length).find((x) => u.phone.startsWith(x)); if (c) { ph.sel.value = c; ph.inp.value = u.phone.slice(c.length); } }
      if (u.profile_done && store.get('adate.after', null) === '#/make') return goAfterAuth();
    } catch (e) { if (/log in/i.test(e.message)) { API.clear(); location.hash = '#/login'; return; } }
    draw();
  })();
  authShell('Tell us about you', h('p', { class: 'hint' }, 'Once, before your first invite. Your number is only used so people can answer you on WhatsApp. Nobody else sees your birthday.'), host);
}

/** First-time welcome: one question per screen (name, nickname, avatar, birthday, interests, contact). */
function welcome() {
  document.title = 'O HUB – Welcome';
  if (!API.session) { location.hash = '#/login'; return; }
  const U = {}, ph = phoneInputs('961'), pw1 = pwField('Create a password (6+ characters)', 'new-password', 'Create a password (6+ characters)'), pw2 = pwField('Type the password again', 'new-password', 'Type the password again');
  const st = { step: 0, first: '', last: '', nick: '', avatar: '', gender: '', meet: 'both', langs: new Set(['English']), d: '', m: '', y: '', interests: new Set(), email: '', q: (API.questions || [])[0] || 'What is your pet’s name?', saved: false };
  const ansA = h('input', { type: 'text', placeholder: 'Your answer', 'aria-label': 'Security answer' }), ansB = h('input', { type: 'text', placeholder: 'Brand and model, e.g. iPhone 15', 'aria-label': 'Second answer' });
  const msg = h('div'), root = h('div', { class: 'wz' });
  const yr = new Date().getFullYear(), emailOk = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());
  const bdate = () => st.y && st.m && st.d ? `${st.y}-${String(st.m).padStart(2, '0')}-${String(st.d).padStart(2, '0')}` : '';
  const ageNow = () => { const b = bdate(); return b ? Math.floor((Date.now() - new Date(b + 'T00:00:00Z')) / 31557600000) : 0; };
  const steps = [
    { title: 'What’s your name?', hint: 'Your real name is never shown. Other people only see your nickname.', check: () => !st.first.trim() ? 'Add your first name.' : !st.last.trim() ? 'Add your last name.' : '',
      body: () => [h('input', { type: 'text', placeholder: 'First name', value: st.first, autocomplete: 'given-name', 'aria-label': 'First name', oninput: (e) => { st.first = e.target.value; } }), h('input', { type: 'text', placeholder: 'Last name', value: st.last, autocomplete: 'family-name', 'aria-label': 'Last name', oninput: (e) => { st.last = e.target.value; } })] },
    { title: 'Pick a nickname', hint: 'This is the only name people will see. 2 to 20 letters or numbers.', check: () => !/^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,19}$/u.test(st.nick.trim()) ? 'Nickname: 2 to 20 letters or numbers.' : '',
      body: () => [h('input', { type: 'text', placeholder: 'Nickname', value: st.nick, maxlength: 20, autocomplete: 'off', 'aria-label': 'Nickname', oninput: (e) => { st.nick = e.target.value; } })] },
    { title: 'Choose your avatar', hint: 'Pick an animal. A real photo is possible later for 25 coins a month.', check: () => !st.avatar ? 'Pick an avatar.' : '',
      body: () => [h('div', { class: 'avs wide' }, (window.ANIMALS || []).map(([k, e]) => h('button', { type: 'button', class: 'avbtn' + (st.avatar === 'animal:' + k ? ' on' : ''), 'aria-label': k, onclick: () => { st.avatar = 'animal:' + k; draw(); } }, e)))] },
    { title: 'When is your birthday?', hint: 'Your full birthday stays private. We use it to keep you in the right age group.', check: () => { const b = bdate(); return !b || isNaN(new Date(b)) ? 'Pick your birthday.' : ageNow() < 13 ? 'O HUB is for ages 13 and up.' : ''; },
      body: () => { const sel = (key, opts, p0) => h('select', { 'aria-label': p0, onchange: (e) => { st[key] = e.target.value; } }, h('option', { value: '' }, p0), opts.map(([v, l]) => h('option', { value: v, selected: String(st[key]) === String(v) }, l)));
        return [h('div', { class: 'fieldrow' }, sel('d', Array.from({ length: 31 }, (_, i) => [i + 1, String(i + 1)]), 'Day'), sel('m', MONTHS.map((n, i) => [i + 1, n]), 'Month'), sel('y', Array.from({ length: 88 }, (_, i) => [yr - 13 - i, String(yr - 13 - i)]), 'Year'))]; } },
    { title: 'What are you into?', hint: 'Pick up to 10. We use them to match you with people.', check: () => !st.interests.size ? 'Pick at least one interest.' : '',
      body: () => { const count = h('span', { class: 'hint' }, st.interests.size + ' / 10');
        return [h('div', { class: 'row' }, INTERESTS.map(([e, l]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': st.interests.has(l) ? 'true' : 'false', onclick: (ev) => {
          if (st.interests.has(l)) st.interests.delete(l); else if (st.interests.size < 10) st.interests.add(l); else { msg.replaceChildren(h('div', { class: 'note' }, 'Up to 10 interests.')); return; }
          ev.currentTarget.setAttribute('aria-pressed', st.interests.has(l) ? 'true' : 'false'); count.textContent = st.interests.size + ' / 10'; msg.replaceChildren(); } }, e + ' ' + l))), count]; } },
    { title: 'Who are you, and who do you want to meet?', hint: 'We use this for random matching. You only meet people in your age group.', check: () => !st.gender ? 'Pick who you are.' : '',
      body: () => { const row = (arr, key) => h('div', { class: 'pickrow' }, arr.map(([v, e, l]) => h('button', { type: 'button', class: 'pickcard' + (st[key] === v ? ' on' : ''), onclick: () => { st[key] = v; draw(); } }, h('span', null, e), h('b', null, l))));
        return [h('b', null, 'I am'), row([['m', '👦', 'A guy'], ['f', '👧', 'A girl']], 'gender'), h('b', null, 'I want to meet'), row([['m', '👦', 'Guys'], ['both', '👥', 'Both'], ['f', '👧', 'Girls']], 'meet')]; } },
    { title: 'Which languages feel natural?', hint: 'Put the ones you speak best first. We try to match you with people who speak them too.', check: () => !st.langs.size ? 'Pick at least one language.' : '',
      body: () => [h('div', { class: 'row' }, ['English', 'العربية', 'Français', 'Türkçe', 'Español', 'Deutsch', 'Italiano', 'Русский', 'Kurdî', 'Հայերեն'].map((l) => h('button', { class: 'chip', type: 'button', 'aria-pressed': st.langs.has(l) ? 'true' : 'false', onclick: (ev) => { if (st.langs.has(l)) st.langs.delete(l); else if (st.langs.size < 5) st.langs.add(l); ev.currentTarget.setAttribute('aria-pressed', st.langs.has(l) ? 'true' : 'false'); } }, l)))] },
    { title: 'How can we reach you?', hint: 'Your number is used so people can answer you on WhatsApp, and to keep your account safe. Nobody sees it.', last: true,
      check: () => !emailOk(st.email) ? 'Write your email correctly.' : !ph.value ? 'Check your WhatsApp number.' : !U.has_password && pw1.input.value.length < 6 ? 'Password needs at least 6 characters.' : !U.has_password && pw1.input.value !== pw2.input.value ? 'The two passwords are not the same.' : !U.has_recovery && (ansA.value.trim().length < 2 || ansB.value.trim().length < 2) ? 'Answer both security questions.' : '',
      body: () => [h('b', null, 'Your WhatsApp number'), phoneRow(ph.sel, ph.inp), h('b', null, 'Your email'), h('input', { type: 'text', inputmode: 'email', autocomplete: 'email', autocapitalize: 'none', value: st.email, readonly: U.google ? '' : null, 'aria-label': 'Email', oninput: (e) => { st.email = e.target.value; } }),
        !U.has_password ? h('div', { class: 'stack' }, h('b', null, 'Choose a password'), pw1, pw2) : null,
        !U.has_recovery ? h('div', { class: 'stack' }, h('b', null, 'If you forget your password'), h('p', { class: 'hint' }, 'We ask you two questions. Only you should know the answers.'), h('label', { class: 'f' }, 'Question 1', h('select', { onchange: (e) => { st.q = e.target.value; } }, ((API.questions && API.questions.length) ? API.questions : [st.q]).map((q) => h('option', { value: q, selected: q === st.q }, q)))), ansA, h('b', null, 'Question 2: ' + API.q2), ansB) : null] }
  ];
  async function finish() {
    msg.replaceChildren(h('p', { class: 'hint spark' }, 'Creating your profile…'));
    try {
      let r = { user: {} };
      if (!st.saved) { r = await API.profileSet({ first_name: st.first.trim(), last_name: st.last.trim(), phone: ph.value, email: st.email.trim(), birthdate: bdate(), interests: [...st.interests], password: pw1.input.value, password2: pw2.input.value, question: st.q, answer: ansA.value, answer2: ansB.value }); st.saved = true; }
      try { await API.nickSet('*', st.nick.trim()); } catch (e) { st.step = 1; draw(); msg.replaceChildren(h('div', { class: 'note' }, e.message)); return; }
      try { await API.meSet({ avatar: st.avatar }); } catch (e) { /* the avatar can be changed later */ }
      try { await API.matchPrefs({ gender: st.gender, meet: st.meet, langs: [...st.langs] }); } catch (e) { /* asked again in Match */ }
      let cfgS = {}; try { cfgS = await API.publicSettings(); } catch (e) { /* optional */ }
      if (cfgS.owner_whatsapp && !(r.user && r.user.verified)) { location.hash = '#/verify'; return; }
      goAfterAuth();
    } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, e.message)); }
  }
  function draw() {
    const s = steps[st.step];
    const next = () => { const bad = s.check(); if (bad) return msg.replaceChildren(h('div', { class: 'note' }, bad)); msg.replaceChildren(); if (s.last) return finish(); st.step++; draw(); };
    root.replaceChildren(
      h('div', { class: 'wz-top' }, st.step > 0 ? h('button', { class: 'wz-back', 'aria-label': 'Back', onclick: () => { st.step--; msg.replaceChildren(); draw(); } }, '←') : h('span', { class: 'wz-back' }), h('div', { class: 'wz-bar', role: 'progressbar', 'aria-valuenow': st.step + 1, 'aria-valuemax': steps.length }, h('i', { style: `width:${Math.round((st.step + 1) / steps.length * 100)}%` })), h('button', { class: 'wz-mode', 'aria-label': 'Light or dark', onclick: () => { toggleMode(); } }, '🌓')),
      h('h1', { class: 'wz-h' }, s.title), h('p', { class: 'hint' }, s.hint), h('div', { class: 'stack wz-body' }, s.body()), msg,
      h('button', { class: 'wz-go', 'aria-label': s.last ? 'Finish' : 'Continue', onclick: next }, s.last ? '✓' : '→'));
    const first = root.querySelector('input[type=text]'); if (first && !first.readOnly) setTimeout(() => first.focus(), 30);
  }
  (async () => {
    try {
      const u = (await API.me()).user || {}; Object.assign(U, u); st.email = u.email || '';
      st.first = u.first_name || u.name || ''; st.last = u.last_name || '';
      if (u.birthdate) { const [y, m, d] = u.birthdate.split('-').map(Number); st.y = y; st.m = m; st.d = d; }
      (u.interests || []).forEach((i) => st.interests.add(i));
      if (u.phone) { const c = COUNTRIES.map((x) => x[0]).sort((a, b) => b.length - a.length).find((x) => u.phone.startsWith(x)); if (c) { ph.sel.value = c; ph.inp.value = u.phone.slice(c.length); } }
      if (u.profile_done) return goAfterAuth();
    } catch (e) { if (/log in/i.test(e.message)) { API.clear(); location.hash = '#/login'; return; } }
    draw();
  })();
  $app.replaceChildren(root);
}
/** Look: Auto (follows the phone), Light or Dark. Remembered on this phone. */
const modePref = () => { const m = store.get('adate.ui', null); return m === 'light' || m === 'dark' ? m : 'auto'; };
const applyMode = () => { const m = modePref(), sys = window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; document.documentElement.dataset.ui = m === 'auto' ? sys : m; };
function toggleMode() { const order = ['auto', 'light', 'dark'], nx = order[(order.indexOf(modePref()) + 1) % 3]; store.set('adate.ui', nx === 'auto' ? null : nx); applyMode(); return nx; }
if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (modePref() === 'auto') applyMode(); }); } catch (e) { /* old browser */ } }
/** Get your account back: your email + the answers to your two questions. */
function recover() {
  document.title = 'O HUB – Get your account back';
  const em = h('input', { type: 'text', inputmode: 'email', autocomplete: 'email', autocapitalize: 'none', placeholder: 'you@gmail.com', 'aria-label': 'Email' }), box = h('div', { class: 'stack' });
  async function start() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.value.trim())) return box.replaceChildren(h('div', { class: 'note' }, 'Write your email correctly.'));
    try {
      const { q1, q2 } = await API.recoverEmailStart(em.value.trim());
      const a1 = h('input', { type: 'text', placeholder: 'Your answer', 'aria-label': 'Answer 1' }), a2 = h('input', { type: 'text', placeholder: 'Your answer', 'aria-label': 'Answer 2' }), p1 = pwField('New password (6+ characters)', 'new-password', 'Your new password'), p2 = pwField('Type the new password again', 'new-password', 'Type it again'), msg = h('div');
      box.replaceChildren(h('b', null, q1), a1, h('b', null, q2), a2, p1, p2, h('button', { class: 'btn pri block', onclick: async () => {
        if (p1.input.value !== p2.input.value) return msg.replaceChildren(h('div', { class: 'note' }, 'The two passwords are not the same.'));
        try { await API.recoverEmail({ email: em.value.trim(), answer: a1.value, answer2: a2.value, password: p1.input.value, password2: p2.input.value }); location.hash = '#/mine'; } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, e.message)); }
      } }, 'Set my new password'), msg);
    } catch (e) { box.replaceChildren(h('div', { class: 'note' }, e.message)); }
  }
  authShell('Get your account back', h('p', { class: 'hint' }, 'Write the email of your account exactly. Then answer the two questions you chose and pick a new password.'), em, h('button', { class: 'btn block', onclick: start }, 'Continue'), box,
    h('a', { href: '#/recover-phone' }, 'Older account without an email? Use my number'), h('a', { href: '#/login' }, '← Back'));
}
/** After the profile: send a code on WhatsApp so the owner can check the number is real. */
async function verifyPage() {
  document.title = 'O HUB – Verify your number';
  if (!API.session) { location.hash = '#/login'; return; }
  const box = h('div', { class: 'stack' }, h('p', { class: 'hint spark' }, 'Loading…'));
  authShell('✅ Verify your number', box);
  let u = {}, st = {};
  try { u = (await API.me()).user || {}; st = await API.publicSettings(); } catch (e) { /* show what we can */ }
  const code = u.verify_code || '';
  box.replaceChildren(h('p', null, 'To prove this number is yours, send this code to us on WhatsApp. The owner checks it personally within a few days. You can use O HUB while you wait.'),
    h('div', { class: 'note', style: 'font-size:1.5rem;text-align:center;letter-spacing:.25em;font-weight:700' }, code || '…'),
    st.owner_whatsapp && code ? h('a', { class: 'btn pri block', target: '_blank', rel: 'noopener', href: 'https://wa.me/' + st.owner_whatsapp + '?text=' + encodeURIComponent('O HUB verify ' + code) }, 'Send the code on WhatsApp') : null,
    h('button', { class: 'btn block', onclick: () => goAfterAuth() }, 'Continue'));
}
function recoverPhone() {
  document.title = 'O HUB – Reset password';
  const ph = phoneInputs('961'), box = h('div', { class: 'stack' });
  async function askQuestion() {
    if (!ph.value) return box.replaceChildren(h('div', { class: 'note' }, 'Check your number first.'));
    try {
      const { question } = await API.recoverQuestion(ph.value);
      const ans = h('input', { type: 'text', placeholder: 'Your answer', 'aria-label': 'Answer' }), pwb = pwField('New password (6+ characters)', 'new-password', 'Your new password'), pw = pwb.input, msg = h('div');
      box.replaceChildren(h('b', null, question), ans, pwb, h('button', { class: 'btn pri block', onclick: async () => {
        try { await API.recover(ph.value, ans.value, pw.value); location.hash = '#/mine'; } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, e.message)); }
      } }, 'Set new password'), msg);
    } catch (e) { box.replaceChildren(h('div', { class: 'note' }, e.message)); }
  }
  authShell('Reset your password', h('p', { class: 'hint' }, 'Enter your number and answer the question you picked when you created your account.'), phoneRow(ph.sel, ph.inp), h('button', { class: 'btn block', onclick: askQuestion }, 'Continue'), box,
    h('p', { class: 'hint' }, 'Still stuck? Message the site owner on GitHub and we will reset it for you.'));
}
function details(a) {
  return h('div', { class: 'kv' }, a.date ? h('div', null, h('b', null, '📅 '), fmtDate(a.date) + (a.time ? ' · ' + fmtTime(a.time) : '')) : null, a.act ? h('div', null, h('b', null, '✨ ' + (a.label || 'Plan') + ': '), a.act) : null,
    a.noCount ? h('div', null, h('b', null, 'Pressed “No”: '), a.noCount + ' time' + (a.noCount > 1 ? 's 😂' : '')) : null);
}
/** The big "notification" card: one new answer. */
function bigCard(r) {
  const card = h('div', { class: 'bigcard' }, h('div', { class: 'bc-top' }, h('span', { class: 'bc-bell' }, '🔔'), h('b', null, `${r.to_name || 'Someone'} answered your invite!`), h('span', { class: 'hint' }, ago(r.at))),
    h('h2', { class: 'bc-yes' }, '💖 ' + (r.to_name || 'They') + ' said YES!'), details(r.answer || {}), r.message ? h('div', { class: 'bubble big' }, r.message) : null,
    h('div', { class: 'row' }, r.phone ? h('a', { class: 'btn pri', target: '_blank', rel: 'noopener', href: 'https://wa.me/' + r.phone + '?text=' + encodeURIComponent('Can’t wait! 💖') }, 'Reply on WhatsApp') : null,
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
    if (e.kind === 'leave') return `Left the page (was on “${SCREEN_NAME[d.s] || d.s}”)`;
    if (e.kind === 'no') return `Pressed “No” #${d.n}${d.t ? ': “' + d.t + '”' : ''}`;
    if (d.s === 'ask') return 'Opened the invite';
    if (d.s === 'yay') return 'Pressed YES';
    if (d.s === 'date') return 'Choosing a day';
    if (d.s === 'time') return 'Picked ' + (d.date ? fmtDate(d.date) : 'a day') + ', choosing a time';
    if (d.s === 'act') return 'Picked ' + (d.time ? fmtTime(d.time) : 'a time') + ', choosing a plan';
    if (d.s === 'done') return 'Picked “' + (d.act || 'a plan') + '”, writing the reply';
    return '• ' + (d.s || e.kind);
  };
  const items = ev.filter((e) => e.kind !== 'open').map((e) => ({ at: e.at, text: line(e), step: e.kind === 'step' })).concat(resp.map((r) => ({ at: r.at, text: 'Sent the answer' })));
  items.sort((a, b) => new Date(a.at) - new Date(b.at));
  items.forEach((it, i) => { const nx = items[i + 1]; if (it.step && nx) { const sec = (new Date(nx.at) - new Date(it.at)) / 1000; if (sec >= 1 && sec < 900) it.text += ' · ' + (sec < 90 ? Math.round(sec) + 's' : Math.round(sec / 60) + ' min'); } });
  const last = order.filter((k) => reached.has(k)).pop();
  const visitors = new Set(ev.map((e) => e.visitor).filter(Boolean)).size;
  const lastLeave = ev.filter((e) => e.kind === 'leave').pop();
  const verdict = resp.length ? '✅ Finished all the steps and sent the answer.' : !ev.length ? 'No steps recorded yet.' : last === 'ask' ? '⏸ Stopped at the question' + (noMax ? ` (pressed “No” ${noMax} time${noMax > 1 ? 's' : ''})` : '') + '.' : `⏸ Stopped at “${SCREEN_NAME[last]}”` + (lastLeave ? ' and left the page.' : '.');
  return h('details', { class: 'journey', open: '' }, h('summary', null, 'Their journey'),
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
      head.lastChild.replaceWith(h('span', { class: 'badge ' + (answered ? 'ok' : s.opens ? 'warn' : '') }, answered ? '✅ Answered' : s.opens ? 'Opened' : 'Not opened yet'));
      const rows = [h('div', null, 'Created ' + ago(s.created_at)), h('div', null, s.opens ? `Opened ${s.opens} time${s.opens > 1 ? 's' : ''} · last ${ago(s.last_opened_at)}` : 'Not opened yet'), journey(s)];
      (s.responses || []).forEach((r) => rows.push(h('div', { class: 'inv', style: 'box-shadow:none;background:var(--bg);margin:0' }, h('b', null, 'They said YES · ' + ago(r.at)), details(r.answer || {}),
        r.phone ? h('div', { class: 'kv' }, h('div', null, h('b', null, '📱 '), h('a', { href: 'https://wa.me/' + r.phone, target: '_blank', rel: 'noopener' }, '+' + r.phone))) : null,
        r.ig ? h('div', { class: 'kv' }, h('div', null, h('b', null, '📸 '), h('a', { href: 'https://instagram.com/' + encodeURIComponent(r.ig), target: '_blank', rel: 'noopener' }, '@' + r.ig))) : null, r.message ? h('div', { class: 'bubble' }, r.message) : null)));
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
    return h('div', { class: 'note' }, ios && !standalone ? 'To get phone notifications on iPhone: tap Share, then “Add to Home Screen”, open O HUB from your home screen, and come back here.' : 'This browser can’t show phone notifications. Try Chrome on Android, or add O HUB to your iPhone home screen.');
  const box = h('div');
  async function draw() {
    const reg = await navigator.serviceWorker.getRegistration('/'), sub = reg && await reg.pushManager.getSubscription();
    if (Notification.permission === 'denied') return box.replaceChildren(h('div', { class: 'note' }, 'Notifications are blocked for this site. Allow them in your browser settings, then reload.'));
    if (sub && Notification.permission === 'granted') return box.replaceChildren(h('div', { class: 'note' }, 'Notifications are on for this phone. ', h('button', { class: 'btn sm', onclick: async () => { try { await API.pushUnsubscribe(sub.endpoint); await sub.unsubscribe(); } catch (e) { /* ignore */ } draw(); } }, 'Turn off')));
    box.replaceChildren(h('button', { class: 'btn pri block', onclick: async (e) => {
      e.currentTarget.disabled = true;
      try {
        if (await Notification.requestPermission() !== 'granted') return draw();
        const r = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
        const s = (await r.pushManager.getSubscription()) || await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(API.vapid) });
        await API.pushSubscribe(s.toJSON());
      } catch (x) { box.replaceChildren(h('div', { class: 'note' }, 'Could not turn notifications on: ' + x.message)); return; }
      draw();
    } }, 'Notify me on this phone when they open or answer'));
  }
  await draw(); return box;
}
async function inbox() { // logged-in inbox: new answers first as big cards, then all invites
  document.title = 'O HUB – My inbox';
  if (!API.enabled) { $app.replaceChildren(h('div', { class: 'wrap' }, h('div', { class: 'panel' }, h('h2', null, 'Inbox is off in demo mode'), h('p', null, 'The inbox needs the backend.'), h('a', { class: 'btn', href: '#/' }, 'Back')))); return; }
  if (!API.session) { location.hash = '#/login'; return; }
  const top = h('div'), list = h('div'), who = h('span', { class: 'hint' }), push = h('div', { style: 'margin:8px 0' });
  $app.replaceChildren(h('div', { class: 'wrap' }, h('div', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, h('b', null, 'HUB')),
    h('button', { class: 'btn sm', onclick: async () => { await API.logout(); location.hash = '#/'; } }, 'Log out')),
    h('div', { class: 'h2' }, 'My inbox'), who, push, top, list, h('p', { class: 'hint', style: 'margin-top:14px' }, 'This page updates by itself.'), footer()));
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
  document.title = 'O HUB – Invite';
  const card = inviteCard({ id, token, to: 'your invite', type: 'custom' }, (r) => API.status(r.id, r.token));
  $app.replaceChildren(h('div', { class: 'wrap' }, h('div', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, h('b', null, 'HUB'))), h('div', { class: 'h2' }, 'Your invite'), card, footer()));
  clearInterval(pollTimer); pollTimer = setInterval(() => card.reload(), 15000);
}

/* ------------------------------------------------------------------ privacy + owner dashboard */
function privacy() {
  document.title = 'O HUB – Privacy';
  $app.replaceChildren(h('div', { class: 'wrap' }, h('div', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, h('b', null, 'HUB'))),
    h('div', { class: 'panel' }, h('h2', null, 'Privacy, in plain words'),
      h('p', null, 'O HUB is a free service. To deliver an invite and its answer we keep: the names you type, your WhatsApp number, the WhatsApp number or Instagram of the person the invite is for, the invite you design (including any pictures you upload), and the answer, message and the WhatsApp number or Instagram the other person sends back.'),
      h('p', null, 'While someone goes through an invite we also keep which screens they reached and how many times they pressed “No”, so the sender can see how far they got. The number or Instagram typed on the last page is saved as soon as it is typed, even if the answer is never sent. The site owner can block accounts that look fake. The invite page says so.'),
      h('p', null, 'Verified by selfie: if you choose to send a selfie, only the site owner looks at it, once, to check you are a real person. It is erased as soon as the owner decides (or after 7 days). It is never shown to anyone. Only the result (a tick) is kept.'),
      h('p', null, 'In the community, chat messages are text only and are deleted after 3 days (or when a room passes 1000 messages). Reports are kept 7 days so they can be reviewed. Points are kept. You can block anyone and report any message.'),
      h('p', null, 'Payments: you pay for points on Whish yourself. O HUB never asks for, sees or stores your card or bank details. We keep only the order, its amount and the reference you type, so the owner can check it and add your points.'),
      h('p', null, 'The invite is reachable by anyone who has its link. Only you (through your private link) can see its answers. The site owner can see the numbers and names to run and improve the service.'),
      h('p', null, 'You can delete an invite and all its answers any time from “My invites”. We never sell your data. Don’t upload pictures of people who haven’t agreed to it.')), footer()));
}
async function admin() {
  document.title = 'O HUB – Owner';
  const key0 = (() => { try { return sessionStorage.getItem('adate.key') || localStorage.getItem('adate.keyR') || ''; } catch (e) { return ''; } })();
  const rem = h('input', { type: 'checkbox', 'aria-label': 'Remember on this phone' }); try { rem.checked = !!localStorage.getItem('adate.keyR'); } catch (e) { /* ok */ }
  const out = h('div'), inp = h('input', { type: 'password', placeholder: 'Owner key', value: key0, autocomplete: 'off' });
  let tab = 'contacts';
  async function load() {
    const key = inp.value.trim(); if (!key) return;
    out.replaceChildren(h('p', { class: 'hint spark' }, 'Loading…'));
    try {
      const d = await API.admin(key); try { d.settings = await API.adminSettings(key); } catch (e) { d.settings = {}; } try { d.reports = (await API.adminReports(key)).targets; } catch (e) { d.reports = []; } try { d.tod = (await API.adminTod(key)).questions; } catch (e) { d.tod = []; } try { d.selfies = (await API.adminSelfies(key)).selfies; } catch (e) { d.selfies = []; } try { d.hosts = (await API.adminHosts(key)).hosts; } catch (e) { d.hosts = []; } try { d.orders = await API.adminOrders(key); } catch (e) { d.orders = { orders: [], done: [] }; } try { sessionStorage.setItem('adate.key', key); try { if (rem.checked) localStorage.setItem('adate.keyR', key); else localStorage.removeItem('adate.keyR'); } catch (e) { /* ok */ } } catch (e) { /* ignore */ }
      const st = d.stats, num = (v) => h('div', { class: 'panel', style: 'flex:1;min-width:96px;text-align:center;margin:0;padding:10px' }, h('b', { style: 'font-size:1.5rem' }, v[0]), h('div', { class: 'hint' }, v[1]));
      const wa = (n) => (n ? h('a', { href: 'https://wa.me/' + n, target: '_blank', rel: 'noopener' }, '+' + n) : '—');
      const contactLink = (c) => (!c ? '—' : c[0] === '@' ? h('a', { href: 'https://instagram.com/' + encodeURIComponent(c.slice(1)), target: '_blank', rel: 'noopener' }, c) : wa(c));
      const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const csv = () => { const cols = ['created_at', 'type', 'sender_name', 'sender_phone', 'to_name', 'opens', 'answers', 'last_answer_at', 'receiver_phone', 'receiver_ig', 'id']; const blob = new Blob([[cols.join(',')].concat(d.invites.map((r) => cols.map((c) => q(r[c])).join(','))).join('\n')], { type: 'text/csv' }); h('a', { href: URL.createObjectURL(blob), download: 'adate-invites.csv' }).click(); };
      const csvUsers = () => { const cols = ['created_at', 'first_name', 'last_name', 'phone', 'email', 'birthdate', 'interests', 'google', 'last_login_at', 'invites']; const blob = new Blob([[cols.join(',')].concat(d.users.map((r) => cols.map((c) => q(r[c])).join(','))).join('\n')], { type: 'text/csv' }); h('a', { href: URL.createObjectURL(blob), download: 'adate-users.csv' }).click(); };
      const note = h('div');
      const views = {
        users: () => [h('div', { class: 'row', style: 'margin:8px 0' }, h('button', { class: 'btn sm pri', onclick: csvUsers }, '⬇ Export users CSV')), note, ...d.users.map((u) => h('div', { class: 'inv' }, h('header', null, h('h3', null, '👤 ' + (u.name || 'No name')), h('span', { class: 'badge' }, u.invites + ' invites')),
          h('div', { class: 'kv' }, h('div', null, h('b', null, 'Name: '), [u.first_name, u.last_name].filter(Boolean).join(' ') || '—', ' · ', u.google ? 'Google' : 'number + password', u.profile_done ? '' : ' · profile not finished'), h('div', null, h('b', null, 'Number: '), wa(u.phone)), h('div', null, h('b', null, 'Email: '), u.email || '—'), h('div', null, h('b', null, 'Birthday: '), u.birthdate ? String(u.birthdate).slice(0, 10) : '—'), h('div', null, h('b', null, 'Interests: '), (u.interests || []).join(', ') || '—'), h('div', null, h('b', null, 'Joined: '), ago(u.created_at) + (u.last_login_at ? ' · last login ' + ago(u.last_login_at) : '')),
            h('div', { class: 'hint' }, 'Passwords are stored scrambled (nobody can read them). Reset gives a temporary one.')),
          h('button', { class: 'btn sm', onclick: async () => { if (!confirm('Reset the password for +' + u.phone + '?')) return; try { const r = await API.adminReset(key, u.phone); note.replaceChildren(h('div', { class: 'note' }, 'Temporary password for +' + r.phone + ': ', h('b', null, r.temp), '. Send it to them; they can change it with “Forgot password”.')); } catch (e) { note.replaceChildren(h('div', { class: 'note' }, e.message)); } } }, 'Reset password')))],
        invites: () => [h('div', { class: 'row', style: 'margin:8px 0' }, h('button', { class: 'btn sm pri', onclick: csv }, '⬇ Export invites CSV')), ...d.invites.map((r) => h('div', { class: 'inv' }, h('header', null, h('h3', null, `${(PRESETS[r.type] || {}).emoji || '💌'} ${r.sender_name || '?'} → ${r.to_name || '?'}`), h('span', { class: 'badge ' + (r.answers ? 'ok' : r.opens ? 'warn' : '') }, r.answers ? '✅ answered' : r.opens ? 'opened' : 'new')),
          h('div', { class: 'kv' }, h('div', null, h('b', null, 'Sender: '), wa(r.sender_phone)), r.receiver_phone || r.receiver_ig ? h('div', null, h('b', null, 'They left: '), r.receiver_phone ? wa(r.receiver_phone) : null, r.receiver_phone && r.receiver_ig ? ' · ' : '', r.receiver_ig ? contactLink('@' + r.receiver_ig) : null) : null, h('div', null, h('b', null, 'Created: '), ago(r.created_at) + ' · opened ' + r.opens + '×' + (r.last_answer_at ? ' · answered ' + ago(r.last_answer_at) : ''))),
          (() => { const slot = h('div'); return h('div', null, h('button', { class: 'btn sm', onclick: async (e) => { e.currentTarget.disabled = true; try { slot.replaceChildren(journey(await API.adminInvite(key, r.id))); } catch (x) { slot.replaceChildren(h('div', { class: 'note' }, x.message)); } } }, 'Journey'), slot); })()))],
        people: () => {
          const name = (u) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.name || '—';
          const rows = d.users.map((u) => ({ kind: 'sender', u, name: name(u), phone: u.phone, email: u.email, ig: '', note: (u.google ? 'Google' : 'number + password') + (u.profile_done ? '' : ' · profile not finished') }));
          const seen = new Set();
          d.invites.forEach((r) => {
            const phone = r.receiver_phone || r.typed_phone || (r.to_contact && r.to_contact[0] !== '@' ? r.to_contact : ''), ig = r.receiver_ig || r.typed_ig || r.to_ig || (r.to_contact && r.to_contact[0] === '@' ? r.to_contact.slice(1) : '');
            const k = phone || ig || r.id; if (seen.has(k)) return; seen.add(k);
            rows.push({ kind: 'receiver', r, name: r.to_name || '—', phone, email: '', ig, note: 'receiver of ' + (r.sender_name || '?') + ' · ' + (r.receiver_phone || r.receiver_ig ? 'gave it herself' : r.typed_phone || r.typed_ig ? 'typed it, did not send' : 'typed by the sender') });
          });
          const act = async (u, op, ask) => { const why = op === 'block' ? prompt('Why block ' + name(u) + '? (optional note)', 'fake') : ''; if (op === 'block' && why === null) return; if (op !== 'block' && ask && !confirm(ask)) return; try { await API.adminMark(key, u.id, op, why || ''); await load(); } catch (e) { note.replaceChildren(h('div', { class: 'note' }, e.message)); } };
          const csvP = () => { const cols = ['role', 'name', 'whatsapp', 'email', 'instagram', 'status']; const body = rows.map((x) => [x.kind, x.name, x.phone, x.email, x.ig, x.kind === 'sender' ? (x.u.blocked ? 'blocked' : x.u.verified ? 'verified' : 'unchecked') : x.note].map(q).join(',')); const blob = new Blob([[cols.join(',')].concat(body).join('\n')], { type: 'text/csv' }); h('a', { href: URL.createObjectURL(blob), download: 'adate-people.csv' }).click(); };
          const hello = (x) => 'Hi ' + (String(x.name).split(' ')[0] || '') + ', this is the O HUB team. We are checking that your profile is real. Can you reply to confirm?';
          return [h('p', { class: 'hint' }, `${rows.length} people: message each one on WhatsApp to check they are real. If someone is fake, tap Block: they can no longer sign in or send invites.`),
            h('div', { class: 'row', style: 'margin:8px 0' }, h('button', { class: 'btn sm pri', onclick: csvP }, '⬇ Export people CSV')), note,
            h('div', { class: 'tscroll' }, h('table', { class: 'ptable' }, h('thead', null, h('tr', null, ['Role', 'Name', 'WhatsApp', 'Email', 'Instagram', 'Status', ''].map((c) => h('th', null, c)))),
              h('tbody', null, rows.map((x) => h('tr', { class: x.u && x.u.blocked ? 'blocked' : '' },
                h('td', null, x.kind === 'sender' ? 'Account' : 'Receiver'), h('td', null, x.name),
                h('td', null, x.phone ? h('a', { href: 'https://wa.me/' + x.phone, target: '_blank', rel: 'noopener' }, '+' + x.phone) : '—'),
                h('td', null, x.email || '—'), h('td', null, x.ig ? contactLink('@' + x.ig) : '—'),
                h('td', null, x.kind === 'sender' ? (x.u.blocked ? 'blocked' + (x.u.blocked_note ? ' (' + x.u.blocked_note + ')' : '') : x.u.verified ? '✅ verified' : 'unchecked' + (x.u.verify_code ? ' · code ' + x.u.verify_code : '')) : h('span', { class: 'hint' }, x.note)),
                h('td', { class: 'acts' }, x.phone ? h('a', { class: 'btn sm', href: 'https://wa.me/' + x.phone + '?text=' + encodeURIComponent(hello(x)), target: '_blank', rel: 'noopener' }, '💬') : null,
                  x.kind === 'sender' ? [x.u.blocked ? h('button', { class: 'btn sm', onclick: () => act(x.u, 'unblock', 'Unblock ' + x.name + '?') }, 'Unblock') : h('button', { class: 'btn sm danger', onclick: () => act(x.u, 'block') }, 'Block'),
                    !x.u.blocked ? h('button', { class: 'btn sm', onclick: () => act(x.u, x.u.verified ? 'unverify' : 'verify') }, x.u.verified ? 'Unverify' : 'Real') : null, h('button', { class: 'btn sm', onclick: async () => { const r = prompt('Role for ' + name(x.u) + ': type agent, host, bot, or none', x.u.role || 'none'); if (r === null) return; const op = { mod: 'role_mod', agent: 'role_agent', host: 'role_host', bot: 'role_bot', none: 'role_none' }[r.trim().toLowerCase()]; if (!op) return alert('Type mod, agent, host, bot or none'); try { await API.adminMark(key, x.u.id, op); await load(); } catch (e) { note.replaceChildren(h('div', { class: 'note' }, e.message)); } } }, 'Role'), h('button', { class: 'btn sm', onclick: async () => { const pts = prompt('Gift points to ' + name(x.u) + ' (use a minus to take points away; leave 0 for a message only)', '100'); if (pts === null) return; const msg = prompt('Message from the O HUB team (optional)', 'You are great! Thank you for helping the community.'); if (msg === null) return; try { const r = await API.adminGift(key, x.u.id, Number(pts) || 0, msg || ''); note.replaceChildren(h('div', { class: 'note' }, 'Sent. Their balance is now ' + r.balance + ' points.')); } catch (e) { note.replaceChildren(h('div', { class: 'note' }, e.message)); } } }, 'Gift'), x.u.has_photo ? h('button', { class: 'btn sm danger', onclick: () => act(x.u, 'photo_off', 'Remove the real photo of ' + x.name + '?') }, 'remove photo') : null, !x.u.blocked ? h('button', { class: 'btn sm', title: 'Admin accounts get a notification when someone is muted', onclick: () => act(x.u, x.u.is_admin ? 'unadmin' : 'admin') }, x.u.is_admin ? 'admin' : 'admin') : null] : null))))))];
        },
        reports: () => {
          const t = d.reports || [];
          const act = async (u, op) => { try { await API.adminMod(key, u.id, op); await load(); } catch (e) { note.replaceChildren(h('div', { class: 'note' }, e.message)); } };
          return [h('p', { class: 'hint' }, 'Three different people reporting the same member in 24 hours mutes them for 24 hours and sends you a notification. Review here: unmute, dismiss, or block the account.'), note,
            ...(t.length ? t.map((u) => h('div', { class: 'inv' }, h('header', null, h('h3', null, '🚩 ' + (u.nick || u.name || 'Member')), h('span', { class: 'badge ' + (u.muted_until && new Date(u.muted_until) > new Date() ? 'warn' : '') }, u.muted_until && new Date(u.muted_until) > new Date() ? 'muted' : u.today + ' in 24h')),
              h('div', { class: 'kv' }, h('div', null, h('b', null, 'Number: '), wa(u.phone)), h('div', null, h('b', null, 'Reports: '), u.today + ' people in 24h · ' + u.week + ' this week'), ...(u.bodies || []).map((x) => h('div', { class: 'bubble' }, x))),
              h('div', { class: 'row' }, h('a', { class: 'btn sm', href: 'https://wa.me/' + u.phone + '?text=' + encodeURIComponent('Hi, this is the O HUB team. Several people reported your messages. Can we talk?'), target: '_blank', rel: 'noopener' }, 'WhatsApp'),
                h('button', { class: 'btn sm', onclick: () => act(u, 'unmute') }, 'Unmute'), h('button', { class: 'btn sm', onclick: () => act(u, 'dismiss') }, 'Dismiss reports'),
                h('button', { class: 'btn sm danger', onclick: async () => { if (!confirm('Block this account?')) return; try { await API.adminMark(key, u.id, 'block', 'reported'); await load(); } catch (e) { note.replaceChildren(h('div', { class: 'note' }, e.message)); } } }, 'Block')))) : [h('p', { class: 'hint' }, 'No reports in the last 7 days. 🎉')])];
        },
        tod: () => {
          const qs = d.tod || [], lvl = h('select', { 'aria-label': 'Level' }, [1, 2, 3, 4, 5].map((n) => h('option', { value: n }, 'Level ' + n))), kind = h('select', { 'aria-label': 'Kind' }, h('option', { value: 'truth' }, 'Truth'), h('option', { value: 'dare' }, 'Dare')), txt = h('textarea', { rows: 2, maxlength: 300, placeholder: 'Write a question or a dare', 'aria-label': 'Question' });
          const refresh = async (o) => { try { d.tod = (await API.adminTod(key, o)).questions; draw(); } catch (e) { note.replaceChildren(h('div', { class: 'note' }, e.message)); } };
          return [h('p', { class: 'hint' }, 'The Truth or Dare bank. Add your own; hide any you do not like. Levels 1 to 3 are for 13+, level 4 for 18+, level 5 for 25+ (enforced by the server).'), note,
            h('div', { class: 'stack' }, h('div', { class: 'fieldrow' }, lvl, kind), txt, h('button', { class: 'btn pri', onclick: () => { if (txt.value.trim().length < 5) return; refresh({ op: 'add', level: lvl.value, kind: kind.value, text: txt.value }); } }, 'Add')),
            ...[1, 2, 3, 4, 5].map((n) => h('details', null, h('summary', null, `Level ${n} (${qs.filter((x) => x.level === n && x.active).length} active)`), ...qs.filter((x) => x.level === n).map((x) => h('div', { class: 'hist' }, h('span', { style: x.active ? '' : 'opacity:.4;text-decoration:line-through' }, (x.kind === 'dare' ? '🔥 ' : '💬 ') + x.text), h('button', { class: 'btn sm', onclick: () => refresh({ op: x.active ? 'hide' : 'show', id: x.id }) }, x.active ? 'Hide' : 'Show')))))];
        },
        hosts: () => [h('p', { class: 'hint' }, 'Your official accounts (Host and Bot). Mark an account in People, then Role. Messages are counted over the last 7 days.'), note,
          ...((d.hosts || []).length ? d.hosts.map((x) => h('div', { class: 'inv' }, h('header', null, h('h3', null, (x.role === 'bot' ? '🤖 ' : '🌟 ') + (x.nick || '?')), h('span', { class: 'badge' }, x.role)), h('div', { class: 'kv' }, h('div', null, h('b', null, 'Points: '), String(x.points), ' · ', h('b', null, 'Messages 7d: '), String(x.messages7)), h('div', { class: 'hint' }, x.last_seen ? 'Last seen ' + ago(x.last_seen) : 'Never seen')),
            h('button', { class: 'btn sm', onclick: async () => { const pts = prompt('Gift points to ' + x.nick, '50'); if (pts === null) return; const msg = prompt('Message from the team (optional)', 'Thank you for being a great host!'); if (msg === null) return; try { const r = await API.adminGift(key, x.id, Number(pts) || 0, msg || ''); note.replaceChildren(h('div', { class: 'note' }, 'Sent. Balance: ' + r.balance)); await load(); } catch (e) { note.replaceChildren(h('div', { class: 'note' }, e.message)); } } }, 'Gift'))) : [h('p', { class: 'hint' }, 'No hosts yet. In People, press Role and type host.')])],
        selfies: () => {
          const decide = async (x, ok) => { if (!confirm(ok ? 'Approve and give the badge and points?' : 'Reject this selfie?')) return; try { await API.adminSelfieDecide(key, x.id, ok); await load(); } catch (e) { note.replaceChildren(h('div', { class: 'note' }, e.message)); } };
          return [h('p', { class: 'hint' }, 'Check that the face is real and the person shows the right number of fingers. The picture is erased as soon as you decide, and after 7 days if you do not.'), note,
            ...((d.selfies || []).length ? d.selfies.map((x) => h('div', { class: 'inv' }, h('header', null, h('h3', null, '🤳 ' + (x.nick || x.name || '?')), h('span', { class: 'badge' }, 'Fingers: ' + x.code)),
              h('img', { src: x.data, alt: 'selfie', style: 'max-width:100%;border-radius:14px' }), h('div', { class: 'hint' }, ago(x.at)),
              h('div', { class: 'row' }, h('button', { class: 'btn sm pri', onclick: () => decide(x, true) }, '✅ Approve'), h('button', { class: 'btn sm danger', onclick: () => decide(x, false) }, 'Reject')))) : [h('p', { class: 'hint' }, 'No selfies waiting.')])];
        },
        orders: () => {
          const o = d.orders || { orders: [], done: [] };
          const decide = async (x, ok) => { if (!confirm(ok ? `Add the points to ${x.name || x.nick}? Check Whish first.` : 'Reject this order?')) return; try { await API.adminOrderDecide(key, x.id, ok); await load(); } catch (e) { note.replaceChildren(h('div', { class: 'note' }, e.message)); } };
          const adjust = async (x) => { const pts = prompt('Add (+) or remove (-) points for ' + (x.nick || x.name || 'this person') + '. Example: 50 or -50', '10'); if (pts === null) return; const msg = prompt('Message to show them (optional)', '') || ''; try { const r = await API.adminGift(key, x.user_id, Number(pts) || 0, msg); note.replaceChildren(h('div', { class: 'note' }, 'Done. Their balance is now ' + r.balance + ' points.')); } catch (e) { note.replaceChildren(h('div', { class: 'note' }, e.message)); } };
          const view = (img) => { const w = window.open('', '_blank'); if (w) { w.document.write('<img src="' + img + '" style="max-width:100%">'); w.document.title = 'Receipt'; } };
          return [h('p', { class: 'hint' }, 'People who paid with Whish. Check 4 things on the receipt: the Transaction ID matches what they typed, the Amount is right, the Receiver is your number, and the time is recent. Then find the same transfer in your own Whish history and approve. Wrong or fake? Reject. You can also add or remove points for anyone.'), note,
            ...(o.orders.length ? o.orders.map((x) => h('div', { class: 'inv' }, h('header', null, h('h3', null, `AD-${x.id} · $${(x.cents / 100).toFixed(2)} · ${({ points5: 5, points12: 12, points25: 25, points29: 29, points100: 100 })[x.kind] || ''} points`), h('span', { class: 'badge ' + (x.status === 'claimed' ? 'warn' : '') }, x.status === 'claimed' ? 'sent a receipt' : 'not paid yet')),
              h('div', { class: 'kv' }, h('div', null, h('b', null, 'Person: '), (x.name || x.nick || '?') + ' · ', wa(x.phone)), h('div', null, h('b', null, 'Transaction ID: '), x.txid || '—'), h('div', { class: 'hint' }, x.claimed_at ? 'Receipt sent ' + ago(x.claimed_at) : 'Ordered ' + ago(x.at))),
              x.receipt ? h('img', { src: x.receipt, alt: 'Receipt', style: 'max-width:100%;max-height:300px;border-radius:12px;cursor:zoom-in', onclick: () => view(x.receipt) }) : null,
              h('div', { class: 'row' }, h('button', { class: 'btn sm pri', onclick: () => decide(x, true) }, '✅ Approve'), h('button', { class: 'btn sm danger', onclick: () => decide(x, false) }, 'Reject'), h('button', { class: 'btn sm', onclick: () => adjust(x) }, '± Points')))) : [h('p', { class: 'hint' }, 'No orders waiting.')]),
            ...(o.done.length ? [h('div', { class: 'h2' }, 'Recent'), ...o.done.map((x) => h('div', { class: 'hist' }, h('span', null, `AD-${x.id} · ${x.name || '?'} · ${x.status}${x.txid ? ' · ' + x.txid : ''}`), h('span', { class: 'row' }, h('b', null, '$' + (x.cents / 100).toFixed(2)), h('button', { class: 'btn sm', onclick: () => adjust(x) }, '±'))))] : [])];
        },
        settings: () => {
          const f = (label, name, ph) => { const inp = h('input', { type: 'text', value: (d.settings || {})[name] || '', placeholder: ph, 'aria-label': label }), msg = h('span', { class: 'hint' }); return h('div', { class: 'stack' }, h('b', null, label), inp, h('div', { class: 'row' }, h('button', { class: 'btn sm pri', onclick: async () => { try { await API.adminSet(key, name, inp.value); msg.textContent = 'Saved ✓'; (d.settings = d.settings || {})[name] = inp.value.trim(); } catch (e) { msg.textContent = e.message; } } }, 'Save'), msg)); };
          return [h('p', { class: 'hint' }, 'Numbers and links you choose to show users. Nothing here is in the code.'),
            f('Your WhatsApp number for verification (digits with country code, e.g. 9617xxxxxxx)', 'owner_whatsapp', '9617…'), f('Your Whish number to receive payments (digits, with country code)', 'whish_number', '9617…'), f('Note shown to people who pay (optional)', 'whish_note', 'Send exactly the amount, then add the receipt.'),
            h('div', { class: 'h2' }, 'Truth or Dare prices (points for 24 hours)'), f('Level 1 (default 2)', 'tod_price_1', '2'), f('Level 2 (default 4)', 'tod_price_2', '4'), f('Level 3 (default 5)', 'tod_price_3', '5'), f('Level 4 (default 10)', 'tod_price_4', '10'), f('Level 5 (default 15)', 'tod_price_5', '15')];
        },
        contacts: () => {
          const byInvite = {}; d.answers.forEach((a) => (byInvite[a.invite_id] = byInvite[a.invite_id] || []).push(a));
          const rows = d.invites.map((r) => ({ r, got: !!(r.receiver_phone || r.receiver_ig || r.typed_phone || r.typed_ig) }));
          const csvC = () => { const cols = ['created_at', 'account_name', 'account_email', 'sender_name', 'sender_phone', 'to_name', 'to_contact', 'to_ig', 'opens', 'answers', 'receiver_phone', 'receiver_ig', 'typed_phone', 'typed_ig', 'confirmed']; const body = rows.map(({ r, got }) => cols.map((c) => q(c === 'confirmed' ? (got ? 'yes' : 'no') : r[c])).join(',')); const blob = new Blob([[cols.join(',')].concat(body).join('\n')], { type: 'text/csv' }); h('a', { href: URL.createObjectURL(blob), download: 'adate-everything.csv' }).click(); };
          const none = (t) => h('span', { class: 'hint' }, t);
          return [h('p', { class: 'hint' }, `${rows.length} invites · ${rows.filter((x) => x.got).length} receivers gave their contact. Everything about each invite in one place: who sent it, who it is for, what they opened and answered, and their number or Instagram.`),
            h('div', { class: 'row', style: 'margin:8px 0' }, h('button', { class: 'btn sm pri', onclick: csvC }, '⬇ Export everything CSV')),
            ...rows.map(({ r, got }) => {
              const ans = byInvite[r.id] || [], when = r.answers ? 'answered before this was required' : 'has not answered yet';
              const slot = h('div');
              return h('div', { class: 'inv' }, h('header', null, h('h3', null, `${(PRESETS[r.type] || {}).emoji || '💌'} ${r.sender_name || '?'} → ${r.to_name || '?'}`), h('span', { class: 'badge ' + (r.answers ? 'ok' : r.opens ? 'warn' : '') }, r.answers ? '✅ answered' : r.opens ? 'opened' : 'not opened')),
                h('div', { class: 'kv' },
                  h('div', null, h('b', null, 'Sender: '), (r.account_name || r.sender_name || '?') + ' · ', wa(r.sender_phone), r.account_email ? ' · ' + r.account_email : ''),
                  h('div', null, h('b', null, 'Receiver: '), r.to_name || '?'),
                  h('div', null, h('b', null, 'Sender wrote for them: '), r.to_contact ? contactLink(r.to_contact) : '—', r.to_ig ? [' · ', contactLink('@' + r.to_ig)] : ''),
                  h('div', null, h('b', null, 'Receiver WhatsApp: '), r.receiver_phone ? [wa(r.receiver_phone), r.receiver_src ? (r.receiver_src === 'contact' ? ' 📇 from contacts' : ' ⌨️ typed') : ''] : r.typed_phone ? [wa(r.typed_phone), h('span', { class: 'hint' }, ' ✍️ typed on the last page, not sent')] : none('— ' + when)),
                  h('div', null, h('b', null, 'Receiver Instagram: '), r.receiver_ig ? contactLink('@' + r.receiver_ig) : r.typed_ig ? [contactLink('@' + r.typed_ig), h('span', { class: 'hint' }, ' ✍️ typed, not sent')] : none('— not given')),
                  h('div', null, h('b', null, 'Created: '), ago(r.created_at) + ' · opened ' + r.opens + '×' + (r.last_opened_at ? ' · last ' + ago(r.last_opened_at) : ''))),
                ...ans.map((a) => h('div', { class: 'inv', style: 'box-shadow:none;background:var(--bg);margin:6px 0 0' }, h('b', null, 'Answered ' + ago(a.at)), details(a.answer || {}), a.message ? h('div', { class: 'bubble' }, a.message) : h('div', { class: 'note' }, 'No message was saved.'))),
                h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { class: 'btn sm', onclick: async (e) => { e.currentTarget.disabled = true; try { slot.replaceChildren(journey(await API.adminInvite(key, r.id))); } catch (x) { slot.replaceChildren(h('div', { class: 'note' }, x.message)); } } }, 'Journey')), slot);
            })];
        },
        answers: () => d.answers.map((a) => h('div', { class: 'inv' }, h('header', null, h('h3', null, `💖 ${a.to_name || '?'} → ${a.sender_name || '?'}`), h('span', { class: 'hint' }, ago(a.at))),
          h('div', { class: 'kv' }, h('div', null, h('b', null, 'Sender: '), wa(a.sender_phone)), a.receiver_phone || a.receiver_ig ? h('div', null, h('b', null, 'Receiver: '), a.receiver_phone ? wa(a.receiver_phone) : null, a.receiver_phone && a.receiver_ig ? ' · ' : '', a.receiver_ig ? contactLink('@' + a.receiver_ig) : null) : null, a.answer && a.answer.date ? h('div', null, h('b', null, 'Date: '), fmtDate(a.answer.date) + (a.answer.time ? ' · ' + fmtTime(a.answer.time) : '') + (a.answer.act ? ' · ' + a.answer.act : '')) : null),
          a.message ? h('div', { class: 'bubble' }, a.message) : h('div', { class: 'note' }, 'No message was saved.')))
      };
      const draw = () => out.replaceChildren(h('div', { class: 'row' }, num([st.users, 'accounts']), num([st.invites, 'invites']), num([st.opened, 'opened']), num([st.answered, 'answered']), num([st.phones, 'numbers'])),
        (() => {
          const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
          const perm = 'Notification' in window ? Notification.permission : 'unsupported';
          const slot = h('div'), res = h('small', { class: 'hint' });
          if (perm === 'default') pushControl().then((n) => n && slot.replaceChildren(n)).catch(() => {});
          const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
          return h('div', { class: 'note stack' }, h('b', null, 'Alerts on your phone'),
            h('small', { class: 'hint' }, (standalone ? '✅ Installed on the Home Screen. ' : 'Not installed yet. ' + (ios ? 'Tap Share, then “Add to Home Screen”, and open O HUB from the new icon. ' : 'Open the ⋮ menu, then “Install app” or “Add to Home screen”. ')) + (perm === 'granted' ? '✅ Notifications are on.' : perm === 'denied' ? '❌ Notifications are blocked: allow them in your phone settings for this site.' : perm === 'default' ? 'Notifications are not on yet: tap the button below.' : 'This browser cannot show notifications.')),
            slot, h('button', { class: 'btn sm', type: 'button', onclick: async () => { try { const r = await API.adminTestPush(inp.value.trim()); res.textContent = r.devices ? 'Sent to ' + r.devices + ' device(s). Did it arrive?' : 'No phone is registered yet. Log in with your own account on this phone, turn on notifications, then try again.'; } catch (e) { res.textContent = e.message; } } }, 'Send me a test alert'), res,
            h('small', { class: 'hint' }, 'You get an alert for: a payment waiting, a selfie waiting, a new report, a new member, and messages to the team.'));
        })(),
        h('div', { class: 'row', style: 'margin:12px 0' }, [['contacts', 'Everything'], ['people', 'People'], ['reports', 'Reports'], ['orders', 'Orders'], ['selfies', 'Selfies'], ['hosts', 'Hosts'], ['tod', 'Questions'], ['invites', 'Invites'], ['settings', 'Settings'], ['answers', 'Answers'], ['users', 'Accounts']].map(([id, l]) => h('button', { class: 'chip', 'aria-pressed': tab === id ? 'true' : 'false', onclick: () => { tab = id; draw(); } }, l)), h('button', { class: 'btn sm', onclick: load }, '↻ Refresh')), ...views[tab]());
      draw();
    } catch (e) { out.replaceChildren(h('div', { class: 'note' }, e.message)); }
  }
  inp.onkeydown = (e) => { if (e.key === 'Enter') load(); };
  $app.replaceChildren(h('div', { class: 'wrap' }, h('div', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, h('b', null, 'HUB')), h('span', { class: 'pill' }, 'Owner')),
    h('div', { class: 'h2' }, 'Owner dashboard'), h('div', { class: 'fieldrow' }, inp, h('button', { class: 'btn pri', onclick: load }, 'Open')), h('label', { class: 'row' }, rem, h('span', { class: 'hint' }, 'Remember the key on this phone (only on your own phone)')), h('div', { style: 'height:12px' }), out));
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
  document.body.style.background = '';
  document.body.classList.toggle('nx', !/^#\/((i|v|d)\/|date|mine|make|admin-old|privacy)/.test(location.hash || '#/'));
  setRobots(!/^#\/(i|v|d|mine|admin|make|login|signup|recover|recover-phone|verify|profile)/.test(location.hash || ''));
  if (editor.cleanup) { editor.cleanup(); editor.cleanup = null; }
  clearInterval(pollTimer);
  document.querySelectorAll('.modal').forEach((m) => m.remove());
  const hash = location.hash || '#/';
  if (hash.startsWith('#/v/')) return viewer('v', hash.slice(4));
  if (hash.startsWith('#/i/')) return API.enabled ? viewer('i', hash.slice(4)) : brokenLink();
  if (hash.startsWith('#/d/')) return dash(hash.slice(4));
  if (window.CommunityRoute) { const f = window.CommunityRoute(hash === '#' ? '' : hash); if (f) return f(); }
  if (hash === '#/date') return home();
  if (hash === '#/mine') return inbox();
  if (hash === '#/login') return login('login');
  if (hash === '#/signup') return login('signup');
  if (hash === '#/recover') return recover();
  if (hash === '#/recover-phone') return recoverPhone();
  if (hash === '#/verify') return verifyPage();
  if (hash === '#/privacy') return privacy();
  if (hash === '#/admin') return window.OwnerDash.open();
  if (hash === '#/admin-old') return admin();
  if (hash === '#/welcome') return welcome();
  if (hash === '#/profile') return profile();
  if (hash === '#/make') {
    if (API.enabled) { const s = API.session; if (!s) { store.set('adate.after', '#/make'); location.hash = '#/login'; return; } if (!s.profile_done) { store.set('adate.after', '#/make'); location.hash = '#/welcome'; return; } }
    return editor();
  }
  return home();
}
window.ADATE_UI = { toggleMode, modePref, shrinkImage, h, $app, store, authShell, footer, ago, copyText, pwField, pushControl, setPoll: (fn, ms) => { clearInterval(pollTimer); pollTimer = setInterval(fn, ms); } };
window.CommunityRoute = window.CommunityInit ? window.CommunityInit(window.ADATE_UI) : null;
window.addEventListener('hashchange', route);
// A tab left open for hours keeps old code. When it comes back to the front, reload if a newer build is live.
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !CFG.build) return;
  try { const j = await (await fetch('/version.json', { cache: 'no-store' })).json(); if (j && j.build && j.build !== CFG.build) location.reload(); } catch (e) { /* offline: keep going */ }
});
applyMode();
route();
})();
