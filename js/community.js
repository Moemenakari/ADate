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
  function avatar(av, nick, size, frame, photo) {
    const sz = size || 40, box = h('span', { class: 'avatar' + (frame ? ' framed' : ''), style: `width:${sz}px;height:${sz}px` + (FRAME_LOOK[frame] ? `;--ring:${FRAME_LOOK[frame][0]}` : '') });
    const k = String(av || '').replace(/^cartoon:/, ''), an = /^animal:/.test(av || '') ? (window.ANIMALS || []).find((x) => 'animal:' + x[0] === av) : null;
    if (photo && /^data:image\//.test(photo)) box.append(h('img', { src: photo, alt: '' })); else if (an) { box.classList.add('animal'); box.textContent = an[1]; box.style.fontSize = Math.round(sz * 0.6) + 'px'; } else if (av && STICKERS[k]) box.innerHTML = STICKERS[k].svg; else box.textContent = (nick || '?').trim().slice(0, 1).toUpperCase();
    if (FRAME_LOOK[frame]) box.append(h('i', { class: 'fr' }, FRAME_LOOK[frame][1]));
    return box;
  }
  const bar = (active, points) => h('nav', { class: 'tabbar' }, [['#/', '🏠', 'Home'], ['#/match', '💜', 'Match'], ['#/rooms', '👥', 'Groups'], ['#/dms', '💬', 'Chats'], ['#/me', '👤', 'Me']].map(([href, e, l]) => h('a', { href, class: active === href ? 'on' : '' }, h('span', null, e), h('small', null, l))));
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
    const chips = h('div', { class: 'row' }, [['all', 'All'], ['foryou', 'For you'], ['mine', 'Joined'], ['region', '📍 Places'], ['interest', 'Interests'], ['season', '🎃 Seasonal']].map(([id, l]) => h('button', { class: 'chip', 'aria-pressed': id === filter ? 'true' : 'false', onclick: (e) => { filter = id; chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === e.currentTarget ? 'true' : 'false')); draw(); } }, l)));
    page('#/rooms', h('div', { class: 'h2' }, 'Groups'), h('p', { class: 'hint' }, 'Text only, like a WhatsApp group. Search by place: city or country. Places are free; some interest groups cost 10 to 25 points.'), search, chips, list); draw();
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


  /* ---------------------------------------------------------------- random match (text only) */
  const MEET = [['m', '👦', 'Guys'], ['both', '👥', 'Both'], ['f', '👧', 'Girls']], IAM = [['m', '👦', 'I am a guy'], ['f', '👧', 'I am a girl']];
  const seg = (on) => h('div', { class: 'seg' }, [['#/match', 'Swipe', 'swipe'], ['#/match/near', 'Near you', 'near'], ['#/match/random', 'Random', 'random']].map(([href, l, k]) => h('a', { href, class: on === k ? 'on' : '' }, l)));
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
      const send = async () => { try { const r = await API.discoverAct(c.id, 'invite', msg.value.trim()); toast(r.state === 'friends' ? '🎉 It is a match! Open Chats' : r.state === 'waiting' ? 'Wait until they answer' : 'Invite sent 💜'); next(); } catch (e) { toast(err(e), 'bad'); } };
      msg.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } };
      box.replaceChildren(h('div', { class: 'swcard', style: 'background:' + gradOf(c.id) }, more, face,
        h('div', { class: 'sw-info' }, h('div', { class: 'sw-name' }, h('b', null, c.nick), h('span', null, c.age_band), h('span', null, FLAG[c.country] || '')), h('div', { class: 'row' }, (c.shared.length ? c.shared : c.interests).slice(0, 5).map((x) => h('span', { class: 'sw-tag' }, (c.shared.includes(x) ? '✨ ' : '') + x))), c.langs && c.langs.length ? h('small', null, '🗣 ' + c.langs.join(' · ')) : null)),
        h('div', { class: 'sw-actions' }, h('button', { class: 'sw-skip', 'aria-label': 'Skip', onclick: async () => { try { await API.discoverAct(c.id, 'skip'); } catch (e) { /* ignore */ } next(); } }, '✕'), msg, h('button', { class: 'sw-send', 'aria-label': 'Send invite', onclick: send }, '🚀')));
    }
    async function next() { try { const d = await API.discoverNext(); show(d.card); } catch (e) { if (/who you are/i.test(err(e))) return prefsView(); toast(err(e), 'bad'); } }
    next();
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
  async function match() {
    if (!ME) await load();
    let stop = false, shown = '', lastId = 0, cur = null, prefs = { gender: '', meet: 'both' };
    const box = h('div', { class: 'matchbox stack' });
    const shell = () => $app.replaceChildren(h('div', { class: 'wrap cm' }, h('div', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, '🐱 A', h('b', null, 'Date')), h('a', { class: 'pill', href: '#/points' }, '⭐ ' + (ME ? ME.points : '…'))), seg('random'), box), bar('#/match', ME && ME.points));
    const peerHead = (p) => h('div', { class: 'peer' }, avatar(p.avatar, p.nick, 52, p.frame), h('div', null, h('b', null, p.nick + ' ' + (FLAG[p.country] || '')), h('small', { class: 'hint' }, 'Age ' + p.age_band + (p.langs && p.langs.length ? ' · ' + p.langs.join(', ') : '')), p.shared.length ? h('div', { class: 'row' }, p.shared.slice(0, 4).map((x) => h('span', { class: 'badge' }, x))) : null));
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
      const bubble = (x) => x.kind === 'game' ? h('div', { class: 'gamebub' }, h('small', null, '🎲 Round ' + (++gameN) + ' of ' + m.rounds), h('b', null, x.body)) : h('div', { class: 'cmsg' + (x.mine ? ' mine' : '') }, h('div', { class: 'bub' }, x.body));
      const draw = (st) => {
        cur = st; ctl.replaceChildren();
        if (st.state !== 'chat') return;
        if (st.round >= 1 && !st.voted) ctl.append(h('div', { class: 'votebar' }, h('span', null, 'Do you want to be friends? (' + st.round + '/' + st.rounds + ')'), h('button', { class: 'btn pri', onclick: () => vote(true) }, '✅ Yes'), h('button', { class: 'btn', onclick: () => vote(false) }, '❌ No')));
        else if (st.round >= 1 && st.voted && !st.their_voted) ctl.append(h('p', { class: 'hint' }, 'Waiting for their answer…'));
        if (st.round < st.rounds && (st.round === 0 || (st.voted && st.their_voted))) { const start = (type) => async () => { try { await API.matchGame(m.id, type); poll(); } catch (e) { toast(err(e), 'bad'); } }; ctl.append(h('div', { class: 'gamepick' }, h('b', null, st.round === 0 ? 'Pick a game' : 'Next game'), h('div', { class: 'row' }, h('button', { class: 'btn', onclick: start('tod') }, '🎲 Question'), h('button', { class: 'btn', onclick: start('xo') }, '❌⭕ XO'), h('button', { class: 'btn', onclick: start('draw') }, '🎨 Draw')))); }
        drawGame(st);
      };
      let panel = null, panelKey = '';
      function drawGame(st) {
        const g = st.game; if (!g || g.type === 'tod' || st.state !== 'chat') { if (panel) { panel.remove(); panel = null; panelKey = ''; } return; }
        const key = JSON.stringify(g); if (key === panelKey && panel) return; panelKey = key;
        if (panel && panel.update && g.type === 'draw' && !g.i_draw && !g.solved) { panel.update(g); return; }
        const keepDrawer = panel && panel.dataset.keep && g.type === 'draw' && g.i_draw && !g.solved; if (keepDrawer) { panel.redraw && panel.redraw(g); return; }
        const el = g.type === 'xo' ? xoPanel(g) : drawPanel(g); if (panel) panel.replaceWith(el); else ctl.before(el); panel = el;
      }
      function xoPanel(g) {
        const cells = g.board.map((c, i) => h('button', { class: 'xocell' + (g.line && g.line.includes(i) ? ' win' : ''), disabled: !!c || !g.my_turn || g.winner, onclick: async () => { try { const r = await API.matchMove(m.id, i); draw(r.match); } catch (e) { toast(err(e), 'bad'); } } }, c === 'X' ? '❌' : c === 'O' ? '⭕' : ''));
        const status = g.winner === 'me' ? '🎉 You won!' : g.winner === 'them' ? '😅 They won' : g.winner === 'draw' ? '🤝 Draw' : g.my_turn ? 'Your turn (you are ' + (g.mark === 'X' ? '❌' : '⭕') + ')' : 'Their turn…';
        return h('div', { class: 'gamepanel' }, h('b', null, status), h('div', { class: 'xogrid' }, cells));
      }
      function drawPanel(g) {
        const cv = h('canvas', { class: 'drawcv', width: 600, height: 600 }), ctx2 = cv.getContext('2d'); let color = '#ffffff', width = 8, cur = null, local = g.strokes.slice();
        const paint = () => { ctx2.fillStyle = '#1b1b2a'; ctx2.fillRect(0, 0, 600, 600); local.concat(cur ? [cur] : []).forEach((k) => { ctx2.strokeStyle = k.c; ctx2.lineWidth = k.w * 0.6; ctx2.lineCap = ctx2.lineJoin = 'round'; ctx2.beginPath(); k.p.forEach(([x, y], i) => { const px = x * 0.6, py = y * 0.6; if (i) ctx2.lineTo(px, py); else ctx2.moveTo(px, py); }); if (k.p.length === 1) ctx2.lineTo(k.p[0][0] * 0.6 + 0.1, k.p[0][1] * 0.6); ctx2.stroke(); }); };
        paint();
        const title = g.solved ? '🎉 Guessed! It was: ' + g.word : g.i_draw ? 'Draw: ' + g.word : 'Guess the word (' + g.letters + ' letters)';
        const wrap = h('div', { class: 'gamepanel', 'data-keep': g.i_draw && !g.solved ? '1' : '' }, h('b', null, title), cv);
        if (g.i_draw && !g.solved) {
          const pos = (e) => { const r = cv.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return [Math.max(0, Math.min(1000, Math.round((t.clientX - r.left) / r.width * 1000))), Math.max(0, Math.min(1000, Math.round((t.clientY - r.top) / r.height * 1000)))]; };
          const down = (e) => { e.preventDefault(); cur = { c: color, w: width, p: [pos(e)] }; paint(); }, move = (e) => { if (!cur) return; e.preventDefault(); const q = pos(e), l = cur.p[cur.p.length - 1]; if (Math.abs(q[0] - l[0]) + Math.abs(q[1] - l[1]) > 6 && cur.p.length < 400) { cur.p.push(q); paint(); } }, up = async () => { if (!cur) return; const k = cur; cur = null; local.push(k); paint(); try { await API.matchDraw(m.id, k); } catch (e) { toast(err(e), 'bad'); } };
          cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: false }); cv.style.touchAction = 'none';
          const colors = ['#ffffff', '#ff4d6a', '#ffd60a', '#27d3a2', '#4da3ff', '#a78bff'];
          wrap.append(h('div', { class: 'row drawtools' }, ...colors.map((c) => h('button', { class: 'dot', style: 'background:' + c, 'aria-label': 'Colour ' + c, onclick: () => { color = c; } })), h('button', { class: 'btn sm', onclick: () => { width = width === 8 ? 18 : 8; } }, 'Thick / thin'), h('button', { class: 'btn sm', onclick: async () => { local = []; paint(); try { await API.matchDraw(m.id, null, true); } catch (e) { toast(err(e), 'bad'); } } }, 'Clear')));
          wrap.redraw = () => {};
        } else if (!g.solved) {
          const gi = h('input', { type: 'text', maxlength: 40, placeholder: 'Your guess', 'aria-label': 'Your guess', enterkeyhint: 'send' });
          const guess = async () => { const t = gi.value.trim(); if (!t) return; gi.value = ''; try { const r = await API.matchGuess(m.id, t); if (r.correct) toast('🎉 Correct!'); poll(); } catch (e) { toast(err(e), 'bad'); } };
          gi.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); guess(); } };
          wrap.append(h('div', { class: 'row' }, gi, h('button', { class: 'btn pri sm', onclick: guess }, 'Guess')));
          wrap.update = (g2) => { local = g2.strokes.slice(); paint(); };
        }
        return wrap;
      }
      async function vote(y) { try { const r = await API.matchVote(m.id, y); draw(r.match); poll(); } catch (e) { toast(err(e), 'bad'); } }
      async function poll() { try { const r = await API.matchMsgs(m.id, lastId); r.messages.forEach((x) => { lastId = Math.max(lastId, x.id); list.append(bubble(x)); }); if (r.messages.length) list.scrollTop = list.scrollHeight; draw(r.match); if (r.match.state !== 'chat') tick(); } catch (e) { /* next tick */ } }
      async function go() { const body = inp.value.trim(); if (!body) return; try { await API.matchSend(m.id, body); inp.value = ''; msg.replaceChildren(); poll(); } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, err(e))); } }
      inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
      const menu = h('button', { class: 'btn sm', 'aria-label': 'More', onclick: () => { const ch = prompt('Type 1 to report and block this person, 2 to just leave the chat.'); if (ch === '1') API.matchReport(m.id, true).then(() => { shown = ''; tick(); }); else if (ch === '2') API.matchLeave(m.id).then(() => { shown = ''; tick(); }); } }, '⋯');
      box.replaceChildren(h('div', { class: 'chathead' }, peerHead(p), menu), list, msg, ctl, h('div', { class: 'composer' }, inp, h('button', { class: 'btn pri', onclick: go }, 'Send')));
      draw(m); poll(); ui.setPoll(() => { if (document.visibilityState === 'visible') poll(); }, 2500);
    }
    function doneView(d) {
      const friends = d.state === 'friends';
      box.replaceChildren(h('div', { class: 'matchhero' }, h('div', { class: 'bigemoji' }, friends ? '🎉' : '👋'), h('h1', { class: 'wz-h' }, friends ? 'You are friends!' : 'This chat is over'), h('p', { class: 'hint' }, friends ? 'You both said Yes. Your private chat is open.' : 'You did not both say Yes enough times. Try someone new.')),
        friends ? h('a', { class: 'btn pri block', href: '#/dm/' + d.match.thread, onclick: () => API.matchLeave(d.match.id) }, '💬 Open our chat') : null,
        h('button', { class: friends ? 'btn block' : 'btn pri block', onclick: async () => { await API.matchLeave(d.match.id); shown = ''; tick(); } }, '🔍 Find someone new'));
    }
    async function tick() {
      if (stop) return;
      try {
        const d = await API.matchState(); if (shown === 'prefs') return;
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
    const pc = ui.pushControl ? await ui.pushControl() : null;
    const dpw = h('input', { type: 'password', placeholder: 'Your password', 'aria-label': 'Password to delete', autocomplete: 'current-password' }), dtx = h('input', { type: 'text', placeholder: 'Type DELETE', 'aria-label': 'Type DELETE', autocapitalize: 'characters' });
    page('#/me', h('div', { class: 'wz-h', style: 'font-size:1.9rem;margin:6px 0' }, 'Settings'),
      sec('👤', 'My account', row('Phone', acct.phone ? '+' + acct.phone : ''), row('Email', acct.email), row('Birthday', acct.birthdate ? 'Private · ' + ME.age_band : ''), row('Number check', acct.verified ? '✅ Verified' : 'Waiting for the owner'), h('p', { class: 'hint' }, 'Your real name is never shown. Only your nickname.')),
      sec('✏️', 'My profile', link('🪪', 'Nickname, avatar, photo, frame', '#/me', 'Change how people see you')),
      sec('💜', 'Matching', h('b', null, 'I am'), pickRow(IAM, 'gender'), h('b', null, 'I want to meet'), pickRow(MEET, 'meet'), h('b', null, 'Languages'), langBox,
        h('button', { class: 'btn pri block', onclick: async () => { if (!pr.gender) return toast('Pick who you are', 'bad'); try { await API.matchPrefs({ gender: pr.gender, meet: pr.meet, langs: [...pr.langs] }); toast('Saved ✓'); } catch (e) { toast(err(e), 'bad'); } } }, 'Save')),
      sec('🔔', 'Notifications', pc || h('p', { class: 'hint' }, 'Not available on this phone.')),
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
    const reasons = { share: 'Shared your card', photo: 'Real photo', frame: 'Season frame', tick: 'Visit bonus', profile: 'Profile completed', invite: 'Friend joined', room: 'Joined a room', nick: 'Changed nickname', buy: 'Bought points', first_buy: 'First purchase bonus', tod: 'Truth or Dare' };
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
    page('#/points', h('p', { class: 'hint spark' }, 'Loading…'));
    if (!ME) await load();
    const d = await API.shop(), msg = h('div');
    const STATUS = { pending: '⏳ waiting for your payment', claimed: '🔎 being checked', paid: '✅ paid', rejected: '❌ not accepted' };
    const money = (c) => '$' + (c / 100).toFixed(2);
    const waiting = d.orders.find((o) => o.status === 'pending');
    const payLink = (kind) => (kind && d.settings['whish_link_' + kind]) || d.settings.whish_link || '';
    const pay = payLink(waiting && waiting.kind) ? h('a', { class: 'btn pri block', target: '_blank', rel: 'noopener', href: payLink(waiting && waiting.kind) }, '💳 Pay with card or Whish') : h('p', { class: 'hint' }, 'The Whish link is not set yet. Ask the owner on WhatsApp.');
    const note = h('input', { type: 'text', maxlength: 120, placeholder: 'Whish transaction reference', 'aria-label': 'Whish reference' });
    const buy = (p) => async () => { try { await API.orderCreate(p.kind); shopPage(); } catch (e) { msg.replaceChildren(h('div', { class: 'note' }, err(e))); } };
    const pk = (kind) => d.products.find((x) => x.kind === kind) || {};
    page('#/points', h('div', { class: 'h2' }, '🛒 Get more points'), h('div', { class: 'note' }, h('b', null, '12 points = $2.60 · 29 points = $5'), d.first_bonus ? h('p', null, '🎁 Your first purchase gives you ' + d.first_bonus + ' extra points for free.') : null, h('p', { class: 'hint' }, 'Pay with Whish, then tell us your reference. We check it and add the points, usually within a day.')),
      waiting ? h('div', { class: 'stack' }, h('b', null, `Order AD-${waiting.id}: ${pk(waiting.kind).label || ''} · ${money(waiting.cents)}`), d.settings.whish_number ? h('p', null, '📲 Send the money on Whish to ', h('b', null, '+' + d.settings.whish_number), '.') : null, h('p', { class: 'hint' }, `Write AD-${waiting.id} in the Whish note when you pay.` + (d.settings.whish_note ? ' ' + d.settings.whish_note : '')), pay, note,
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
    if (hash === '#/match') return wrap(swipe);
    if (hash === '#/match/near') return wrap(near);
    if (hash === '#/match/random') return wrap(match);
    if (hash === '#/rooms') return wrap(rooms);
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
