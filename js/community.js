// ADate community: hub, rooms, chat, private messages, points, profile. Runs on top of app.js (it gets the shared helpers in CommunityInit).
(function () {
'use strict';
window.CommunityInit = function (ui) {
  const { h, $app, store } = ui;
  const API = window.API;
  const THEMES = window.THEMES || {}, STICKERS = window.STICKERS || {};
  const FLAG = { LB: '🇱🇧', AE: '🇦🇪', SA: '🇸🇦', QA: '🇶🇦', KW: '🇰🇼', FR: '🇫🇷', US: '🇺🇸', CA: '🇨🇦', AU: '🇦🇺', DE: '🇩🇪', GB: '🇬🇧', EG: '🇪🇬', AF: '🌍', BH: '🇧🇭', OM: '🇴🇲', JO: '🇯🇴', SY: '🇸🇾', IQ: '🇮🇶', TR: '🇹🇷', CY: '🇨🇾', BR: '🇧🇷', SE: '🇸🇪', IT: '🇮🇹', ES: '🇪🇸' };
  const NICK_COUNTRIES = ['LB', 'AE', 'SA', 'QA', 'KW', 'FR', 'US', 'CA', 'AU', 'DE', 'GB', 'EG'];
  let ME = null;
  const err = (e) => (e && e.message) || 'Something went wrong';
  const timeShort = (iso) => { const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const toast = (m, kind) => { const t = h('div', { class: 'toast ' + (kind || '') }, m); document.body.append(t); setTimeout(() => t.remove(), 2600); };
  const applyTheme = (key) => { document.body.style.background = THEMES[key] ? THEMES[key].sky : ''; };

  const FRAME_LOOK = { halloween: ['#ff7a00', '🎃'], newyear: ['#e6b422', '🎆'], ramadan: ['#6b4fbb', '🌙'] };
  function avatar(av, nick, size, frame, photo) {
    const sz = size || 40, box = h('span', { class: 'avatar' + (frame ? ' framed' : ''), style: `width:${sz}px;height:${sz}px` + (FRAME_LOOK[frame] ? `;--ring:${FRAME_LOOK[frame][0]}` : '') });
    const k = String(av || '').replace(/^cartoon:/, ''), an = /^animal:/.test(av || '') ? (window.ANIMALS || []).find((x) => 'animal:' + x[0] === av) : null;
    if (photo && /^data:image\//.test(photo)) box.append(h('img', { src: photo, alt: '' })); else if (an) { box.classList.add('animal'); box.textContent = an[1]; box.style.fontSize = Math.round(sz * 0.6) + 'px'; } else if (av && STICKERS[k]) box.innerHTML = STICKERS[k].svg; else box.textContent = (nick || '?').trim().slice(0, 1).toUpperCase();
    if (FRAME_LOOK[frame]) box.append(h('i', { class: 'fr' }, FRAME_LOOK[frame][1]));
    return box;
  }
  const bar = (active, points) => h('nav', { class: 'tabbar' }, [['#/', '🏠', 'Hub'], ['#/rooms', '🧭', 'Rooms'], ['#/dms', '💬', 'Chats'], ['#/points', '⭐', points == null ? 'Points' : String(points)], ['#/me', '👤', 'Me']].map(([href, e, l]) => h('a', { href, class: active === href ? 'on' : '' }, h('span', null, e), h('small', null, l))));
  function page(active, ...kids) {
    document.title = 'ADate';
    $app.replaceChildren(h('div', { class: 'wrap cm' }, h('div', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, '🐱 A', h('b', null, 'Date')), h('a', { class: 'pill', href: '#/points' }, '⭐ ' + (ME ? ME.points : '…'))), ...kids), bar(active, ME && ME.points));
  }
  async function load() { // who am I; also earns the +1 that comes every 6 hours
    const d = await API.hub(); ME = d.me; applyTheme(ME.theme); window.__dmRequests = d.dm_requests;
    API.pointsClaim().then((r) => { if (r && r.claimed) { ME.points = r.balance; toast('+1 point ⭐'); } }).catch(() => {});
    return d;
  }
  const guard = async (fn) => { try { await fn(); } catch (e) { if (/log in|blocked/i.test(err(e))) { if (/blocked/i.test(err(e))) { API.clear(); } location.hash = '#/login'; return; } if (/profile/i.test(err(e))) { location.hash = '#/welcome'; return; } $app.replaceChildren(h('div', { class: 'wrap cm' }, h('div', { class: 'note' }, err(e)), h('a', { class: 'btn', href: '#/' }, 'Back'))); } };

  /* ---------------------------------------------------------------- hub */
  async function hub() {
    page('#/', h('p', { class: 'hint spark' }, 'Loading…'));
    const d = await load(), rs = (await API.rooms()).rooms;
    const mine = rs.filter((r) => r.member), suggest = rs.filter((r) => !r.member && (r.score || 0) > 0).slice(0, 5);
    const roomRow = (r) => h('a', { class: 'roomcard', href: '#/room/' + r.id }, h('span', { class: 'rc-e' }, r.emoji || '💬'), h('span', { class: 'rc-t' }, h('b', null, r.title), h('small', null, `${r.members} here · ${r.msgs24} messages today`)), r.member ? h('span', { class: 'badge ok' }, 'Joined') : h('span', { class: 'badge' }, r.price ? '⭐ ' + r.price : 'Free'));
    const nickBox = ME.nick ? null : (() => { const inp = h('input', { type: 'text', maxlength: 20, placeholder: 'Your nickname', 'aria-label': 'Nickname' }), msg = h('div'); return h('div', { class: 'note' }, h('b', null, 'Choose your nickname'), h('p', { class: 'hint' }, 'This is the name people see in rooms. Not your real name.'), inp, h('button', { class: 'btn pri block', onclick: async () => { try { await API.nickSet('*', inp.value); hub(); } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, err(e))); } } }, 'Save nickname'), msg); })();
    page('#/', h('div', { class: 'hello' }, avatar(ME.avatar, ME.nick, 52, ME.frame), h('div', null, h('b', null, 'Hi ' + (ME.nick || 'there') + ' ' + (FLAG[ME.country] || '')), h('small', { class: 'hint' }, 'Age circles: ' + ME.circles.join(' · ')))), nickBox,
      d.dm_requests ? h('a', { class: 'note', href: '#/dms' }, '💬 ' + d.dm_requests + ' message request' + (d.dm_requests > 1 ? 's' : '') + ' waiting') : null,
      h('div', { class: 'h2' }, 'Games'),
      h('div', { class: 'grid2' }, h('a', { class: 'gamecard c1', href: '#/date' }, h('b', null, '💌 Truth Date'), h('small', null, 'Ask someone out with a game they cannot say no to')), h('a', { class: 'gamecard c2', href: '#/tod' }, h('b', null, '🎲 Truth or Dare'), h('small', null, 'Five levels, from friendly to spicy'))),
      mine.length ? [h('div', { class: 'h2' }, 'My rooms'), ...mine.slice(0, 6).map(roomRow)] : null,
      h('div', { class: 'h2' }, mine.length ? 'More for you' : 'Rooms picked for you'), ...suggest.map(roomRow), h('a', { class: 'btn block', href: '#/rooms' }, 'See all rooms'),
      h('a', { class: 'gamecard c3', href: '#/points' }, h('b', null, '🎁 Invite a friend, get 5 points'), h('small', null, 'Share your link. You earn when they send their first message.')));
  }

  /* ---------------------------------------------------------------- rooms */
  async function rooms() {
    page('#/rooms', h('p', { class: 'hint spark' }, 'Loading…'));
    if (!ME) await load();
    const d = await API.rooms(); let filter = 'all', q = '';
    const list = h('div', { class: 'stack' });
    const draw = () => {
      const rs = d.rooms.filter((r) => (filter === 'all' || (filter === 'mine' && r.member) || (filter === 'foryou' && r.score > 0) || (filter === r.kind)) && (!q || r.title.toLowerCase().includes(q)));
      list.replaceChildren(...(rs.length ? rs.map((r) => h('div', { class: 'roomcard' }, h('span', { class: 'rc-e' }, r.emoji || '💬'), h('span', { class: 'rc-t' }, h('b', null, r.title + (r.country ? ' ' + (FLAG[r.country] || '') : '')), h('small', null, `${r.members} members · ${r.msgs24} messages today` + (r.score >= 60 ? ' · 🔥 great match' : ''))),
        r.member ? h('a', { class: 'btn sm pri', href: '#/room/' + r.id }, 'Open') : h('button', { class: 'btn sm', onclick: async (e) => {
          if (r.price && !confirm(`Joining ${r.title} costs ${r.price} points. You have ${d.balance}. Join?`)) return;
          e.currentTarget.disabled = true; try { await API.roomJoin(r.id); location.hash = '#/room/' + r.id; } catch (x) { toast(err(x), 'bad'); e.currentTarget.disabled = false; } } }, r.price ? 'Join · ⭐ ' + r.price : 'Join · free'))) : [h('p', { class: 'hint' }, 'No rooms here.')]));
    };
    const search = h('input', { type: 'text', placeholder: 'Search rooms', 'aria-label': 'Search rooms', oninput: (e) => { q = e.target.value.trim().toLowerCase(); draw(); } });
    const chips = h('div', { class: 'row' }, [['all', 'All'], ['foryou', 'For you'], ['mine', 'Joined'], ['region', '📍 Places'], ['interest', 'Interests'], ['season', '🎃 Seasonal']].map(([id, l]) => h('button', { class: 'chip', 'aria-pressed': id === filter ? 'true' : 'false', onclick: (e) => { filter = id; chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === e.currentTarget ? 'true' : 'false')); draw(); } }, l)));
    page('#/rooms', h('div', { class: 'h2' }, 'Rooms'), h('p', { class: 'hint' }, 'Text only. No links, no numbers. Places are free; some interest rooms cost 10 to 25 points.'), search, chips, list); draw();
  }

  /* ---------------------------------------------------------------- profile card */
  async function card(userId) {
    let p; try { p = await API.profileView(userId); } catch (e) { return toast(err(e), 'bad'); }
    const m = h('div', { class: 'modal', onclick: (e) => { if (e.target === m) m.remove(); } });
    const dm = h('div', { class: 'stack' });
    m.append(h('div', { class: 'sheet stack' }, h('div', { class: 'hello' }, avatar(p.avatar, p.nick, 56, p.frame, p.photo), h('div', null, h('b', null, p.nick + ' ' + (FLAG[p.country] || '')), h('small', { class: 'hint' }, `Age ${p.age} · ${p.zodiac}` + (p.verified ? ' · ✅ checked' : '')))),
      p.interests.length ? h('div', { class: 'row' }, p.interests.map((i) => h('span', { class: 'chip static' }, i))) : null,
      p.me ? null : [p.can_dm ? h('div', { class: 'stack' }, h('input', { type: 'text', maxlength: 300, placeholder: 'Say hi (text only)', 'aria-label': 'First message' }), h('button', { class: 'btn pri block', onclick: async (e) => {
        const body = e.currentTarget.parentNode.querySelector('input').value; try { const r = await API.dmStart(p.id, body); m.remove(); location.hash = '#/dm/' + r.thread; } catch (x) { dm.replaceChildren(h('div', { class: 'note' }, err(x))); } } }, '💬 Send message request')) : h('p', { class: 'hint' }, 'Private messages are only between people in the same age circles.'), dm,
        h('button', { class: 'btn block danger', onclick: async () => { if (!confirm(p.blocked ? 'Unblock this person?' : 'Block this person? You will not see each other.')) return; await API.userBlock(p.id, p.blocked); toast(p.blocked ? 'Unblocked' : 'Blocked'); m.remove(); } }, p.blocked ? 'Unblock' : '🚫 Block')],
      h('button', { class: 'btn block', onclick: () => m.remove() }, 'Close')));
    document.body.append(m);
  }

  /* ---------------------------------------------------------------- chat engine (rooms and private) */
  function chat({ title, emoji, backHref, headerExtra, fetchFirst, fetchAfter, send, mineKey, report }) {
    let last = 0, mutedUntil = null;
    const list = h('div', { class: 'chatlist' }), msg = h('div'), inp = h('input', { type: 'text', maxlength: 500, placeholder: 'Write a message (text only)', 'aria-label': 'Message', enterkeyhint: 'send' });
    const sendBtn = h('button', { class: 'btn pri', type: 'button' }, 'Send');
    const bubble = (m) => h('div', { class: 'cmsg' + (m.mine ? ' mine' : '') }, m.mine ? null : h('button', { class: 'who', onclick: () => m.user_id && card(m.user_id) }, m.nick || ''), h('div', { class: 'bub' }, m.body), h('small', null, timeShort(m.at), ' ', m.mine || !report ? '' : h('button', { class: 'flag', title: 'Report', 'aria-label': 'Report this message', onclick: async () => { if (!confirm('Report this message?')) return; try { const r = await report(m.id); toast(r.muted ? 'Reported. Thank you.' : 'Reported. Thank you.'); } catch (e) { toast(err(e), 'bad'); } } }, '🚩')));
    const add = (rows) => { if (!rows.length) return; const near = list.scrollHeight - list.scrollTop - list.clientHeight < 140; rows.forEach((m) => { last = Math.max(last, m.id); list.append(bubble(m)); }); if (near || last === rows[rows.length - 1].id && list.children.length === rows.length) list.scrollTop = list.scrollHeight; };
    async function tick(first) {
      try { const d = first ? await fetchFirst() : await fetchAfter(last); if (first && d.room) head.querySelector('small').textContent = `${d.room.members} members`; mutedUntil = d.muted_until || null; banner.textContent = mutedUntil ? '🔇 You are muted for a while. You can still read.' : ''; banner.style.display = mutedUntil ? '' : 'none'; if (first) list.replaceChildren(); add(d.messages || []); if (first && d.other) head.querySelector('b').textContent = d.other.nick; } catch (e) { if (/log in/i.test(err(e))) location.hash = '#/login'; }
    }
    async function go() { const body = inp.value.trim(); if (!body) return; sendBtn.disabled = true; try { await send(body); inp.value = ''; msg.replaceChildren(); await tick(false); list.scrollTop = list.scrollHeight; } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, err(e))); } sendBtn.disabled = false; inp.focus(); }
    sendBtn.onclick = go; inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    const head = h('div', { class: 'chathead' }, h('a', { class: 'btn sm', href: backHref }, '←'), h('div', { class: 'ct' }, h('b', null, (emoji ? emoji + ' ' : '') + title), h('small', null, '')), headerExtra || null);
    const banner = h('div', { class: 'note', style: 'display:none' });
    $app.replaceChildren(h('div', { class: 'wrap cm chatwrap' }, head, banner, list, msg, h('div', { class: 'composer' }, inp, sendBtn)), bar(null, ME && ME.points));
    tick(true).then(() => { list.scrollTop = list.scrollHeight; });
    ui.setPoll(() => { if (document.visibilityState === 'visible') tick(false); }, 3000);
  }

  async function room(id) {
    if (!ME) await load();
    chat({ title: 'Room', backHref: '#/rooms', fetchFirst: () => API.msgList(id), fetchAfter: (a) => API.msgList(id, a), send: (b) => API.msgSend(id, b), report: (mid) => API.report(mid, 'room'),
      headerExtra: h('button', { class: 'btn sm', onclick: async () => { if (confirm('Leave this room?')) { await API.roomLeave(id); location.hash = '#/rooms'; } } }, 'Leave') });
    API.rooms().then((d) => { const r = d.rooms.find((x) => String(x.id) === String(id)); if (r) document.querySelector('.chathead .ct b').textContent = (r.emoji || '') + ' ' + r.title; }).catch(() => {});
  }

  /* ---------------------------------------------------------------- private messages */
  async function dms() {
    page('#/dms', h('p', { class: 'hint spark' }, 'Loading…'));
    if (!ME) await load();
    const { threads } = await API.dmList();
    const req = threads.filter((t) => t.status === 'pending' && t.started_by !== ME.id), open = threads.filter((t) => t.status === 'open'), wait = threads.filter((t) => t.status === 'pending' && t.started_by === ME.id);
    const row = (t) => h('a', { class: 'roomcard', href: '#/dm/' + t.id }, avatar('', t.nick, 40), h('span', { class: 'rc-t' }, h('b', null, t.nick || 'Member'), h('small', null, t.last_body || '')));
    page('#/dms', h('div', { class: 'h2' }, 'Chats'), h('p', { class: 'hint' }, 'Private messages are only between people in the same age circles. Text only.'),
      req.length ? [h('div', { class: 'h2' }, 'Requests'), ...req.map(row)] : null, open.length ? open.map(row) : (!req.length ? h('p', { class: 'hint' }, 'No private chats yet. Tap a nickname in a room to say hi.') : null),
      wait.length ? [h('div', { class: 'h2' }, 'Waiting for a reply'), ...wait.map(row)] : null);
  }
  async function dm(id) {
    if (!ME) await load();
    let t = null;
    chat({ title: 'Chat', backHref: '#/dms', fetchFirst: async () => { const d = await API.dmOpen(id); t = d; if (d.thread.status === 'pending' && d.thread.started_by !== ME.id) showRequest(d); return { messages: d.messages.map((m) => ({ ...m, user_id: m.mine ? ME.id : d.other.id, nick: d.other.nick })), other: d.other, thread: d.thread }; },
      fetchAfter: async (a) => { const d = await API.dmOpen(id, a); return { messages: d.messages.map((m) => ({ ...m, user_id: m.mine ? ME.id : d.other.id, nick: d.other.nick })) }; }, send: (b) => API.dmSend(id, b), report: (mid) => API.report(mid, 'dm') });
    function showRequest(d) {
      const bx = h('div', { class: 'note stack' }, h('b', null, d.other.nick + ' wants to message you'), h('div', { class: 'row' }, h('button', { class: 'btn pri', onclick: async () => { await API.dmRespond(id, true); bx.remove(); toast('Accepted'); } }, 'Accept'), h('button', { class: 'btn', onclick: async () => { await API.dmRespond(id, false); location.hash = '#/dms'; } }, 'Decline'), h('button', { class: 'btn danger', onclick: async () => { await API.dmRespond(id, false, true); location.hash = '#/dms'; } }, 'Block')));
      document.querySelector('.chatwrap').insertBefore(bx, document.querySelector('.chatlist'));
    }
  }

  /* ---------------------------------------------------------------- points and invites */
  async function points() {
    page('#/points', h('p', { class: 'hint spark' }, 'Loading…'));
    if (!ME) await load();
    const d = await API.points(); ME.points = d.balance;
    const link = location.origin + '/#/join/' + ME.ref_code, text = 'Come play on ADate with me: ' + link;
    const reasons = { share: 'Shared your card', photo: 'Real photo', frame: 'Season frame', tick: 'Visit bonus', profile: 'Profile completed', invite: 'Friend joined', room: 'Joined a room', nick: 'Changed nickname', buy: 'Bought points', tod: 'Truth or Dare' };
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
      return h('div', { class: 'stack' }, h('div', { class: 'h2' }, 'Real photo'), h('p', { class: 'hint' }, ME.has_photo ? 'Your photo is on your profile card until ' + String(ME.photo_until || '').slice(0, 10) + '.' : 'Choose a photo of yourself.'), f, ME.has_photo ? h('button', { class: 'btn sm danger', onclick: async () => { await API.photoSet('', true); me(); } }, 'Remove my photo') : null);
    };
    const frameBox = () => h('div', { class: 'stack' }, h('div', { class: 'h2' }, 'Season frames'), h('p', { class: 'hint' }, 'A frame around your picture. 5 points each, while the season lasts. You keep it.'), ...ME.frame_shop.map((f) => h('div', { class: 'roomcard' }, h('span', { class: 'rc-e' }, f.emoji), h('span', { class: 'rc-t' }, h('b', null, f.name), h('small', null, f.own ? (ME.frame === f.key ? 'Using it' : 'You own it') : f.open ? '⭐ ' + f.price : 'Not on sale now')),
      f.own ? h('button', { class: 'btn sm' + (ME.frame === f.key ? '' : ' pri'), onclick: async () => { await API.meSet({ frame: ME.frame === f.key ? '' : f.key }); me(); } }, ME.frame === f.key ? 'Remove' : 'Use') : f.open ? h('button', { class: 'btn sm', onclick: async () => { if (!confirm(`Buy the ${f.name} frame for ${f.price} points?`)) return; try { await API.frameBuy(f.key); me(); } catch (x) { toast(err(x), 'bad'); } } }, 'Buy') : h('span', { class: 'badge' }, '🔒'))));
    page('#/me', h('div', { class: 'hello' }, avatar(ME.avatar, ME.nick, 56, ME.frame), h('div', null, h('b', null, ME.nick || 'No nickname yet'), h('small', { class: 'hint' }, 'Your public profile'))),
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
    page('#/points', h('p', { class: 'hint spark' }, 'Loading…'));
    if (!ME) await load();
    const d = await API.shop(), msg = h('div');
    const STATUS = { pending: '⏳ waiting for your payment', claimed: '🔎 being checked', paid: '✅ paid', rejected: '❌ not accepted' };
    const money = (c) => '$' + (c / 100).toFixed(2);
    const waiting = d.orders.find((o) => o.status === 'pending');
    const pay = d.settings.whish_link ? h('a', { class: 'btn pri block', target: '_blank', rel: 'noopener', href: d.settings.whish_link }, '💳 Pay with Whish') : h('p', { class: 'hint' }, 'The Whish link is not set yet. Ask the owner on WhatsApp.');
    const note = h('input', { type: 'text', maxlength: 120, placeholder: 'Whish transaction reference', 'aria-label': 'Whish reference' });
    const buy = (p) => async () => { try { await API.orderCreate(p.kind); shopPage(); } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, err(e))); } };
    const pk = (kind) => d.products.find((x) => x.kind === kind) || {};
    page('#/points', h('div', { class: 'h2' }, '🛒 Get more points'), h('div', { class: 'note' }, h('b', null, '5 points = $1 · 25 points = $5'), h('p', { class: 'hint' }, 'Pay with Whish, then tell us your reference. We check it and add the points, usually within a day.')),
      waiting ? h('div', { class: 'stack' }, h('b', null, `Order AD-${waiting.id}: ${pk(waiting.kind).label || ''} · ${money(waiting.cents)}`), h('p', { class: 'hint' }, `Write AD-${waiting.id} in the Whish note when you pay.` + (d.settings.whish_note ? ' ' + d.settings.whish_note : '')), pay, note,
        h('button', { class: 'btn block', onclick: async () => { try { await API.orderPaid(waiting.id, note.value); toast('Thank you. We will check it.'); shopPage(); } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, err(e))); } } }, 'I paid'))
        : h('div', { class: 'stack' }, ...d.products.map((p) => h('button', { class: 'btn pri block', onclick: buy(p) }, `Buy ${p.label} · ${money(p.cents)}`))),
      msg, h('div', { class: 'h2' }, 'My orders'), ...(d.orders.length ? d.orders.map((o) => h('div', { class: 'hist' }, h('span', null, `AD-${o.id} · ${STATUS[o.status] || o.status}`), h('b', null, money(o.cents)))) : [h('p', { class: 'hint' }, 'No orders yet.')]));
  }

  /* ---------------------------------------------------------------- referral landing */
  function join(code) { store.set('adate.ref', String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)); location.hash = API.session ? '#/' : '#/signup'; }

  return function route(hash) {
    if (!API.enabled) return null;
    const s = API.session;
    const ok = !!(s && s.profile_done);
    const wrap = (f) => () => { document.body.style.background = ''; return guard(f); };
    if (hash.startsWith('#/join/')) return () => join(hash.slice(7));
    if (!ok) return null;
    if (hash === '' || hash === '#/' || hash === '#') return wrap(hub);
    if (hash === '#/rooms') return wrap(rooms);
    if (hash.startsWith('#/room/')) return wrap(() => room(hash.slice(7)));
    if (hash === '#/dms') return wrap(dms);
    if (hash.startsWith('#/dm/')) return wrap(() => dm(hash.slice(5)));
    if (hash === '#/points') return wrap(points);
    if (hash === '#/me') return wrap(me);
    if (hash === '#/tod') return wrap(tod);
    if (hash === '#/shop') return wrap(shopPage);
    return null;
  };
};
})();
