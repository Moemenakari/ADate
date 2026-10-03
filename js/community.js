// ADate community: hub, rooms, chat, private messages, points, profile. Runs on top of app.js (it gets the shared helpers in CommunityInit).
(function () {
'use strict';
window.CommunityInit = function (ui) {
  const { h, $app, store } = ui;
  const API = window.API;
  const THEMES = window.THEMES || {}, STICKERS = window.STICKERS || {};
  const FLAG = { LB: '🇱🇧', AE: '🇦🇪', SA: '🇸🇦', QA: '🇶🇦', KW: '🇰🇼', FR: '🇫🇷', US: '🇺🇸', CA: '🇨🇦', AU: '🇦🇺', DE: '🇩🇪', GB: '🇬🇧', EG: '🇪🇬', AF: '🌍', BH: '🇧🇭', OM: '🇴🇲', JO: '🇯🇴', SY: '🇸🇾', IQ: '🇮🇶', TR: '🇹🇷', CY: '🇨🇾', BR: '🇧🇷', SE: '🇸🇪', IT: '🇮🇹', ES: '🇪🇸' };
  const CNAME = { LB: 'Lebanon', AE: 'United Arab Emirates', SA: 'Saudi Arabia', QA: 'Qatar', KW: 'Kuwait', FR: 'France', US: 'United States', CA: 'Canada', AU: 'Australia', DE: 'Germany', GB: 'United Kingdom', EG: 'Egypt', AF: 'Afghanistan' };
  const NICK_COUNTRIES = ['LB', 'AE', 'SA', 'QA', 'KW', 'FR', 'US', 'CA', 'AU', 'DE', 'GB', 'EG'];
  let ME = null;
  const err = (e) => (e && e.message) || 'Something went wrong';
  const timeShort = (iso) => { const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const toast = (m, kind) => { const t = h('div', { class: 'toast ' + (kind || '') }, m); document.body.append(t); setTimeout(() => t.remove(), 2600); };
  const applyTheme = (key) => { document.body.style.background = THEMES[key] ? THEMES[key].sky : ''; };

  const FRAME_LOOK = { halloween: ['#ff7a00', '🎃'], newyear: ['#e6b422', '🎆'], ramadan: ['#6b4fbb', '🌙'] };
  const presence = (iso) => { if (!iso) return ''; const s = (Date.now() - new Date(iso).getTime()) / 1000; if (s < 150) return '🟢 Online'; if (s < 3600) return 'Last seen ' + Math.round(s / 60) + ' min ago'; if (s < 86400) return 'Last seen ' + Math.round(s / 3600) + ' h ago'; return 'Last seen ' + Math.round(s / 86400) + ' d ago'; };
  const TICK = (ok, role, fast) => (ok ? ' ✅' : '') + ({ owner: ' 👑', mod: ' 🛡️', agent: ' 💰', host: ' 🌟 Host', bot: ' 🤖 Bot' }[role] || '') + (fast ? ' ⚡' : '');
  /** Their social accounts shown as logos. Locked until opened: one for 10 points, all of them for 20. */
  const SOC = { ig: ['📸', 'Instagram', (v) => 'https://instagram.com/' + v, (v) => '@' + v], snap: ['👻', 'Snapchat', (v) => 'https://www.snapchat.com/add/' + v, (v) => '@' + v], tiktok: ['🎵', 'TikTok', (v) => 'https://www.tiktok.com/@' + v, (v) => '@' + v], wa: ['💬', 'WhatsApp', (v) => 'https://wa.me/' + v, (v) => '+' + v] };
  function socialsBox(p) {
    const box = h('div', { class: 'stack socbox' });
    const draw = () => {
      const have = p.socials_have || [], open = p.socials_open || {}, left = have.filter((k) => !open[k]);
      box.replaceChildren(h('b', null, '🔗 Their accounts'),
        ...have.map((k) => { const m = SOC[k] || ['🔗', k, (v) => '#', (v) => v]; return open[k]
          ? h('a', { class: 'setrow', href: m[2](open[k]), target: '_blank', rel: 'noopener noreferrer' }, h('span', null, m[0] + ' ' + m[1]), h('b', null, m[3](open[k])))
          : h('button', { class: 'setrow socl', type: 'button', onclick: () => unlock(k, p.soc_price[k] || 10) }, h('span', null, m[0] + ' ' + m[1]), h('b', null, '🔒 ' + (p.soc_price[k] || 10) + ' ⭐')); }),
        left.filter((k) => k !== 'wa').length > 1 ? h('button', { class: 'btn pri block', type: 'button', onclick: () => unlock('*', p.soc_price.all) }, '🔓 Open all · ' + p.soc_price.all + ' ⭐') : null);
    };
    const unlock = async (key, price) => { if (!confirm('Open ' + (key === '*' ? 'all their accounts' : (SOC[key] || [0, key])[1]) + ' for ' + price + ' points?')) return; try { const r = await API.socialView(p.id, key); ME.points = r.balance; p.socials_open = r.socials_open; draw(); toast('Opened ✓'); } catch (x) { toast(err(x), 'bad'); } };
    draw(); return box;
  }
  function avatar(av, nick, size, frame, photo) {
    const sz = size || 40, box = h('span', { class: 'avatar' + (frame ? ' framed' : ''), style: `width:${sz}px;height:${sz}px` + (FRAME_LOOK[frame] ? `;--ring:${FRAME_LOOK[frame][0]}` : '') });
    const k = String(av || '').replace(/^cartoon:/, ''), an = /^animal:/.test(av || '') ? (window.ANIMALS || []).find((x) => 'animal:' + x[0] === av) : null;
    if (photo && /^data:image\//.test(photo)) box.append(h('img', { src: photo, alt: '' })); else if (an) { box.classList.add('animal'); box.textContent = an[1]; box.style.fontSize = Math.round(sz * 0.6) + 'px'; } else if (av && STICKERS[k]) box.innerHTML = STICKERS[k].svg; else box.textContent = (nick || '?').trim().slice(0, 1).toUpperCase();
    if (FRAME_LOOK[frame]) box.append(h('i', { class: 'fr' }, FRAME_LOOK[frame][1]));
    return box;
  }

  /* ---------------------------------------------------------------- add to home screen: banner and +10 points */
  const isStandalone = () => !!(window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  let deferredInstall = null; window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });
  function installBanner() {
    if (isStandalone()) return null;
    try { if (localStorage.getItem('adate.installHide')) return null; } catch (e) { /* ok */ } // shown once: after the X it never comes back (Settings still explains it)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const box = h('div', { class: 'installbar' }, h('div', null, h('b', null, '📲 Add ADate to your Home Screen'), h('small', null, ios ? 'Tap the Share button, then “Add to Home Screen”. You get notifications and +10 points.' : 'Open the ⋮ menu, then “Install app” or “Add to Home screen”. You get notifications and +10 points.')),
      deferredInstall ? h('button', { class: 'btn pri sm', onclick: async () => { try { deferredInstall.prompt(); await deferredInstall.userChoice; } catch (e) { /* ignore */ } box.remove(); } }, 'Install') : null,
      h('button', { class: 'btn sm', 'aria-label': 'Close', onclick: () => { try { localStorage.setItem('adate.installHide', '1'); } catch (e) { /* ok */ } box.remove(); } }, '✕'));
    return box;
  }
  if (isStandalone() && API.session) { let done = false; try { done = localStorage.getItem('adate.installClaimed') === '1'; } catch (e) { /* ok */ } if (!done) API.installClaim().then((r) => { try { localStorage.setItem('adate.installClaimed', '1'); } catch (e) { /* ok */ } if (r && r.claimed) setTimeout(() => toast('+10 points for adding ADate to your home screen ⭐'), 1500); }).catch(() => {}); }
  /** A "turn on notifications" button at the top, until the person has chosen. Phones that cannot yet (iPhone before Add to Home Screen) see nothing here: the install card tells them what to do. */
  function pushPrompt() {
    const slot = h('div');
    try {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      if (!('Notification' in window) || Notification.permission !== 'default' || !ui.pushControl || (ios && !isStandalone())) return slot;
      if (localStorage.getItem('adate.pushAsked')) return slot; localStorage.setItem('adate.pushAsked', '1'); // asked once, not on every visit
      ui.pushControl().then((el) => { if (el && Notification.permission === 'default') slot.append(h('div', { class: 'pushbar' }, h('small', null, '🔔 Get a message when a friend writes or invites you to play'), el)); }).catch(() => {});
    } catch (e) { /* optional */ }
    return slot;
  }
  const bar = (active, points) => h('nav', { class: 'tabbar' }, [['#/', '🏠', 'Home'], ['#/match', '💜', 'Match'], ['#/rooms', '👥', 'Groups'], ['#/dms', '💬', 'Chats'], ['#/views', '👀', 'Views'], ['#/shop', '🛒', 'Shop']].map(([href, e, l]) => h('a', { href, class: active === href ? 'on' : '' }, h('span', null, e), h('small', null, l))));
  /** My own avatar: the real photo when I have one, otherwise the cartoon. */
  const myAvatar = (size) => avatar(ME && ME.avatar, ME && ME.nick, size, ME && ME.frame, ME && ME.photo);
  /** One reminder at the top that slides in, most important first: install, notifications, then things that earn points. Hidden for a day with the X. */
  function todoBanner() {
    if (!ME || !ME.todo) return null;
    let hidden = {}; try { hidden = JSON.parse(localStorage.getItem('adate.todoHide') || '{}'); } catch (e) { /* ok */ }
    const t = ME.todo.find((x) => x.k !== 'invite' && !(hidden[x.k] > Date.now())); if (!t) return null;
    const box = h('div', { class: 'todobar slidein' }, h('a', { href: t.href }, h('b', null, '⭐ ' + t.text + ' to get ' + t.points + ' points')), h('button', { class: 'btn sm', 'aria-label': 'Hide for a day', onclick: () => { hidden[t.k] = Date.now() + 86400000; try { localStorage.setItem('adate.todoHide', JSON.stringify(hidden)); } catch (e) { /* ok */ } box.remove(); } }, '✕'));
    return box;
  }
  function page(active, ...kids) {
    document.title = 'ADate';
    const me = ME ? h('a', { class: 'mechip', href: '#/me' }, myAvatar(34), h('span', null, h('b', null, ME.nick || 'Me'), h('small', null, '◯ ' + (ME.age_band || '')))) : h('a', { class: 'pill', href: '#/points' }, '⭐ …');
    $app.replaceChildren(h('div', { class: 'wrap cm' }, h('div', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, '🐱 A', h('b', null, 'Date')), me), installBanner(), pushPrompt(), todoBanner(), ...kids), bar(active, ME && ME.points));
  }
  /** When something costs more points than the person has, say so kindly and show the way to get more (the server answers 402). */
  window.addEventListener('adate:needpoints', (e) => {
    if (document.querySelector('.needpts')) return;
    const box = h('div', { class: 'needpts sheet-over', role: 'dialog', 'aria-label': 'You need more points' }, h('div', { class: 'sheet stack' }, h('div', { class: 'bigemoji' }, '⭐'), h('h2', { class: 'wz-h' }, 'You need more points'), h('p', { class: 'hint' }, (e.detail || '').slice(0, 160)),
      h('a', { class: 'btn pri block', href: '#/shop', onclick: () => box.remove() }, '⭐ Buy more points'), h('a', { class: 'btn block', href: '#/', onclick: () => { try { localStorage.setItem('adate.homeTab', 'act'); } catch (x) { /* ok */ } box.remove(); } }, '✨ Earn free points'), h('button', { class: 'btn block', type: 'button', onclick: () => box.remove() }, 'Not now')));
    document.body.append(box);
  });
  async function load() { // who am I; also earns the +1 that comes every 6 hours
    const d = await API.hub(); ME = d.me; applyTheme(ME.theme); window.__dmRequests = d.dm_requests;
    API.pointsClaim().then((r) => { if (r && r.claimed) { ME.points = r.balance; toast('+1 point ⭐'); } }).catch(() => {});
    return d;
  }
  const guard = async (fn) => { try { await fn(); } catch (e) { if (/log in|blocked/i.test(err(e))) { if (/blocked/i.test(err(e))) { API.clear(); } location.hash = '#/login'; return; } if (/profile/i.test(err(e))) { location.hash = '#/welcome'; return; } $app.replaceChildren(h('div', { class: 'wrap cm' }, h('div', { class: 'note' }, err(e)), h('a', { class: 'btn', href: '#/' }, 'Back'))); } };

  /* ---------------------------------------------------------------- hub */
  async function hub() {
    page('#/', h('p', { class: 'hint spark' }, 'Loading…'));
    const d = await load(), rs = (await API.rooms()).rooms, notices = ((await API.notices().catch(() => ({ notices: [] }))).notices) || [];
    const boxCard = h('div'); API.boxState().then((s) => { if (!s.available) return; const bx = h('div', { class: 'teamnote boxnote' }, h('b', null, '🎁 Your daily surprise'), h('p', null, 'Free every day. 1 to 5 points.'), h('button', { class: 'btn pri sm', onclick: async () => { try { const r = await API.boxOpen(); ME.points = r.balance; toast('🎁 +' + r.prize + ' points!'); bx.remove(); } catch (e) { toast(err(e), 'bad'); } } }, 'Open')); boxCard.append(bx); }).catch(() => {});
    const mine = rs.filter((r) => r.member), suggest = rs.filter((r) => !r.member && (r.score || 0) > 0).slice(0, 5);
    const roomRow = (r) => h('a', { class: 'roomcard', href: '#/room/' + r.id }, h('span', { class: 'rc-e' }, r.emoji || '💬'), h('span', { class: 'rc-t' }, h('b', null, r.title), h('small', null, `${r.members} here · ${r.msgs24} messages today`)), r.member ? h('span', { class: 'badge ok' }, 'Joined') : h('span', { class: 'badge' }, r.price ? '⭐ ' + r.price : 'Free'));
    const nickBox = ME.nick ? null : (() => { const inp = h('input', { type: 'text', maxlength: 20, placeholder: 'Your nickname', 'aria-label': 'Nickname' }), msg = h('div'); return h('div', { class: 'note' }, h('b', null, 'Choose your nickname'), h('p', { class: 'hint' }, 'This is the name people see in rooms. Not your real name.'), inp, h('button', { class: 'btn pri block', onclick: async () => { try { await API.nickSet('*', inp.value); hub(); } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, err(e))); } } }, 'Save nickname'), msg); })();
    page('#/', h('div', { class: 'hello' }, myAvatar(52), h('div', null, h('b', null, 'Hi ' + (ME.nick || 'there') + ' ' + (FLAG[ME.country] || '')), h('small', { class: 'hint' }, 'Age circles: ' + ME.circles.join(' · ')))), nickBox,
      homeTabs(),
      ...[homeToday, homeGames, homeRooms, homeActivities].map((f) => f()));
    function homeToday() { return h('div', { class: 'stack hsec', 'data-sec': 'today' }, boxCard, ...notices.map((n) => { const box = h('div', { class: 'teamnote' }, h('b', null, '📩 ADate Team'), h('p', null, n.body), n.points ? h('b', { class: n.points > 0 ? 'pos' : 'neg' }, (n.points > 0 ? '+' : '') + n.points + ' ⭐') : null, h('button', { class: 'btn sm', onclick: async () => { await API.noticeRead(n.id).catch(() => {}); box.remove(); load().then(() => {}); } }, 'OK')); return box; }), d.dm_requests ? h('a', { class: 'note', href: '#/dms' }, '💬 ' + d.dm_requests + ' message request' + (d.dm_requests > 1 ? 's' : '') + ' waiting') : null, h('p', { class: 'hint' }, 'Nothing else new right now. Check Activities to earn points.')); }
    function homeGames() { return h('div', { class: 'stack hsec', 'data-sec': 'games' }, h('div', { class: 'h2' }, 'Games'), h('div', { class: 'grid2' }, h('a', { class: 'gamecard c1', href: '#/date' }, h('b', null, '💌 Truth Date'), h('small', null, 'Ask someone out with a game they cannot say no to')), h('a', { class: 'gamecard c2', href: '#/tod' }, h('b', null, '🎲 Truth or Dare'), h('small', null, 'Five levels, from friendly to spicy'))), h('a', { class: 'gamecard c3', href: '#/match' }, h('b', null, '💜 Meet people'), h('small', null, 'Swipe, play 3 quick games together and become friends'))); }
    function homeRooms() { return h('div', { class: 'stack hsec', 'data-sec': 'rooms' }, ...(mine.length ? [h('div', { class: 'h2' }, 'My rooms'), ...mine.slice(0, 6).map(roomRow)] : []), h('div', { class: 'h2' }, mine.length ? 'More for you' : 'Rooms picked for you'), ...suggest.map(roomRow), h('a', { class: 'btn block', href: '#/rooms' }, 'See all rooms')); }
    function homeActivities() { return h('div', { class: 'stack hsec', 'data-sec': 'act' }, h('div', { class: 'h2' }, '✨ Earn points'), h('p', { class: 'hint' }, 'Small things you can do now. Points open Truth or Dare, chats and more.'), ...(ME.todo || []).map((t) => h('a', { class: 'roomcard', href: t.href }, h('span', { class: 'rc-e' }, '⭐'), h('span', { class: 'rc-t' }, h('b', null, t.text), h('small', null, 'Get ' + t.points + ' points')), h('span', { class: 'badge' }, '+' + t.points))), h('a', { class: 'btn pri block', href: '#/shop' }, '⭐ Get more points')); }
    function homeTabs() { const names = [['today', '🔔 Today'], ['games', '🎮 Games'], ['rooms', '💬 My rooms'], ['act', '✨ Activities']]; let cur = 'today'; try { cur = localStorage.getItem('adate.homeTab') || 'today'; } catch (e) { /* ok */ } const row = h('div', { class: 'hometabs', role: 'tablist' }); const paint = () => { row.replaceChildren(...names.map(([k, l]) => h('button', { class: 'chip' + (k === cur ? ' on' : ''), type: 'button', role: 'tab', onclick: () => { cur = k; try { localStorage.setItem('adate.homeTab', k); } catch (e) { /* ok */ } paint(); } }, l))); document.querySelectorAll('.hsec').forEach((x) => { x.style.display = x.dataset.sec === cur ? '' : 'none'; }); }; setTimeout(paint, 0); return row; }
  }

  /* ---------------------------------------------------------------- rooms */
  async function rooms() {
    page('#/rooms', h('p', { class: 'hint spark' }, 'Loading…'));
    if (!ME) await load();
    const d = await API.rooms(); let filter = 'all', q = '';
    const list = h('div', { class: 'stack' });
    const card = (r) => h('div', { class: 'roomcard' }, h('span', { class: 'rc-e' }, r.emoji || '💬'), h('span', { class: 'rc-t' }, h('b', null, r.title + (r.country ? ' ' + (FLAG[r.country] || '') : '')), h('small', null, `${r.members} members · ${r.msgs24} messages today`)),
      r.member ? h('a', { class: 'btn sm pri', href: '#/room/' + r.id }, 'Open') : h('button', { class: 'btn sm', onclick: async (e) => {
        if (r.price && !confirm(`Joining ${r.title} costs ${r.price} points. You have ${d.balance}. Join?`)) return;
        e.currentTarget.disabled = true; try { await API.roomJoin(r.id); location.hash = '#/room/' + r.id; } catch (x) { toast(err(x), 'bad'); e.currentTarget.disabled = false; } } }, r.price ? 'Join · ⭐ ' + r.price : 'Join · free'));
    const draw = () => {
      const match = (r) => !q || r.title.toLowerCase().includes(q) || (r.country && ((CNAME[r.country] || '').toLowerCase().includes(q) || r.country.toLowerCase() === q));
      const rs = d.rooms.filter((r) => (filter === 'all' || (filter === 'mine' && r.member) || (filter === 'foryou' && r.score > 0) || (filter === r.kind)) && match(r));
      if (!rs.length) return list.replaceChildren(h('p', { class: 'hint' }, 'No groups found. Try another place or word.'));
      const places = rs.filter((r) => r.kind === 'region'), others = rs.filter((r) => r.kind !== 'region');
      const byCountry = {}; places.forEach((r) => { (byCountry[r.country || '??'] = byCountry[r.country || '??'] || []).push(r); });
      const order = Object.keys(byCountry).sort((a, b) => (b === ME.country) - (a === ME.country) || a.localeCompare(b));
      list.replaceChildren(...others.map(card), ...order.flatMap((c) => [h('div', { class: 'h2 country' }, (FLAG[c] || '📍') + ' ' + (CNAME[c] || c)), ...byCountry[c].map(card)]));
    };
    const search = h('input', { type: 'text', placeholder: 'Search a place or a group', 'aria-label': 'Search rooms', oninput: (e) => { q = e.target.value.trim().toLowerCase(); draw(); } });
    const chips = h('div', { class: 'row' }, [['all', 'All'], ['foryou', 'For you'], ['mine', 'Joined'], ['region', '📍 Places'], ['interest', 'Interests'], ['school', '🏫 Schools'], ['season', '🎃 Seasonal']].map(([id, l]) => h('button', { class: 'chip', 'aria-pressed': id === filter ? 'true' : 'false', onclick: (e) => { filter = id; chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === e.currentTarget ? 'true' : 'false')); draw(); } }, l)));
    page('#/rooms', h('div', { class: 'h2' }, 'Groups'), h('p', { class: 'hint' }, 'Text only, like a WhatsApp group. Search by place: city or country. Places are free; some interest groups cost 10 to 25 points.'), search, chips, list); draw();
  }

  /* ---------------------------------------------------------------- profile card */
  async function card(userId) {
    let p; try { p = await API.profileView(userId); } catch (e) { return toast(err(e), 'bad'); }
    const m = h('div', { class: 'modal', onclick: (e) => { if (e.target === m) m.remove(); } });
    const dm = h('div', { class: 'stack' });
    m.append(h('div', { class: 'sheet stack' }, h('div', { class: 'hello' }, avatar(p.avatar, p.nick, 56, p.frame, p.photo), h('div', null, h('b', null, p.nick + TICK(p.selfie_ok, p.role, p.fast) + ' ' + (FLAG[p.country] || '')), h('small', { class: 'hint' }, `Age ${p.age} · ${p.zodiac}` + (p.verified ? ' · ✅ checked' : '')))),
      p.interests.length ? h('div', { class: 'row' }, p.interests.map((i) => h('span', { class: 'chip static' }, i))) : null,
      p.me ? null : [p.can_dm ? h('div', { class: 'stack' }, h('input', { type: 'text', maxlength: 300, placeholder: 'Say hi (text only)', 'aria-label': 'First message' }), h('button', { class: 'btn pri block', onclick: async (e) => {
        const body = e.currentTarget.parentNode.querySelector('input').value; try { const r = await API.dmStart(p.id, body); m.remove(); location.hash = '#/dm/' + r.thread; } catch (x) { dm.replaceChildren(h('div', { class: 'note' }, err(x))); } } }, '💬 Send message request')) : h('p', { class: 'hint' }, 'Private messages are only between people in the same age circles.'), dm,
        h('button', { class: 'btn block danger', onclick: async () => { if (!confirm(p.blocked ? 'Unblock this person?' : 'Block this person? You will not see each other.')) return; await API.userBlock(p.id, p.blocked); toast(p.blocked ? 'Unblocked' : 'Blocked'); m.remove(); } }, p.blocked ? 'Unblock' : '🚫 Block')],
      p.can_socials && !p.me ? socialsBox(p) : null,
      h('button', { class: 'btn block', onclick: () => m.remove() }, 'Close')));
    document.body.append(m);
  }

  /* ---------------------------------------------------------------- chat engine (rooms and private) */
  const muteBtn = (kind, id) => { const b = h('button', { class: 'btn sm', 'aria-label': 'Notifications' }, '🔔'); let off = false; const paint = () => { b.textContent = off ? '🔕' : '🔔'; }; API.muteGet(kind, id).then((r) => { off = !!r.muted; paint(); }).catch(() => {}); b.onclick = async () => { try { await API.muteSet(kind, id, !off); off = !off; paint(); toast(off ? 'Notifications are off for this chat' : 'Notifications are on'); } catch (e) { toast(err(e), 'bad'); } }; return b; };
  /** The sticker button: opens the sticker keyboard above the message box. */
  function stickerButton(slot, onPick) {
    const b = h('button', { class: 'btn sm stkopen', type: 'button', 'aria-label': 'Stickers' }, '🌟'); let open = false;
    b.onclick = () => { open = !open; if (open && window.ChatStickers) slot.replaceChildren(window.ChatStickers.picker((id) => { slot.replaceChildren(); open = false; onPick(id); })); else slot.replaceChildren(); };
    return b;
  }
  function chat({ title, emoji, backHref, headerExtra, fetchFirst, fetchAfter, send, mineKey, report, extraTick, afterLayout }) {
    let last = 0, mutedUntil = null;
    const list = h('div', { class: 'chatlist' }), msg = h('div'), inp = h('input', { type: 'text', maxlength: 500, placeholder: 'Write a message (text only)', 'aria-label': 'Message', enterkeyhint: 'send' });
    const sendBtn = h('button', { class: 'btn pri', type: 'button' }, 'Send');
    const bubble = (m) => h('div', { class: 'cmsg' + (m.mine ? ' mine' : '') }, m.mine ? null : h('button', { class: 'who', onclick: () => m.user_id && card(m.user_id) }, m.nick || ''), h('div', { class: 'bub' + (/^\[st:[a-z]+\]$/.test(m.body) ? ' stkmsg' : '') }, window.ChatStickers ? window.ChatStickers.body(m.body) : m.body), h('small', null, timeShort(m.at), ' ', m.mine || !report ? '' : h('button', { class: 'flag', title: 'Report', 'aria-label': 'Report this message', onclick: async () => { if (!confirm('Report this message?')) return; try { const r = await report(m.id); toast(r.muted ? 'Reported. Thank you.' : 'Reported. Thank you.'); } catch (e) { toast(err(e), 'bad'); } } }, '🚩')));
    const add = (rows) => { if (!rows.length) return; const near = list.scrollHeight - list.scrollTop - list.clientHeight < 140; rows.forEach((m) => { last = Math.max(last, m.id); list.append(bubble(m)); }); if (near || last === rows[rows.length - 1].id && list.children.length === rows.length) list.scrollTop = list.scrollHeight; };
    async function tick(first) {
      try { const d = first ? await fetchFirst() : await fetchAfter(last); if (first && d.room) head.querySelector('small').textContent = `${d.room.members} members`; if (d.other) { const nm = (d.other.nick || 'Chat') + (d.other.fast ? ' ⚡' : ''); head.querySelector('b').textContent = nm; head.querySelector('small').textContent = presence(d.other.last_seen) + (d.thread && d.thread.streak >= 2 ? ' · 🔥 ' + d.thread.streak : ''); } if (extraTick) { try { extraTick(d, first); } catch (e) { /* the chat still works */ } } mutedUntil = d.muted_until || null; banner.textContent = mutedUntil ? '🔇 You are muted for a while. You can still read.' : ''; banner.style.display = mutedUntil ? '' : 'none'; if (first) list.replaceChildren(); add(d.messages || []); if (first && d.other) head.querySelector('b').textContent = d.other.nick; } catch (e) { if (/log in/i.test(err(e))) location.hash = '#/login'; }
    }
    async function go() { const body = inp.value.trim(); if (!body) return; sendBtn.disabled = true; try { await send(body); inp.value = ''; msg.replaceChildren(); await tick(false); list.scrollTop = list.scrollHeight; } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, err(e))); } sendBtn.disabled = false; inp.focus(); }
    sendBtn.onclick = go; inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    const stkSlot = h('div'), stkBtn = stickerButton(stkSlot, async (id) => { try { await send('[st:' + id + ']'); msg.replaceChildren(); await tick(false); list.scrollTop = list.scrollHeight; } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, err(e))); } });
    const head = h('div', { class: 'chathead' }, h('a', { class: 'btn sm', href: backHref }, '←'), h('div', { class: 'ct' }, h('b', null, (emoji ? emoji + ' ' : '') + title), h('small', null, '')), headerExtra || null);
    const banner = h('div', { class: 'note', style: 'display:none' });
    $app.replaceChildren(h('div', { class: 'wrap cm chatwrap' }, head, banner, list, msg, stkSlot, h('div', { class: 'composer' }, stkBtn, inp, sendBtn)), bar(null, ME && ME.points));
    if (afterLayout) afterLayout({ banner, list, msg, composer: document.querySelector('.composer'), head, inp, sendBtn });
    tick(true).then(() => { list.scrollTop = list.scrollHeight; });
    ui.setPoll(() => { if (document.visibilityState === 'visible') tick(false); }, 3000);
  }

  async function room(id) {
    if (!ME) await load();
    chat({ title: 'Room', backHref: '#/rooms', fetchFirst: () => API.msgList(id), fetchAfter: (a) => API.msgList(id, a), send: (b) => API.msgSend(id, b), report: (mid) => API.report(mid, 'room'),
      headerExtra: h('span', { class: 'row' }, muteBtn('room', id), h('button', { class: 'btn sm', onclick: async () => { if (confirm('Leave this room?')) { await API.roomLeave(id); location.hash = '#/rooms'; } } }, 'Leave')) });
    API.rooms().then((d) => { const r = d.rooms.find((x) => String(x.id) === String(id)); if (r) document.querySelector('.chathead .ct b').textContent = (r.emoji || '') + ' ' + r.title; }).catch(() => {});
  }

  /* ---------------------------------------------------------------- private messages */
  async function dms() {
    page('#/dms', h('p', { class: 'hint spark' }, 'Loading…'));
    if (!ME) await load();
    const [{ threads }, { invites }, mine] = await Promise.all([API.dmList(), API.inviteList().catch(() => ({ invites: [] })), API.rooms().catch(() => ({ rooms: [] }))]);
    const rooms = (mine.rooms || []).filter((r) => r.member);
    const req = threads.filter((t) => t.status === 'pending' && t.started_by !== ME.id).sort((x, y) => (y.boosted - x.boosted)), open = threads.filter((t) => t.status === 'open'), wait = threads.filter((t) => t.status === 'pending' && t.started_by === ME.id);
    const row = (t, tag) => h('a', { class: 'roomcard', href: '#/dm/' + t.id }, avatar('', t.nick, 40), h('span', { class: 'rc-t' }, h('b', null, (t.boosted ? '🚀 ' : '') + (t.nick || 'Member') + (t.streak >= 2 ? '  🔥 ' + t.streak : '')), h('small', null, (tag ? tag + ' · ' : '') + (t.last_body || ''))));
    const gameRow = (i) => h('a', { class: 'roomcard', href: '#/play/' + i.id }, avatar(i.peer.avatar, i.peer.nick, 40, i.peer.frame), h('span', { class: 'rc-t' }, h('b', null, '🎮 ' + i.peer.nick + TICK(i.peer.selfie_ok, i.peer.role, i.peer.fast)), h('small', null, i.state === 'invited' ? (i.mine ? 'Waiting for them to join' : 'Invited you to play. Tap to answer') : i.state === 'chat' ? 'Game ' + Math.min(3, i.round + 0) + ' of 3 · tap to play' : i.thread ? 'Passed! Tap to open the chat' : '')), h('span', { class: 'badge' }, i.state === 'invited' && !i.mine ? 'New' : 'Open'));
    let tab = req.length || invites.some((i) => !i.mine && i.state === 'invited') ? 'invites' : 'chats';
    const body = h('div', { class: 'stack' });
    const draw = () => {
      tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tab === tab ? 'true' : 'false'));
      const inc = invites.filter((i) => !i.mine && i.state === 'invited'), out = invites.filter((i) => i.mine && (i.state === 'invited' || i.state === 'chat')), play = invites.filter((i) => !i.mine && i.state === 'chat'), passed = invites.filter((i) => i.state === 'friends' && i.thread);
      if (tab === 'invites') body.replaceChildren(...[
        inc.length ? [h('div', { class: 'h2' }, 'Game invitations'), ...inc.map(gameRow)] : [], req.length ? [h('div', { class: 'h2' }, 'Messages from people'), ...req.map((t) => row(t))] : [],
        play.length ? [h('div', { class: 'h2' }, 'Games you are playing'), ...play.map(gameRow)] : [], out.length || wait.length ? [h('div', { class: 'h2' }, 'You sent, waiting for a reply'), ...out.map(gameRow), ...wait.map((t) => row(t, 'No reply yet'))] : [],
        passed.length ? [h('div', { class: 'h2' }, 'Games you passed'), ...passed.map(gameRow)] : [],
        !inc.length && !req.length && !out.length && !wait.length && !play.length && !passed.length ? [h('p', { class: 'hint' }, 'Nothing waiting. Invite someone from Match.')] : []].flat());
      else body.replaceChildren(...[open.length ? open.map((t) => row(t)) : [h('p', { class: 'hint' }, 'No private chats yet. Invite someone from Match, or tap a nickname in a group.')], rooms.length ? [h('div', { class: 'h2' }, 'Groups'), ...rooms.map((r) => h('a', { class: 'roomcard', href: '#/room/' + r.id }, h('span', { class: 'rc-e' }, r.emoji || '💬'), h('span', { class: 'rc-t' }, h('b', null, r.title), h('small', null, r.members + ' members · ' + r.msgs24 + ' messages today'))))] : []].flat());
    };
    const badge = req.length + invites.filter((i) => !i.mine && i.state === 'invited').length;
    const tabs = h('div', { class: 'seg' }, ['invites', 'chats'].map((t) => h('button', { class: 'segbtn', 'data-tab': t, onclick: () => { tab = t; draw(); } }, t === 'invites' ? 'Invites' + (badge ? ' (' + badge + ')' : '') : 'Chats & groups')));
    page('#/dms', h('div', { class: 'h2' }, 'Chats'), tabs, body); draw();
  }
  async function dm(id) {
    if (!ME) await load();
    let t = null, board = null, ui2 = {};
    const slot = h('div', { class: 'dmslot' }), tools = h('div', { class: 'dmtools' }), status = h('div');
    const pack = (d) => d.messages.map((m) => ({ ...m, user_id: m.mine ? ME.id : d.other.id, nick: d.other.nick }));
    const doAct = async (o) => { const r = await API.fgameAct(id, o); showGame(r.game); return r; };
    const H = { move: (cell) => doAct({ cell }), stroke: (stroke) => doAct({ stroke }), clear: () => doAct({ clear: true }), guess: async (guess) => { const r = await doAct({ guess }); if (r.correct) toast('🎉 Correct!'); }, pick: (pick) => doAct({ pick }), todPick: (kind) => doAct({ tod: 'pick', kind }), todDone: () => doAct({ tod: 'done' }) };
    function showGame(g) {
      slot.querySelectorAll('.gamectl').forEach((x) => x.remove());
      const ctl = h('div', { class: 'gamectl' });
      if (!g) { if (board) board.clear(); tools.style.display = ''; return; }
      tools.style.display = 'none';
      if (g.status === 'invited') {
        if (board) board.clear();
        ctl.append(g.by_me ? h('div', { class: 'note' }, '🎮 Waiting for them to join ' + g.label + '…', h('button', { class: 'btn sm', onclick: async () => { await API.fgameClose(id, false); showGame(null); } }, 'Cancel'))
          : h('div', { class: 'teamnote' }, h('b', null, '🎮 Invitation'), h('p', null, 'Your friend wants to play ' + g.label), h('div', { class: 'row' }, h('button', { class: 'btn pri sm', onclick: async () => { const r = await API.fgameAccept(id); showGame(r.game); } }, 'Play'), h('button', { class: 'btn sm', onclick: async () => { await API.fgameClose(id, true); showGame(null); } }, 'No thanks'))));
      } else { if (!board) board = window.GameBoard.mount(slot, null, H); board.set(g.view); ctl.append(h('button', { class: 'btn sm', onclick: async () => { await API.fgameClose(id, false); if (board) board.clear(); showGame(null); } }, g.status === 'done' || (g.view && g.view.done) ? 'Close game' : 'End game')); }
      slot.append(ctl);
    }
    const playMenu = () => { tools.replaceChildren(h('b', { class: 'hint' }, '🎮 Play together'), h('div', { class: 'row' }, [['xo', '❌⭕ XO'], ['draw', '🎨 Draw'], ['quiz', '🎲 Question']].map(([ty, l]) => h('button', { class: 'btn sm', onclick: async () => { try { const r = await API.fgameInvite(id, ty); showGame(r.game); } catch (e) { toast(err(e), 'bad'); } } }, l)), h('a', { class: 'btn sm', href: '#/date' }, '💌 Truth Date'), h('button', { class: 'btn sm', onclick: todMenu }, '🎭 Truth or Dare'))); };
    const todMenu = async () => {
      let st = null; try { st = await API.todState(); } catch (e) { toast(err(e), 'bad'); return; }
      tools.replaceChildren(h('b', { class: 'hint' }, '🎭 Truth or Dare: one of you pays for 24 hours'), ...st.levels.map((lv) => h('button', { class: 'btn sm block', disabled: !lv.allowed, onclick: async () => { try { const r = await API.fgameInvite(id, 'tod', lv.level); showGame(r.game); } catch (e) { toast(err(e), 'bad'); } } }, `Level ${lv.level} · ${lv.name} · ⭐ ${lv.price}` + (lv.allowed ? '' : ' · ' + lv.min_age + '+'))), h('button', { class: 'btn sm', onclick: playMenu }, '← Back'));
    };
    function banners(d) {
      const th = d.thread; status.replaceChildren();
      if (th.status === 'pending' && th.started_by === ME.id) status.append(h('div', { class: 'note stack' }, h('span', null, 'They have not answered yet. Open the chat right now for 5 ⭐?'), h('button', { class: 'btn pri sm', onclick: async () => { try { const r = await API.dmPayOpen(id); ME.points = r.balance; toast('Chat opened'); dm(id); } catch (e) { toast(err(e), 'bad'); } } }, 'Pay 5 ⭐ and open')));
      if (th.streak >= 2 && th.streak_pending) status.append(h('small', { class: 'hint' }, '🔥 ' + th.streak + ' days together. Write today to keep it going.'));
      if (th.locked) status.append(h('div', { class: 'note stack' }, h('span', null, '⏳ The free hour is over. One of you can unlock the chat for 3 ⭐ (you have ' + d.balance + ').'), h('button', { class: 'btn pri sm', onclick: async () => { try { const r = await API.dmUnlock(id); ME.points = r.balance; toast('Unlocked'); dm(id); } catch (e) { toast(err(e), 'bad'); } } }, 'Unlock for 3 ⭐')));
      else if (th.source === 'match' && !th.unlocked && th.unlock_until) { const min = Math.max(0, Math.round((new Date(th.unlock_until) - Date.now()) / 60000)); status.append(h('small', { class: 'hint' }, '⏳ Free chat: ' + min + ' min left')); }
    }
    chat({ title: 'Chat', backHref: '#/dms', headerExtra: muteBtn('dm', id),
      afterLayout: ({ banner }) => { banner.after(status, tools, slot); playMenu(); },
      extraTick: (d, first) => { if (!d.thread) return; banners(d); if (d.thread.status === 'open') API.fgameState(id).then((r) => showGame(r.game)).catch(() => {}); else tools.style.display = 'none'; },
      fetchFirst: async () => { const d = await API.dmOpen(id); t = d; if (d.thread.status === 'pending' && d.thread.started_by !== ME.id) showRequest(d); return { messages: pack(d), other: d.other, thread: d.thread, balance: d.balance }; },
      fetchAfter: async (a) => { const d = await API.dmOpen(id, a); return { messages: pack(d), other: d.other, thread: d.thread, balance: d.balance }; }, send: (b) => API.dmSend(id, b), report: (mid) => API.report(mid, 'dm') });
    function showRequest(d) {
      const bx = h('div', { class: 'note stack' }, h('b', null, d.other.nick + ' wants to message you'), h('div', { class: 'row' }, h('button', { class: 'btn pri', onclick: async () => { await API.dmRespond(id, true); bx.remove(); toast('Accepted'); } }, 'Accept'), h('button', { class: 'btn', onclick: async () => { await API.dmRespond(id, false); location.hash = '#/dms'; } }, 'Decline'), h('button', { class: 'btn danger', onclick: async () => { await API.dmRespond(id, false, true); location.hash = '#/dms'; } }, 'Block')));
      document.querySelector('.chatwrap').insertBefore(bx, document.querySelector('.chatlist'));
    }
  }


  /* ---------------------------------------------------------------- random match (text only) */
  const MEET = [['m', '👦', 'Guys'], ['both', '👥', 'Both'], ['f', '👧', 'Girls']], IAM = [['m', '👦', 'I am a guy'], ['f', '👧', 'I am a girl']];
  const seg = (on) => h('div', { class: 'seg' }, [['#/match', 'Swipe', 'swipe'], ['#/match/near', 'Near you', 'near'], ['#/match/random', 'Random', 'random'], ['#/match/online', 'Online', 'online']].map(([href, l, k]) => h('a', { href, class: on === k ? 'on' : '' }, l)));
  const GRADS = ['linear-gradient(160deg,#7b4dff,#ff6bb5)', 'linear-gradient(160deg,#00b4d8,#7b4dff)', 'linear-gradient(160deg,#ff9a3c,#ff4d6a)', 'linear-gradient(160deg,#27d3a2,#2a7bff)', 'linear-gradient(160deg,#ffd60a,#ff7a00)', 'linear-gradient(160deg,#a259ff,#3a1c71)', 'linear-gradient(160deg,#ff5e98,#ffb36b)', 'linear-gradient(160deg,#2b5876,#4e4376)'];
  const gradOf = (id) => GRADS[Number(id) % GRADS.length];
  async function swipe() {
    if (!ME) await load();
    const box = h('div', { class: 'stack' }), msg = h('input', { type: 'text', maxlength: 300, placeholder: 'Send a message', 'aria-label': 'Send a message', enterkeyhint: 'send' });
    $app.replaceChildren(h('div', { class: 'wrap cm' }, h('div', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, '🐱 A', h('b', null, 'Date')), h('a', { class: 'pill', href: '#/points' }, '⭐ ' + (ME ? ME.points : '…'))), seg('swipe'), box), bar('#/match', ME && ME.points));
    let card = null;
    function prefsView() {
      const pr = { gender: '', meet: 'both' };
      const pick = (arr, key) => h('div', { class: 'pickrow' }, arr.map(([v, e, l]) => h('button', { type: 'button', class: 'pickcard' + (pr[key] === v ? ' on' : ''), onclick: () => { pr[key] = v; prefsView2(); } }, h('span', null, e), h('b', null, l))));
      const prefsView2 = () => box.replaceChildren(h('div', { class: 'h2' }, 'Who you want to meet'), pick(IAM, 'gender'), pick(MEET, 'meet'), h('button', { class: 'btn pri block', onclick: async () => { if (!pr.gender) return toast('Pick who you are', 'bad'); try { await API.matchPrefs({ gender: pr.gender, meet: pr.meet }); next(); } catch (e) { toast(err(e), 'bad'); } } }, 'Done'));
      prefsView2();
    }
    function show(c) {
      card = c; msg.value = '';
      if (!c) return box.replaceChildren(h('div', { class: 'matchhero' }, h('div', { class: 'bigemoji' }, '🌙'), h('h1', { class: 'wz-h' }, 'No one new right now'), h('p', { class: 'hint' }, 'Come back later, or try Random to chat with someone online.')), h('a', { class: 'btn pri block', href: '#/match/random' }, '🎲 Try Random'), h('button', { class: 'btn block', onclick: next }, '↻ Check again'));
      const an = (window.ANIMALS || []).find((x) => 'animal:' + x[0] === c.avatar);
      const face = c.photo ? h('img', { class: 'sw-photo', src: c.photo, alt: '' }) : h('div', { class: 'sw-face' }, an ? an[1] : (c.nick || '?').slice(0, 1).toUpperCase());
      const more = h('button', { class: 'sw-more', 'aria-label': 'More', onclick: async () => { if (!confirm('Report and block ' + c.nick + '?')) return; try { await API.discoverReport(c.id); toast('Reported and blocked'); next(); } catch (e) { toast(err(e), 'bad'); } } }, '•••');
      const send = async () => { try { const r = await API.discoverAct(c.id, 'invite', msg.value.trim()); toast(r.state === 'friends' ? '🎉 It is a match! Open Chats' : r.state === 'waiting' ? 'Your message is waiting. They have to reply first.' : 'Message sent 💜'); next(); } catch (e) { toast(err(e), 'bad'); } };
      const boost = async () => { if (!confirm('Boost this message for 5 points? They get a notification and it goes first in their list.')) return; try { const r = await API.discoverAct(c.id, 'boost', msg.value.trim()); toast(r.boosted ? '🚀 Boosted' : 'Sent'); next(); } catch (e) { toast(err(e), 'bad'); } };
      msg.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } };
      box.replaceChildren(h('div', { class: 'swcard', style: 'background:' + gradOf(c.id) }, more, face,
        h('div', { class: 'sw-info' }, h('div', { class: 'sw-name' }, h('b', null, c.nick + TICK(c.selfie_ok, c.role, c.fast)), h('span', null, c.age_band), h('span', null, FLAG[c.country] || '')), h('div', { class: 'row' }, (c.shared.length ? c.shared : c.interests).slice(0, 5).map((x) => h('span', { class: 'sw-tag' }, (c.shared.includes(x) ? '✨ ' : '') + x))), c.langs && c.langs.length ? h('small', null, '🗣 ' + c.langs.join(' · ')) : null, c.last_seen ? h('small', null, presence(c.last_seen)) : null)),
        h('div', { class: 'sw-actions' }, msg, h('button', { class: 'sw-send', 'aria-label': 'Send one message', onclick: send }, '💬'), h('button', { class: 'sw-send boost', 'aria-label': 'Boost message, 5 points', onclick: boost }, '🚀')),
        h('div', { class: 'sw-actions2' }, h('button', { class: 'sw-skip', 'aria-label': 'Skip', onclick: async () => { try { await API.discoverAct(c.id, 'skip'); } catch (e) { /* ignore */ } next(); } }, '✕'), h('button', { class: 'btn pri sw-play', onclick: async () => { try { const r = await API.inviteGame(c.id); location.hash = '#/play/' + r.match; } catch (e) { toast(err(e), 'bad'); } } }, '🎮 Invite to play')), h('small', { class: 'hint' }, '💬 one message, free · 🚀 boost, 5 ⭐: a notification and first in their list · 🎮 games: 2 Yes out of 3 and you can chat'));
    }
    async function next() { try { const d = await API.discoverNext(); show(d.card); } catch (e) { if (/who you are/i.test(err(e))) return prefsView(); toast(err(e), 'bad'); } }
    next();
  }
  async function online() {
    if (!ME) await load();
    const box = h('div', { class: 'stack' }, h('p', { class: 'hint spark' }, 'Loading…'));
    $app.replaceChildren(h('div', { class: 'wrap cm' }, h('div', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, '🐱 A', h('b', null, 'Date')), h('a', { class: 'pill', href: '#/points' }, '⭐ ' + (ME ? ME.points : '…'))), seg('online'), box), bar('#/match', ME && ME.points));
    async function draw() {
      try {
        const d = await API.onlineList();
        box.replaceChildren(h('p', { class: 'hint' }, 'People online now. Invite someone to play 3 games together: XO, a drawing and a question.'), ...(d.online.length ? d.online.map((p) => h('div', { class: 'roomcard' }, avatar(p.avatar, p.nick, 44, p.frame), h('span', { class: 'rc-t' }, h('b', null, p.nick + TICK(p.selfie_ok, p.role, p.fast) + ' ' + (FLAG[p.country] || '')), h('small', null, (p.friend ? '💜 Friend · ' : '') + '🟢 Online · Age ' + p.age_band + (p.shared.length ? ' · ' + p.shared.slice(0, 2).join(', ') : ''))), h('button', { class: 'btn sm pri', onclick: async () => { try { const r = await API.inviteGame(p.id); location.hash = '#/play/' + r.match; } catch (e) { toast(err(e), 'bad'); } } }, '🎮 Play'))) : [h('div', { class: 'matchhero' }, h('div', { class: 'bigemoji' }, '🌙'), h('p', { class: 'hint' }, 'Nobody else is online right now.'), h('a', { class: 'btn pri block', href: '#/match' }, 'Browse in Swipe'))]));
      } catch (e) { if (/who you are/i.test(err(e))) { box.replaceChildren(h('a', { class: 'btn pri block', href: '#/match' }, 'Tell us who you want to meet first')); return; } box.replaceChildren(h('div', { class: 'note' }, err(e))); }
    }
    draw(); ui.setPoll(() => { if (document.visibilityState === 'visible') draw(); }, 6000);
  }
  async function near() {
    if (!ME) await load();
    const box = h('div', { class: 'stack' }, h('p', { class: 'hint spark' }, 'Loading…'));
    $app.replaceChildren(h('div', { class: 'wrap cm' }, h('div', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, '🐱 A', h('b', null, 'Date')), h('a', { class: 'pill', href: '#/points' }, '⭐ ' + (ME ? ME.points : '…'))), seg('near'), box), bar('#/match', ME && ME.points));
    const d = await API.discoverNear(), q = h('input', { type: 'text', placeholder: 'Search a place', 'aria-label': 'Search a place' }), list = h('div');
    const draw = () => { const t = q.value.trim().toLowerCase(); const rs = d.rooms.filter((r) => !t || r.title.toLowerCase().includes(t)); list.replaceChildren(...(rs.length ? rs.map((r) => h('a', { class: 'roomcard', href: '#/room/' + r.id }, h('span', { class: 'rc-e' }, r.emoji || '📍'), h('span', { class: 'rc-t' }, h('b', null, r.title), h('small', null, r.members + ' here')), h('span', { class: 'badge' }, 'Open'))) : [h('p', { class: 'hint' }, 'No place found.')])); };
    q.oninput = draw;
    box.replaceChildren(h('div', { class: 'nearhero' }, h('div', { class: 'bigemoji' }, FLAG[d.country] || '📍'), h('b', null, d.people + ' people in your country'), h('small', { class: 'hint' }, 'We only show cities and regions, never exact places.')), q, list); draw();
  }
  async function match(fixedId) {
    if (!ME) await load();
    let stop = false, shown = '', lastId = 0, cur = null, prefs = { gender: '', meet: 'both' };
    const box = h('div', { class: 'matchbox stack' });
    const shell = () => $app.replaceChildren(h('div', { class: 'wrap cm' }, h('div', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, '🐱 A', h('b', null, 'Date')), h('a', { class: 'pill', href: '#/points' }, '⭐ ' + (ME ? ME.points : '…'))), (fixedId ? h('a', { class: 'btn sm', href: '#/dms' }, '← Chats') : seg('random')), box), bar('#/match', ME && ME.points));
    const peerHead = (p) => h('div', { class: 'peer' }, avatar(p.avatar, p.nick, 52, p.frame), h('div', null, h('b', null, p.nick + TICK(p.selfie_ok, p.role, p.fast) + ' ' + (FLAG[p.country] || '')), h('small', { class: 'hint' }, presence(p.last_seen) + ' · Age ' + p.age_band + (p.langs && p.langs.length ? ' · ' + p.langs.join(', ') : '')), p.shared.length ? h('div', { class: 'row' }, p.shared.slice(0, 4).map((x) => h('span', { class: 'badge' }, x))) : null));
    function prefsView(first) {
      const pick = (arr, key) => h('div', { class: 'pickrow' }, arr.map(([v, e, l]) => h('button', { type: 'button', class: 'pickcard' + (prefs[key] === v ? ' on' : ''), onclick: () => { prefs[key] = v; prefsView(first); } }, h('span', null, e), h('b', null, l))));
      box.replaceChildren(h('div', { class: 'h2' }, 'Who you want to meet'), pick(IAM, 'gender'), pick(MEET, 'meet'),
        h('p', { class: 'hint' }, 'You only meet people in your age group. Everything is text. Nobody sees your real name.'),
        h('button', { class: 'btn pri block', onclick: async () => { if (!prefs.gender) return toast('Pick who you are', 'bad'); try { await API.matchPrefs({ gender: prefs.gender, meet: prefs.meet }); shown = ''; tick(); } catch (e) { toast(err(e), 'bad'); } } }, 'Done'));
    }
    function idleView(d) {
      prefs = { gender: d.gender, meet: d.meet || 'both' };
      box.replaceChildren(h('div', { class: 'matchhero' }, h('div', { class: 'bigemoji' }, '💜'), h('h1', { class: 'wz-h' }, 'Meet someone new'), h('p', { class: 'hint' }, 'We match you by interests, then you play 3 quick games. Two Yes out of three from both of you and you are friends.')),
        h('button', { class: 'btn pri block', onclick: async () => { try { const r = await API.matchJoin(); if (r.state === 'matched') shown = ''; tick(); } catch (e) { toast(err(e), 'bad'); } } }, '🔍 Find someone'),
        h('button', { class: 'btn block', onclick: () => { shown = 'prefs'; prefsView(false); } }, '⚙️ Who I want to meet'));
    }
    function waitView() {
      box.replaceChildren(h('div', { class: 'matchhero' }, h('div', { class: 'bigemoji pulse' }, '💜'), h('h1', { class: 'wz-h' }, 'Looking for someone…'), h('p', { class: 'hint' }, 'Stay on this page. It can take up to 2 minutes.')),
        h('button', { class: 'btn block', onclick: async () => { await API.matchLeave(); shown = ''; tick(); } }, 'Cancel'));
    }
    function chatView(d) {
      const m = d.match, p = d.peer; lastId = 0;
      const list = h('div', { class: 'chatlist matchlist' }), inp = h('input', { type: 'text', maxlength: 300, placeholder: 'Say something (text only)', 'aria-label': 'Message', enterkeyhint: 'send' }), msg = h('div'), ctl = h('div', { class: 'matchctl' });
      let gameN = 0;
      const bubble = (x) => x.kind === 'game' ? h('div', { class: 'gamebub' }, h('small', null, '🎲 Round ' + (++gameN) + ' of ' + m.rounds), h('b', null, x.body)) : h('div', { class: 'cmsg' + (x.mine ? ' mine' : '') }, h('div', { class: 'bub' + (/^\[st:[a-z]+\]$/.test(x.body) ? ' stkmsg' : '') }, window.ChatStickers ? window.ChatStickers.body(x.body) : x.body));
      const draw = (st) => {
        cur = st; ctl.replaceChildren();
        if (st.state !== 'chat') return;
        if (st.round >= 1 && !st.voted) ctl.append(h('div', { class: 'votebar' }, h('span', null, (st.kind === 'invite' ? 'Do you want to chat with ' + p.nick + '? (' : 'Do you want to be friends? (') + st.round + '/' + st.rounds + ')'), h('button', { class: 'btn pri', onclick: () => vote(true) }, '✅ Yes'), h('button', { class: 'btn', onclick: () => vote(false) }, '❌ No')));
        else if (st.round >= 1 && st.voted && !st.their_voted) ctl.append(h('p', { class: 'hint' }, 'Waiting for their answer…'));
        if (st.kind === 'invite' && st.round < st.rounds && (st.round === 0 || (st.voted && st.their_voted))) { const nxt = ['❌⭕ XO', '🎨 Drawing', '🎲 Question'][st.round]; ctl.append(h('button', { class: 'btn pri block', onclick: async () => { try { await API.matchGame(m.id); poll(); } catch (e) { toast(err(e), 'bad'); } } }, 'Game ' + (st.round + 1) + ' of ' + st.rounds + ': ' + nxt)); } else if (st.kind !== 'invite' && st.round < st.rounds && (st.round === 0 || (st.voted && st.their_voted))) { const start = (type) => async () => { try { await API.matchGame(m.id, type); poll(); } catch (e) { toast(err(e), 'bad'); } }; ctl.append(h('div', { class: 'gamepick' }, h('b', null, st.round === 0 ? 'Pick a game' : 'Next game'), h('div', { class: 'row' }, h('button', { class: 'btn', onclick: start('quiz') }, '🎲 Question'), h('button', { class: 'btn', onclick: start('xo') }, '❌⭕ XO'), h('button', { class: 'btn', onclick: start('draw') }, '🎨 Draw')))); }
        if (board) board.set(st.game);
      };
      let board = null;
      async function vote(y) { try { const r = await API.matchVote(m.id, y); draw(r.match); poll(); } catch (e) { toast(err(e), 'bad'); } }
      async function poll() { try { const r = await API.matchMsgs(m.id, lastId); r.messages.forEach((x) => { lastId = Math.max(lastId, x.id); list.append(bubble(x)); }); if (r.messages.length) list.scrollTop = list.scrollHeight; draw(r.match); if (r.match.state !== 'chat') tick(); } catch (e) { /* next tick */ } }
      async function go() { const body = inp.value.trim(); if (!body) return; try { await API.matchSend(m.id, body); inp.value = ''; msg.replaceChildren(); poll(); } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, err(e))); } }
      inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
      const stkSlot = h('div'), stkBtn = stickerButton(stkSlot, async (id) => { try { await API.matchSend(m.id, '[st:' + id + ']'); msg.replaceChildren(); poll(); } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, err(e))); } });
      const menu = h('button', { class: 'btn sm', 'aria-label': 'More', onclick: () => { const ch = prompt('Type 1 to report and block this person, 2 to just leave the chat.'); if (ch === '1') API.matchReport(m.id, true).then(() => { shown = ''; tick(); }); else if (ch === '2') API.matchLeave(m.id).then(() => { shown = ''; tick(); }); } }, '⋯');
      box.replaceChildren(h('div', { class: 'chathead' }, peerHead(p), menu), list, msg, ctl, stkSlot, h('div', { class: 'composer' }, stkBtn, inp, h('button', { class: 'btn pri', onclick: go }, 'Send')));
      board = window.GameBoard.mount(box, ctl, { move: async (cell) => { const r = await API.matchMove(m.id, cell); draw(r.match); }, stroke: (k) => API.matchDraw(m.id, k), clear: () => API.matchDraw(m.id, null, true), guess: async (t) => { const r = await API.matchGuess(m.id, t); if (r.correct) toast('🎉 Correct!'); poll(); }, pick: async (i) => { const r = await API.matchPick(m.id, i); draw(r.match); } });
      draw(m); poll(); ui.setPoll(() => { if (document.visibilityState === 'visible') poll(); }, 2500);
    }
    function invitedView(d) {
      const p = d.peer;
      if (d.match.is_judge) return box.replaceChildren(h('div', { class: 'matchhero' }, avatar(p.avatar, p.nick, 88, p.frame), h('h1', { class: 'wz-h' }, p.nick + TICK(p.selfie_ok, p.role, p.fast) + ' invited you'), h('p', { class: 'hint' }, 'Three quick games: XO, a drawing and a question. After each one you say Yes or No. Two Yes out of three and they can chat with you.')), h('button', { class: 'btn pri block', onclick: async () => { await API.inviteRespond(d.match.id, true); shown = ''; tick(); } }, '🎮 Play'), h('button', { class: 'btn block', onclick: async () => { await API.inviteRespond(d.match.id, false); location.hash = '#/dms'; } }, 'No thanks'));
      box.replaceChildren(h('div', { class: 'matchhero' }, avatar(p.avatar, p.nick, 88, p.frame), h('h1', { class: 'wz-h' }, 'Waiting for ' + p.nick), h('p', { class: 'hint' }, 'We told them. You can leave this page: you get a notification when they join.')), h('a', { class: 'btn block', href: '#/dms' }, '← Back to chats'));
    }
    function doneView(d) {
      const friends = d.state === 'friends';
      if (d.match.kind === 'invite') {
        const inviter = d.match.invited_by_me;
        if (friends && inviter) return box.replaceChildren(h('div', { class: 'matchhero' }, h('div', { class: 'bigemoji' }, '🎉'), h('h1', { class: 'wz-h' }, 'They said Yes!'), h('p', { class: 'hint' }, 'You passed the games. Open the chat for 2 ⭐.')), h('button', { class: 'btn pri block', onclick: async () => { try { await API.dmUnlock(d.match.thread); location.hash = '#/dm/' + d.match.thread; } catch (e) { toast(err(e), 'bad'); } } }, 'Open the chat · 2 ⭐'), h('a', { class: 'btn block', href: '#/dm/' + d.match.thread }, 'Later'));
        return box.replaceChildren(h('div', { class: 'matchhero' }, h('div', { class: 'bigemoji' }, friends ? '🎉' : '👋'), h('h1', { class: 'wz-h' }, friends ? 'You are friends!' : 'The games are over'), h('p', { class: 'hint' }, friends ? 'Your chat is open.' : 'It was not a match this time.')), friends ? h('a', { class: 'btn pri block', href: '#/dm/' + d.match.thread }, '💬 Open our chat') : h('a', { class: 'btn pri block', href: '#/match' }, '🔍 Find someone'));
      }
      box.replaceChildren(h('div', { class: 'matchhero' }, h('div', { class: 'bigemoji' }, friends ? '🎉' : '👋'), h('h1', { class: 'wz-h' }, friends ? 'You are friends!' : 'This chat is over'), h('p', { class: 'hint' }, friends ? 'You both said Yes. Your private chat is open.' : 'You did not both say Yes enough times. Try someone new.')),
        friends ? h('a', { class: 'btn pri block', href: '#/dm/' + d.match.thread, onclick: () => API.matchLeave(d.match.id) }, '💬 Open our chat') : null,
        h('button', { class: friends ? 'btn block' : 'btn pri block', onclick: async () => { await API.matchLeave(d.match.id); shown = ''; tick(); } }, '🔍 Find someone new'));
    }
    async function tick() {
      if (stop) return;
      try {
        const d = fixedId ? await API.matchStateOf(fixedId) : await API.matchState(); if (shown === 'prefs') return;
        if (fixedId && d.state === 'invited') { const key0 = 'invited:' + d.match.id + d.match.is_judge; if (shown !== key0) { shown = key0; invitedView(d); } return; }
        if (d.state === 'idle' && !d.gender) { if (shown !== 'prefs0') { shown = 'prefs0'; prefsView(true); } return; }
        const key = d.state + (d.match ? ':' + d.match.id + ':' + d.state : '');
        if (d.state === 'matched') { if (shown !== key) { shown = key; chatView(d); } else { /* chat polls itself */ } return; }
        if (shown === key) return; shown = key;
        if (d.state === 'idle' || d.state === 'nobody') idleView(d); else if (d.state === 'waiting') waitView(); else doneView(d);
        if (d.state === 'nobody') box.prepend(h('div', { class: 'note' }, 'Nobody was around right now. Try again in a moment.'));
      } catch (e) { toast(err(e), 'bad'); }
    }
    shell(); ui.setPoll(() => { if (document.visibilityState === 'visible') tick(); }, 3000); await tick();
    const stopper = () => { stop = true; window.removeEventListener('hashchange', stopper); }; window.addEventListener('hashchange', stopper);
  }

  /* ---------------------------------------------------------------- settings: everything in one clear place */
  async function settings() {
    page('#/me', h('p', { class: 'hint spark' }, 'Loading…'));
    if (!ME) await load();
    const [acct, bl, mp] = await Promise.all([API.me().then((r) => r.user || {}).catch(() => ({})), API.blocksList().catch(() => ({ blocked: [] })), API.matchState().catch(() => ({}))]);
    const pr = { gender: mp.gender || '', meet: mp.meet || 'both', langs: new Set(mp.langs || []) };
    const LANGS = ['English', 'العربية', 'Français', 'Türkçe', 'Español', 'Deutsch', 'Italiano', 'Русский', 'Kurdî', 'Հայերեն'];
    const sec = (icon, title, ...kids) => h('section', { class: 'setsec' }, h('div', { class: 'sethead' }, h('span', null, icon), h('b', null, title)), ...kids);
    const row = (label, val) => h('div', { class: 'setrow' }, h('span', null, label), h('b', null, val || '—'));
    const link = (icon, label, href, hint) => h('a', { class: 'setlink', href }, h('span', null, icon), h('div', null, h('b', null, label), hint ? h('small', null, hint) : null), h('i', null, '›'));
    const pickRow = (arr, key) => { const el = h('div', { class: 'pickrow' }); const draw = () => el.replaceChildren(...arr.map(([v, e, l]) => h('button', { type: 'button', class: 'pickcard' + (pr[key] === v ? ' on' : ''), onclick: () => { pr[key] = v; draw(); } }, h('span', null, e), h('b', null, l)))); draw(); return el; };
    const langBox = h('div', { class: 'row' }, LANGS.map((l) => h('button', { class: 'chip', type: 'button', 'aria-pressed': pr.langs.has(l) ? 'true' : 'false', onclick: (ev) => { if (pr.langs.has(l)) pr.langs.delete(l); else if (pr.langs.size < 5) pr.langs.add(l); ev.currentTarget.setAttribute('aria-pressed', pr.langs.has(l) ? 'true' : 'false'); } }, l)));
    const blockedList = h('div', { class: 'stack' });
    const drawBlocked = (rows) => blockedList.replaceChildren(...(rows.length ? rows.map((x) => h('div', { class: 'setrow' }, h('span', null, x.nick), h('button', { class: 'btn sm', onclick: async () => { try { await API.userBlock(x.id, true); toast('Unblocked'); drawBlocked(rows.filter((y) => y.id !== x.id)); } catch (e) { toast(err(e), 'bad'); } } }, 'Unblock'))) : [h('p', { class: 'hint' }, 'You have not blocked anyone.')]));
    drawBlocked(bl.blocked || []);
    const selfieBox = h('div', { class: 'stack' }, h('p', { class: 'hint spark' }, 'Loading…'));
    API.selfieState().then((st) => {
      if (st.ok) return selfieBox.replaceChildren(h('p', null, '✅ You are verified by selfie.'));
      if (st.state === 'pending') return selfieBox.replaceChildren(h('p', null, '⏳ Your selfie is waiting to be checked. We will tell you.'));
      const f = h('input', { type: 'file', accept: 'image/*', capture: 'user', 'aria-label': 'Take a selfie' }), ok = h('input', { type: 'checkbox', 'aria-label': 'I agree' }), msg2 = h('div');
      selfieBox.replaceChildren(h('p', null, 'Get a ✅ next to your name and ' + st.reward + ' points.'), ...(st.state === 'rejected' ? [h('div', { class: 'note' }, 'Your last selfie was not accepted. Try again.')] : []),
        h('p', null, '1. Hold up ', h('b', { style: 'font-size:1.4rem' }, st.code + (st.code === 1 ? ' finger' : ' fingers')), ' next to your face.'), h('p', null, '2. Take the selfie.'), f,
        h('label', { class: 'row', style: 'gap:8px;align-items:flex-start' }, ok, h('span', { class: 'hint' }, 'I agree that the site owner looks at this selfie once to check that I am a real person. It is deleted right after. It is never shown to anyone.')),
        h('button', { class: 'btn pri block', onclick: async () => { const file = f.files[0]; if (!file) return msg2.replaceChildren(h('div', { class: 'note' }, 'Take the selfie first.')); if (!ok.checked) return msg2.replaceChildren(h('div', { class: 'note' }, 'Please agree first.')); try { const data = await ui.shrinkImage(file, 480, 0.7, true); await API.selfieSubmit(data); toast('Sent. We will check it soon.'); settings(); } catch (e) { msg2.replaceChildren(h('div', { class: 'note' }, err(e))); } } }, 'Send my selfie'), msg2);
    }).catch(() => selfieBox.replaceChildren(h('p', { class: 'hint' }, 'Not available now.')));
    const viewsSec = h('section', { class: 'setsec' }, h('div', { class: 'sethead' }, h('span', null, '👀'), h('b', null, 'Views')), h('a', { class: 'btn block', href: '#/views' }, 'See who looked at my profile'), h('a', { class: 'btn block', href: '#/me' }, '📷 Real photo and avatar'));
    const socialSec = h('section', { class: 'setsec' }, h('div', { class: 'sethead' }, h('span', null, '🔗'), h('b', null, 'My social accounts')), h('p', { class: 'hint spark' }, 'Loading…'));
    API.socialGet().then((s) => {
      const f = (k, label, ph) => h('label', { class: 'f' }, label + ' · ' + (s.earn[k] || 0) + ' ⭐', h('input', { type: 'text', value: (s.socials || {})[k] || '', placeholder: ph, autocapitalize: 'none', 'data-k': k }));
      const msg3 = h('div'), box3 = h('div', { class: 'stack' }, f('ig', 'Instagram', 'username'), f('snap', 'Snapchat', 'username'), f('tiktok', 'TikTok', 'username'), s.adult ? f('wa', 'WhatsApp number', 'digits with country code') : null,
        h('button', { class: 'btn pri block', onclick: async () => { const o = {}; box3.querySelectorAll('input[data-k]').forEach((i) => { o[i.dataset.k] = i.value; }); try { const r = await API.socialSet(o); ME.points = r.balance; toast('Saved ✓'); } catch (e) { msg3.replaceChildren(h('div', { class: 'note' }, err(e))); } } }, 'Save'), msg3);
      socialSec.replaceChildren(h('div', { class: 'sethead' }, h('span', null, '🔗'), h('b', null, 'My social accounts')), h('p', { class: 'hint' }, 'Each account you add earns you points, once. Other people pay points to see them, and only people in your own age group can: ' + (s.adult ? 'adults see adults' : 'under 18 see under 18') + '.' + (s.adult ? ' Phone numbers are for adults only.' : '')), box3);
    }).catch(() => socialSec.replaceChildren(h('p', { class: 'hint' }, 'Not available now.')));
    const pc = ui.pushControl ? await ui.pushControl() : null;
    const bdIn = h('input', { type: 'date', 'aria-label': 'New birthday', max: new Date().toISOString().slice(0, 10) });
    const dpw = h('input', { type: 'password', placeholder: 'Your password', 'aria-label': 'Password to delete', autocomplete: 'current-password' }), dtx = h('input', { type: 'text', placeholder: 'Type DELETE', 'aria-label': 'Type DELETE', autocapitalize: 'characters' });
    page('#/me', h('div', { class: 'wz-h', style: 'font-size:1.9rem;margin:6px 0' }, 'Settings'),
      sec('👤', 'My account', row('Phone', acct.phone ? '+' + acct.phone : ''), row('Email', acct.email), row('Birthday', acct.birthdate ? 'Private · ' + ME.age_band : ''), (ME.birthday_left > 0 ? h('div', { class: 'row' }, bdIn, h('button', { class: 'btn sm', type: 'button', onclick: async () => { if (!bdIn.value) return toast('Pick the date', 'bad'); if (!confirm('Change your birthday? You can do this ' + ME.birthday_left + ' more time(s).')) return; try { const r = await API.birthdaySet(bdIn.value); ME.birthday_left = r.left; toast('Birthday updated ✓'); settings(); } catch (e) { toast(err(e), 'bad'); } } }, 'Change')) : h('small', { class: 'hint' }, 'Wrong birthday? Write to the team in the support chat.')), row('Number check', acct.verified ? '✅ Verified' : 'Waiting for the owner'), h('p', { class: 'hint' }, 'Your real name is never shown. Only your nickname.')),
      viewsSec,
      sec('✏️', 'My profile', link('🪪', 'Nickname, avatar, photo, frame', '#/me', 'Change how people see you')),
      sec('💜', 'Matching', h('b', null, 'I am'), pickRow(IAM, 'gender'), h('b', null, 'I want to meet'), pickRow(MEET, 'meet'), h('b', null, 'Languages'), langBox,
        h('button', { class: 'btn pri block', onclick: async () => { if (!pr.gender) return toast('Pick who you are', 'bad'); try { await API.matchPrefs({ gender: pr.gender, meet: pr.meet, langs: [...pr.langs] }); toast('Saved ✓'); } catch (e) { toast(err(e), 'bad'); } } }, 'Save')),
      sec('🤳', 'Verified by selfie', selfieBox),
      socialSec,
      sec('🔔', 'Notifications', pc || h('p', { class: 'hint' }, 'Not available on this phone.'), h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: !ME.nudge_off, onchange: async (e) => { try { await API.nudgeSet(!e.target.checked); ME.nudge_off = !e.target.checked; toast('Saved ✓'); } catch (x) { toast(err(x), 'bad'); } } }), h('span', null, 'Reminders when I have been away (one a day at most)'))),
      sec('🌓', 'Look', h('button', { class: 'btn block', onclick: () => { ui.toggleMode(); } }, 'Switch light / dark')),
      sec('🛡️', 'Safety', h('p', { class: 'hint' }, 'Chats are text only. Links, phone numbers and usernames are blocked. Three people reporting someone mutes them for 24 hours.'), h('b', null, 'People I blocked'), blockedList),
      sec('⭐', 'Points', link('⭐', 'My points: ' + ME.points, '#/points', 'History and invite links'), link('🛒', 'Get more points', '#/shop'), link('🎲', 'Truth or Dare levels', '#/tod')),
      sec('❓', 'Help', link('🔑', 'I forgot my password', '#/recover'), link('📄', 'Privacy', '#/privacy'), link('📬', 'My invites (Truth Date)', '#/mine')),
      h('button', { class: 'btn block', onclick: async () => { await API.logout(); location.hash = '#/'; } }, 'Log out'),
      h('details', { class: 'setsec dangerbox' }, h('summary', null, '🗑️ Delete my account'), h('div', { class: 'stack' }, h('p', { class: 'hint' }, 'This erases your profile, chats, points and everything else for good. It cannot be undone.'), acct.has_password === false ? null : dpw, dtx,
        h('button', { class: 'btn danger block', onclick: async () => { if (!confirm('Delete your account for good?')) return; try { await API.deleteAccount(dpw.value, dtx.value); location.hash = '#/'; } catch (e) { toast(err(e), 'bad'); } } }, 'Delete for good'))));
  }
  /* ---------------------------------------------------------------- points and invites */
  async function points() {
    page('#/points', h('p', { class: 'hint spark' }, 'Loading…'));
    if (!ME) await load();
    const d = await API.points(); ME.points = d.balance;
    const link = location.origin + '/#/join/' + ME.ref_code, text = 'Come play on ADate with me: ' + link;
    const reasons = { share: 'Shared your card', photo: 'Real photo', frame: 'Season frame', tick: 'Visit bonus', profile: 'Profile completed', invite: 'Friend joined', room: 'Joined a room', nick: 'Changed nickname', buy: 'Bought points', first_buy: 'First purchase bonus', install: 'Added to home screen', social: 'Added a social account', social_view: 'Saw social accounts', birthday: 'Birthday gift', box: 'Daily surprise box', gift: 'Gift from the ADate team', selfie: 'Verified by selfie', tod: 'Truth or Dare' };
    page('#/points', h('div', { class: 'bigpts' }, h('small', null, 'Your points'), h('b', null, '⭐ ' + d.balance)),
      h('div', { class: 'note' }, '⏱ You get +1 every 6 hours when you open ADate (up to 4 a day). Next: ' + (new Date(d.next_tick_at) > new Date() ? 'at ' + timeShort(d.next_tick_at) : 'now')),
      h('div', { class: 'stack' }, h('div', { class: 'h2' }, 'Invite a friend: +5 points'), h('p', { class: 'hint' }, 'You earn 5 when your friend joins and sends their first message. Up to 10 friends a day.'), h('input', { type: 'text', readonly: '', value: link, onfocus: (e) => e.target.select(), 'aria-label': 'Your invite link' }),
        h('div', { class: 'row' }, h('a', { class: 'btn pri', target: '_blank', rel: 'noopener', href: 'https://wa.me/?text=' + encodeURIComponent(text) }, '💬 WhatsApp'), navigator.share ? h('button', { class: 'btn', onclick: () => navigator.share({ text }).catch(() => {}) }, 'Share…') : null, h('button', { class: 'btn', onclick: async (e) => { try { await navigator.clipboard.writeText(link); e.currentTarget.textContent = 'Copied ✓'; } catch (x) { /* select it */ } } }, 'Copy'))),
      h('div', { class: 'stack' }, h('div', { class: 'h2' }, 'Share your card: +2 points'), h('p', { class: 'hint' }, 'Share a card on your Snapchat story or in any app. You earn 2 points each time, up to 3 times a day.'), h('button', { class: 'btn pri block', onclick: () => shareCard(link, text) }, '📸 Share my card')),
      h('a', { class: 'btn block', href: '#/shop' }, '🛒 Get more points'),
      h('div', { class: 'h2' }, 'History'), ...(d.history.length ? d.history.map((x) => h('div', { class: 'hist' }, h('span', null, reasons[x.reason] || x.reason), h('b', { class: x.delta < 0 ? 'neg' : 'pos' }, (x.delta > 0 ? '+' : '') + x.delta))) : [h('p', { class: 'hint' }, 'Nothing yet.')]));
  }


  /** A story-sized card with your name and link, shared through the phone's share sheet (Snapchat, Instagram, WhatsApp...). */
  async function shareCard(link, text) {
    const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, H); const th = THEMES[ME.theme]; grad.addColorStop(0, '#ffc6ee'); grad.addColorStop(0.7, '#e57bff'); grad.addColorStop(1, '#c45cf0'); g.fillStyle = grad; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '700 150px system-ui, sans-serif'; g.fillText('ADate', W / 2, 420);
    g.font = '300 220px system-ui, sans-serif'; g.fillText('🐱', W / 2, 760);
    g.font = '700 84px system-ui, sans-serif'; g.fillText(((ME.nick || 'A friend') + ' invites you').slice(0, 26), W / 2, 1000);
    g.font = '500 64px system-ui, sans-serif'; g.fillText('Games, rooms and new friends', W / 2, 1110); g.fillText('Join with my link:', W / 2, 1220);
    g.fillStyle = 'rgba(255,255,255,.92)'; g.fillRect(90, 1290, W - 180, 150); g.fillStyle = '#8a1c5c'; g.font = '700 54px system-ui, sans-serif'; g.fillText(link.replace(/^https?:\/\//, ''), W / 2, 1385, W - 240);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const file = new File([blob], 'adate-card.png', { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text, title: 'ADate' });
      else if (navigator.share) await navigator.share({ text, title: 'ADate' });
      else { const a = h('a', { href: URL.createObjectURL(blob), download: 'adate-card.png' }); a.click(); try { await navigator.clipboard.writeText(text); } catch (e) { /* fine */ } toast('Card saved. Post it on your story.'); }
    } catch (e) { return; } // closed the share sheet: nothing was shared
    try { const r = await API.shareClaim(); toast(r.earned ? `+${r.earned} points ⭐` : 'Shared! (3 rewards a day)'); ME.points = r.balance; } catch (e) { /* offline */ }
  }

  /* ---------------------------------------------------------------- me: nickname, wallpaper, avatar */
  async function me() {
    page('#/me', h('p', { class: 'hint spark' }, 'Loading…'));
    const d = await load();
    const msg = h('div'), nickIn = h('input', { type: 'text', maxlength: 20, value: ME.nick, placeholder: 'Default nickname', 'aria-label': 'Default nickname' });
    const saveNick = (getCountry, inp) => async () => { try { await API.nickSet(getCountry(), inp.value); msg.replaceChildren(h('div', { class: 'note' }, 'Saved ✓ (changing a nickname costs 10 points).')); me(); } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, err(e))); } };
    const cIn = h('input', { type: 'text', maxlength: 20, placeholder: 'Nickname there', 'aria-label': 'Nickname for that country' }), cSel = h('select', { 'aria-label': 'Country' }, NICK_COUNTRIES.map((c) => h('option', { value: c }, (FLAG[c] || '') + ' ' + c)));
    const themes = Object.keys(THEMES).map((k) => h('button', { class: 'themebtn' + (ME.theme === k ? ' on' : ''), style: 'background:' + THEMES[k].sky, onclick: async () => { await API.meSet({ theme: k }); ME.theme = k; applyTheme(k); me(); }, 'aria-label': THEMES[k].name, title: THEMES[k].name }, THEMES[k].emoji));
    const animalBtns = (window.ANIMALS || []).map(([k, e]) => h('button', { class: 'avbtn' + (ME.avatar === 'animal:' + k ? ' on' : ''), 'aria-label': k, onclick: async () => { await API.meSet({ avatar: 'animal:' + k }); ME.avatar = 'animal:' + k; me(); } }, e));
    const avs = Object.keys(STICKERS).slice(0, 18).map((k) => { const b = h('button', { class: 'avbtn' + (ME.avatar === 'cartoon:' + k ? ' on' : ''), 'aria-label': k, onclick: async () => { await API.meSet({ avatar: 'cartoon:' + k }); ME.avatar = 'cartoon:' + k; me(); } }); b.innerHTML = STICKERS[k].svg; return b; });
    const pc = ui.pushControl ? await ui.pushControl() : null;
    const photoBox = () => {
      if (!ME.photo_ok) return h('div', { class: 'stack' }, h('div', { class: 'h2' }, 'Real photo'), h('p', { class: 'hint' }, 'The animal avatar is free. A real photo shows on your profile card for 30 days.'), h('button', { class: 'btn', onclick: async () => { if (!confirm(`Use a real photo for ${ME.photo_price} points a month?`)) return; try { await API.photoBuy(); me(); } catch (e) { toast(err(e), 'bad'); } } }, `📷 Real photo · ⭐ ${ME.photo_price} / month`));
      const f = h('input', { type: 'file', accept: 'image/*', 'aria-label': 'Choose a photo', onchange: async (e) => { const file = e.target.files[0]; if (!file) return; try { const data = await ui.shrinkImage(file, 320, 0.8, true); await API.photoSet(data); toast('Photo saved'); me(); } catch (x) { toast(err(x), 'bad'); } } });
      return h('div', { class: 'stack' }, h('div', { class: 'h2' }, 'Real photo'), ME.photo ? h('div', { class: 'photoprev' }, avatar('', ME.nick, 96, ME.frame, ME.photo)) : null, h('p', { class: 'hint' }, ME.has_photo ? 'Your photo is on your profile card until ' + String(ME.photo_until || '').slice(0, 10) + '.' : 'Choose a photo of yourself.'), f, ME.has_photo ? h('button', { class: 'btn sm danger', onclick: async () => { await API.photoSet('', true); me(); } }, 'Remove my photo') : null);
    };
    const frameBox = () => h('div', { class: 'stack' }, h('div', { class: 'h2' }, 'Season frames'), h('p', { class: 'hint' }, 'A frame around your picture. 5 points each, while the season lasts. You keep it.'), ...ME.frame_shop.map((f) => h('div', { class: 'roomcard' }, h('span', { class: 'rc-e' }, f.emoji), h('span', { class: 'rc-t' }, h('b', null, f.name), h('small', null, f.own ? (ME.frame === f.key ? 'Using it' : 'You own it') : f.open ? '⭐ ' + f.price : 'Not on sale now')),
      f.own ? h('button', { class: 'btn sm' + (ME.frame === f.key ? '' : ' pri'), onclick: async () => { await API.meSet({ frame: ME.frame === f.key ? '' : f.key }); me(); } }, ME.frame === f.key ? 'Remove' : 'Use') : f.open ? h('button', { class: 'btn sm', onclick: async () => { if (!confirm(`Buy the ${f.name} frame for ${f.price} points?`)) return; try { await API.frameBuy(f.key); me(); } catch (x) { toast(err(x), 'bad'); } } }, 'Buy') : h('span', { class: 'badge' }, '🔒'))));
    page('#/me', h('div', { class: 'hello' }, myAvatar(56), h('div', null, h('b', null, ME.nick || 'No nickname yet'), h('small', { class: 'hint' }, 'Your public profile'))),
      h('a', { class: 'btn pri block', href: '#/settings' }, '⚙️ Settings'),
      h('button', { class: 'btn', onclick: () => { ui.toggleMode(); me(); } }, '🌓 Light / dark'),
      h('div', { class: 'h2' }, 'Nickname'), nickIn, h('button', { class: 'btn sm pri', onclick: saveNick(() => '*', nickIn) }, 'Save'),
      h('details', null, h('summary', { class: 'hint' }, 'A different nickname for another country'), h('div', { class: 'stack' }, cSel, cIn, h('button', { class: 'btn sm', onclick: saveNick(() => cSel.value, cIn) }, 'Save for that country'),
        ...(d.me.nicks || []).filter((n) => n.country !== '*').map((n) => h('div', { class: 'hint' }, (FLAG[n.country] || '') + ' ' + n.country + ': ' + n.nick)))), msg,
      h('div', { class: 'h2' }, 'My wallpaper'), h('div', { class: 'themes' }, themes),
      h('div', { class: 'h2' }, 'My avatar'), h('div', { class: 'avs' }, animalBtns, avs),
      photoBox(), frameBox(),
      pc ? h('div', { class: 'stack' }, h('div', { class: 'h2' }, 'Notifications'), pc) : null,
      h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/mine' }, '📬 My invites'), h('button', { class: 'btn danger', onclick: async () => { await API.logout(); location.hash = '#/'; } }, 'Log out')));
  }


  /* ---------------------------------------------------------------- Truth or Dare */
  const LV_TXT = { 1: 'Friendly: easy and funny', 2: 'Normal: a bit more personal', 3: 'Mixed: light and sweet', 4: 'Flirty: for teens and up', 5: 'Spicy: the boldest level' };
  async function tod() {
    page('#/tod', h('p', { class: 'hint spark' }, 'Loading…'));
    if (!ME) await load();
    const d = await API.todState(); ME.points = d.balance;
    const seen = {};
    const play = (lv) => {
      const box = h('div', { class: 'todcard' }, h('small', null, 'Pick Truth or Dare'), h('b', { class: 'todq' }, '🎲'));
      const ask = async (kind) => {
        try { const q = await API.todNext(lv.level, kind, seen[lv.level] || []); (seen[lv.level] = seen[lv.level] || []).push(q.id); box.replaceChildren(h('small', null, q.kind === 'truth' ? '💬 TRUTH' : '🔥 DARE'), h('b', { class: 'todq' }, q.text)); }
        catch (e) { box.replaceChildren(h('div', { class: 'note' }, err(e))); }
      };
      page('#/tod', h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: tod }, '← Levels')), h('div', { class: 'h2' }, `Level ${lv.level}: ${lv.name}`), h('p', { class: 'hint' }, 'Read it out loud to your friends and play together. Be kind and keep it fun.'), box,
        h('div', { class: 'row' }, h('button', { class: 'btn pri', onclick: () => ask('truth') }, 'Truth'), h('button', { class: 'btn pri', onclick: () => ask('dare') }, 'Dare'), h('button', { class: 'btn', onclick: () => ask(null) }, '🎲 Random')));
    };
    const row = (lv) => {
      const open = lv.price === 0 || lv.until, msg = h('div');
      const btn = !lv.allowed ? h('span', { class: 'badge' }, `🔒 ages ${lv.min_age}+`) : open ? h('button', { class: 'btn sm pri', onclick: () => play(lv) }, 'Play') : h('button', { class: 'btn sm', onclick: async (e) => {
        if (!confirm(`Open level ${lv.level} for today (24 hours) for ${lv.price} points? You have ${d.balance}.`)) return; e.currentTarget.disabled = true;
        try { await API.todUnlock(lv.level); tod(); } catch (x) { toast(err(x), 'bad'); e.currentTarget.disabled = false; } } }, `Open · ⭐ ${lv.price}`);
      return h('div', { class: 'roomcard' }, h('span', { class: 'rc-e' }, ['', '😊', '🙂', '😉', '😏', '🌶️'][lv.level]), h('span', { class: 'rc-t' }, h('b', null, `Level ${lv.level}: ${lv.name}`), h('small', null, LV_TXT[lv.level] + (lv.until ? ' · open until ' + timeShort(lv.until) : lv.price ? ` · ⭐ ${lv.price} for 24 hours` : ' · free'))), btn, msg);
    };
    page('#/tod', h('div', { class: 'h2' }, '🎲 Truth or Dare'), h('p', { class: 'hint' }, 'Level 1 is free. The other levels open for 24 hours with your points. Some levels have an age limit.'), ...d.levels.map(row), h('a', { class: 'btn block', href: '#/points' }, 'Get more points'));
  }


  /* ---------------------------------------------------------------- buy points (Whish, checked by the owner) */
  async function shopPage() {
    page('#/shop', h('p', { class: 'hint spark' }, 'Loading…'));
    if (!ME) await load();
    const d = await API.shop(), msg = h('div');
    const STATUS = { pending: '⏳ waiting for your payment', claimed: '🔎 being checked', paid: '✅ paid', rejected: '❌ not accepted' };
    const money = (c) => '$' + (c / 100).toFixed(2);
    const back = h('a', { class: 'btn sm backbtn', href: '#/', 'aria-label': 'Back', onclick: (e) => { if (history.length > 1) { e.preventDefault(); history.back(); } } }, '← Back');
    const open = d.orders.find((o) => o.status === 'pending' || o.status === 'claimed');
    const pk = (kind) => d.products.find((x) => x.kind === kind) || {};
    const buy = (p) => async () => { try { await API.orderCreate(p.kind); shopPage(); } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, err(e))); } };
    const packs = d.products.map((p) => h('button', { class: 'pack' + (p.points >= 100 ? ' best' : ''), onclick: buy(p) }, p.points >= 100 ? h('em', null, 'Best value') : null, h('span', { class: 'pk-n' }, '⭐ ' + p.points), h('b', null, money(p.cents)), h('small', null, 'Tap to buy')));
    const num = d.settings.whish_number;
    let receipt = '';
    const txid = h('input', { type: 'text', maxlength: 24, placeholder: 'Transaction ID from the receipt', 'aria-label': 'Whish transaction ID', autocomplete: 'off', inputmode: 'text' });
    const prev = h('div', { class: 'receiptprev' }), file = h('input', { type: 'file', accept: 'image/*', 'aria-label': 'Screenshot of the Whish receipt', onchange: async (e) => { const f = e.target.files[0]; if (!f) return; try { receipt = await ui.shrinkImage(f, 1000, 0.75); prev.replaceChildren(h('img', { src: receipt, alt: 'Receipt preview' })); } catch (x) { msg.replaceChildren(h('div', { class: 'note' }, err(x))); } } });
    const copyBtn = h('button', { class: 'btn sm', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText('+' + num); toast('Number copied ✓'); } catch (e) { toast('Copy it by hand: +' + num, 'bad'); } } }, '📋 Copy');
    const payCard = open && open.status === 'pending' ? h('div', { class: 'stack paycard' },
      h('div', { class: 'note' }, h('b', null, `${pk(open.kind).label || ''} · ${money(open.cents)}`), h('p', { class: 'hint' }, 'Order AD-' + open.id)),
      h('b', null, '1️⃣ Send the money on Whish'), num ? h('div', { class: 'row numrow' }, h('span', { class: 'bignum' }, '+' + num), copyBtn) : h('p', { class: 'hint' }, 'The Whish number is not set yet. Chat with the team below.'),
      h('p', { class: 'hint' }, 'Send exactly ' + money(open.cents) + '.' + (d.settings.whish_note ? ' ' + d.settings.whish_note : '')),
      h('b', null, '2️⃣ Add a screenshot of the receipt'), file, prev,
      h('b', null, '3️⃣ Write the transaction ID'), txid,
      h('button', { class: 'btn pri block', type: 'button', onclick: async () => { if (!receipt) return msg.replaceChildren(h('div', { class: 'note' }, 'Add the screenshot of your Whish receipt first.')); try { await API.orderPaid(open.id, txid.value, receipt); toast('Sent. We will check it now.'); shopPage(); } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, err(e))); } } }, '✅ I paid, check it'),
      h('p', { class: 'hint' }, 'No receipt, no points. Each transaction ID counts once. A fake receipt means lost points and a ban.'),
      h('button', { class: 'btn sm', type: 'button', onclick: async () => { try { await API.orderCancel(open.id); } catch (e) { /* ignore */ } shopPage(); } }, 'Choose a different pack'))
      : open ? h('div', { class: 'note stack' }, h('b', null, '🔎 We are checking your payment'), h('p', { class: 'hint' }, `Order AD-${open.id} · ${money(open.cents)}. This usually takes a few minutes. You will get a notification when your points arrive.`)) : null;
    page('#/shop', back, h('div', { class: 'h2' }, '🛒 Get more points'), !open && d.first_bonus ? h('div', { class: 'note' }, '🎁 Your first purchase gives you ' + d.first_bonus + ' extra points for free.') : null,
      open ? payCard : h('div', { class: 'packs' }, ...packs),
      msg, h('button', { class: 'btn block', onclick: async () => { try { const r = await API.supportOpen(); location.hash = '#/dm/' + r.thread; } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, err(e))); } } }, '💬 No Whish? Chat with the team'), h('div', { class: 'h2' }, 'My orders'), ...(d.orders.length ? d.orders.map((o) => h('div', { class: 'hist' }, h('span', null, `AD-${o.id} · ${STATUS[o.status] || o.status}`), h('b', null, money(o.cents)))) : [h('p', { class: 'hint' }, 'No orders yet.')]));
    if (open && open.status === 'claimed') ui.setPoll(async () => { try { const x = await API.shop(); if (!x.orders.find((o) => o.id === open.id && (o.status === 'pending' || o.status === 'claimed'))) { const me2 = await API.points(); ME.points = me2.balance; shopPage(); toast(x.orders.find((o) => o.id === open.id && o.status === 'paid') ? '🎉 Congratulations! Your points arrived.' : 'Your payment was not accepted.'); } } catch (e) { /* next time */ } }, 4000);
  }

  /* ---------------------------------------------------------------- referral landing */
  function join(code) { store.set('adate.ref', String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)); location.hash = API.session ? '#/' : '#/signup'; }



  /** Views: everyone who opened my profile or liked me. Names are hidden until I pay 1 star; then I can write to them. */
  async function viewsPage() {
    if (!ME) await load();
    page('#/views', h('p', { class: 'hint spark' }, 'Loading…'));
    let d; try { d = await API.viewsFeed(); } catch (e) { return page('#/views', h('p', { class: 'hint' }, err(e))); }
    const list = h('div', { class: 'stack' });
    const write = async (p) => { const body = prompt('Say hi to ' + p.nick + ' (they will see it first and can accept)', 'Hi! 👋'); if (!body) return; try { await API.dmStart(p.id, body); toast('Sent ✓'); } catch (e) { toast(err(e), 'bad'); } };
    const draw = () => list.replaceChildren(...(d.views.length ? d.views.map((v) => {
      const what = (v.liked === 'boost' ? '🚀 boosted you' : v.liked === 'invite' ? '💜 liked you' : '') + (v.viewed && v.liked ? ' · ' : '') + (v.viewed ? '👀 viewed your profile' : '');
      if (v.revealed) return h('div', { class: 'roomcard' }, avatar(v.avatar, v.nick, 44, v.frame, v.photo), h('span', { class: 'rc-t' }, h('b', null, v.nick + TICK(v.selfie_ok, v.role)), h('small', null, what + ' · ' + ui.ago(v.at))), h('button', { class: 'btn sm pri', type: 'button', onclick: () => write(v) }, '💬 Message'));
      return h('div', { class: 'roomcard' }, h('span', { class: 'avatar blurav', style: 'width:44px;height:44px' }, '🙂'), h('span', { class: 'rc-t' }, h('b', null, 'Someone · ' + v.age_band + ' ' + (FLAG[v.country] || '')), h('small', null, what + ' · ' + ui.ago(v.at))), h('button', { class: 'btn sm', type: 'button', onclick: async () => { try { const r = await API.viewReveal(v.id); ME.points = r.balance; Object.assign(v, r.person, { revealed: true }); draw(); } catch (e) { toast(err(e), 'bad'); } } }, '👁 See who · ' + d.price + ' ⭐'));
    }) : [h('div', { class: 'matchhero' }, h('div', { class: 'bigemoji' }, '👀'), h('p', { class: 'hint' }, 'Nobody yet. When people open your profile or like you in Swipe, they show up here.'))]));
    draw();
    page('#/views', h('div', { class: 'h2' }, '👀 Views'), h('p', { class: 'hint' }, d.today + ' today. Seeing who it is costs ' + d.price + ' ⭐, once. Then you can write to them.'), list);
  }
  return function route(hash) {
    if (!API.enabled) return null;
    const s = API.session;
    const ok = !!(s && s.profile_done);
    const wrap = (f) => () => { document.body.style.background = ''; return guard(f); };
    if (hash.startsWith('#/join/')) return () => join(hash.slice(7));
    if (!ok) return null;
    if (hash === '' || hash === '#/' || hash === '#') return wrap(hub);
    if (hash === '#/match') return wrap(swipe);
    if (hash === '#/match/near') return wrap(near);
    if (hash === '#/match/random') return wrap(() => match());
    if (hash === '#/match/online') return wrap(online);
    if (hash.startsWith('#/play/')) return wrap(() => match(hash.slice(7)));
    if (hash === '#/rooms') return wrap(rooms);
    if (hash === '#/views') return wrap(viewsPage);
    if (hash.startsWith('#/room/')) return wrap(() => room(hash.slice(7)));
    if (hash === '#/dms') return wrap(dms);
    if (hash.startsWith('#/dm/')) return wrap(() => dm(hash.slice(5)));
    if (hash === '#/points') return wrap(points);
    if (hash === '#/me') return wrap(me);
    if (hash === '#/settings') return wrap(settings);
    if (hash === '#/tod') return wrap(tod);
    if (hash === '#/shop') return wrap(shopPage);
    return null;
  };
};
})();
