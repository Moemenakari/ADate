/* The owner dashboard. Opened at #/admin with the owner key: no account is an admin.
   Tabs: Home, Payments, People, Support, More (Prices, Settings, Selfies, Reports). */
(function () {
  let UI, h, $app, ago, API;
  const init = () => { UI = window.ADATE_UI; h = UI.h; $app = UI.$app; ago = UI.ago; API = window.API; };
  const money = (c) => '$' + (c / 100).toFixed(2);
  const wa = (n) => (n ? h('a', { href: 'https://wa.me/' + n, target: '_blank', rel: 'noopener' }, '+' + n) : '—');
  const b64ToBytes = (b64) => { const p = '='.repeat((4 - (b64.length % 4)) % 4), s = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...s].map((c) => c.charCodeAt(0))); };
  let key = '', tab = 'home', ov = null;
  const NAV = [['home', '🏠', 'Home'], ['pay', '💳', 'Payments'], ['people', '👥', 'People'], ['support', '💬', 'Support'], ['more', '⚙️', 'More']];

  function saveKey(k, remember) { try { sessionStorage.setItem('adate.key', k); if (remember) localStorage.setItem('adate.keyR', k); else localStorage.removeItem('adate.keyR'); } catch (e) { /* ok */ } }
  function forgetKey() { try { sessionStorage.removeItem('adate.key'); localStorage.removeItem('adate.keyR'); } catch (e) { /* ok */ } }

  function login(msg) {
    document.title = 'Owner';
    const inp = h('input', { type: 'password', placeholder: 'Owner key', 'aria-label': 'Owner key', autocomplete: 'current-password' }), rem = h('input', { type: 'checkbox', 'aria-label': 'Remember on this phone' }), note = h('div');
    if (msg) note.append(h('div', { class: 'note' }, msg));
    const go = async () => { const k = inp.value.trim(); if (!k) return; try { await API.adminOverview(k); key = k; saveKey(k, rem.checked); shell(); } catch (e) { note.replaceChildren(h('div', { class: 'note' }, e.message === 'Wrong key' ? 'That key is not right.' : e.message)); } };
    inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
    UI.authShell('👑 Owner', h('p', { class: 'hint' }, 'Only you. Enter your owner key.'), inp, h('label', { class: 'row' }, rem, h('span', { class: 'hint' }, 'Remember the key on this phone')), h('button', { class: 'btn pri block', type: 'button', onclick: go }, 'Open'), note);
    setTimeout(() => inp.focus(), 50);
  }

  async function shell() {
    document.title = 'Owner';
    const content = h('div', { class: 'stack ownc' }), nav = h('nav', { class: 'tabbar ownnav' });
    const draw = () => { nav.replaceChildren(...NAV.map(([k, e, l]) => h('a', { href: '#/admin', class: tab === k ? 'on' : '', onclick: (ev) => { ev.preventDefault(); tab = k; draw(); render(); } }, h('span', null, e), h('small', null, l, k === 'pay' && ov && ov.orders_waiting ? ' ' + ov.orders_waiting : '', k === 'support' && ov && ov.support_open ? ' ' + ov.support_open : '')))); };
    const render = async () => { content.replaceChildren(h('p', { class: 'hint spark' }, 'Loading…')); try { await VIEWS[tab](content, render); } catch (e) { if (/Wrong key/.test(e.message)) { forgetKey(); return login('The key stopped working. Enter it again.'); } content.replaceChildren(h('div', { class: 'note' }, e.message)); } };
    $app.replaceChildren(h('div', { class: 'wrap cm' }, h('div', { class: 'topbar' }, h('b', { class: 'ownt' }, '👑 Owner'), h('button', { class: 'btn sm', type: 'button', onclick: () => { forgetKey(); key = ''; login(); } }, 'Log out')), content), nav);
    try { ov = await API.adminOverview(key); } catch (e) { return login(e.message); }
    draw(); render();
  }

  const tile = (label, value, go, warn) => h('button', { class: 'otile' + (warn ? ' warn' : ''), type: 'button', onclick: go || null }, h('b', null, String(value)), h('small', null, label));

  const VIEWS = {
    async home(c, rerender) {
      ov = await API.adminOverview(key);
      const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true, perm = 'Notification' in window ? Notification.permission : 'unsupported';
      const res = h('small', { class: 'hint' }), ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const enable = async () => {
        try {
          if (!API.vapid) throw new Error('Alerts are not set up on the server yet');
          if (await Notification.requestPermission() !== 'granted') throw new Error('Allow notifications first');
          const r = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
          const s = (await r.pushManager.getSubscription()) || await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(API.vapid) });
          const j = s.toJSON(); await API.adminPushSave(key, { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }); res.textContent = '✅ This phone will get your alerts.'; rerender();
        } catch (e) { res.textContent = e.message; }
      };
      c.replaceChildren(
        h('div', { class: 'otiles' }, tile('People', ov.users, () => { tab = 'people'; shell2(); }), tile('New today', ov.today), tile('Online now', ov.online), tile('Active this week', ov.week_active),
          tile('Payments waiting', ov.orders_waiting, () => { tab = 'pay'; shell2(); }, ov.orders_waiting > 0), tile('Selfies waiting', ov.selfies_waiting, () => { tab = 'more'; moreTab = 'selfies'; shell2(); }, ov.selfies_waiting > 0),
          tile('Reports (7 days)', ov.reports_week, () => { tab = 'more'; moreTab = 'reports'; shell2(); }, ov.reports_week > 0), tile('Support waiting', ov.support_open, () => { tab = 'support'; shell2(); }, ov.support_open > 0),
          tile('Money received', money(ov.revenue_cents)), tile('People who paid', ov.paid_people), tile('Stars in the app', ov.points_out), tile('Alert phones', ov.alert_devices)),
        h('div', { class: 'note stack' }, h('b', null, '📲 Alerts on this phone'),
          h('small', { class: 'hint' }, (standalone ? '✅ Installed on the Home Screen. ' : '⚠️ Not installed yet. ' + (ios ? 'Tap Share, then “Add to Home Screen”, then open Owner from the new icon. ' : 'Open the ⋮ menu, then “Install app” or “Add to Home screen”. ')) + (perm === 'granted' ? '✅ Notifications allowed.' : perm === 'denied' ? '❌ Notifications are blocked in your phone settings.' : 'Tap the button below to allow them.')),
          h('button', { class: 'btn pri sm', type: 'button', onclick: enable }, '🔔 Turn on alerts on this phone'),
          h('button', { class: 'btn sm', type: 'button', onclick: async () => { try { const r = await API.adminTestPush(key); res.textContent = r.devices ? 'Sent to ' + r.devices + ' phone(s). Did it arrive?' : 'No phone is registered yet. Turn on alerts first.'; } catch (e) { res.textContent = e.message; } } }, 'Send me a test alert'), res,
          h('small', { class: 'hint' }, 'You get an alert for: a payment waiting, a selfie waiting, every report, a new member, and messages to the team.')));
    },

    async pay(c, rerender) {
      const o = await API.adminOrders(key), note = h('div');
      const decide = async (x, ok) => { if (!confirm(ok ? 'Add the points to ' + (x.name || x.nick) + '? Check Whish first.' : 'Reject this order?')) return; try { await API.adminOrderDecide(key, x.id, ok); rerender(); } catch (e) { note.replaceChildren(h('div', { class: 'note' }, e.message)); } };
      const adjust = async (x) => { const pts = prompt('Add (+) or remove (-) points. Example: 50 or -50', '10'); if (pts === null) return; const msg = prompt('Message for them (optional)', '') || ''; try { const r = await API.adminGift(key, x.user_id, Number(pts) || 0, msg); note.replaceChildren(h('div', { class: 'note' }, 'Done. Balance: ' + r.balance + ' points.')); } catch (e) { note.replaceChildren(h('div', { class: 'note' }, e.message)); } };
      c.replaceChildren(h('div', { class: 'h2' }, '💳 Payments'), h('p', { class: 'hint' }, 'Check 4 things on the receipt: Transaction ID matches, Amount is right, Receiver is your number, time is recent. Then find the same transfer in your own Whish history.'), note,
        ...(o.orders.length ? o.orders.map((x) => h('div', { class: 'inv' }, h('header', null, h('h3', null, 'AD-' + x.id + ' · ' + money(x.cents) + ' · ' + (x.points || '') + ' points'), h('span', { class: 'badge ' + (x.status === 'claimed' ? 'warn' : '') }, x.status === 'claimed' ? '🔎 receipt sent' : '⏳ not paid yet')),
          h('div', { class: 'kv' }, h('div', null, h('b', null, 'Person: '), (x.nick || x.name || '?') + ' · ', wa(x.phone)), h('div', null, h('b', null, 'Transaction ID: '), x.txid || '—'), h('div', { class: 'hint' }, x.claimed_at ? 'Receipt sent ' + ago(x.claimed_at) : 'Ordered ' + ago(x.at))),
          x.receipt ? h('img', { src: x.receipt, alt: 'Receipt', style: 'max-width:100%;max-height:320px;border-radius:12px', onclick: () => { const w = window.open('', '_blank'); if (w) w.document.write('<img src="' + x.receipt + '" style="max-width:100%">'); } }) : null,
          h('div', { class: 'row' }, h('button', { class: 'btn sm pri', onclick: () => decide(x, true) }, '✅ Approve'), h('button', { class: 'btn sm danger', onclick: () => decide(x, false) }, 'Reject'), h('button', { class: 'btn sm', onclick: () => adjust(x) }, '± Points')))) : [h('p', { class: 'hint' }, 'No payments waiting.')]),
        ...(o.done.length ? [h('div', { class: 'h2' }, 'Recent'), ...o.done.map((x) => h('div', { class: 'hist' }, h('span', null, 'AD-' + x.id + ' · ' + (x.nick || x.name || '?') + ' · ' + x.status + (x.txid ? ' · ' + x.txid : '')), h('span', { class: 'row' }, h('b', null, money(x.cents)), h('button', { class: 'btn sm', onclick: () => adjust(x) }, '±'))))] : []));
    },

    async people(c, rerender) {
      let filter = peopleState.filter, q = peopleState.q;
      const list = h('div', { class: 'stack' }), chips = h('div', { class: 'row ochips' }), search = h('input', { type: 'search', placeholder: 'Search name, nickname, number, email', 'aria-label': 'Search people', value: q });
      let rows = [];
      const act = async (p, what) => {
        try {
          if (what === 'points') { const pts = prompt('Add (+) or remove (-) points for ' + (p.nick || p.name) + '. Current: ' + p.points, '10'); if (pts === null) return; const msg = prompt('Message for them (optional)', '') || ''; await API.adminGift(key, p.id, Number(pts) || 0, msg); }
          else if (what === 'block') { if (!confirm((p.blocked ? 'Unblock ' : 'Block ') + (p.nick || p.name) + '?')) return; await API.adminMark(key, p.id, p.blocked ? 'unblock' : 'block'); }
          else if (what === 'verify') { await API.adminMark(key, p.id, p.verified ? 'unverify' : 'verify'); }
          else if (what === 'role') { const r = prompt('Role: agent, host, or none', p.role || 'none'); if (r === null) return; const op = ['agent', 'host', 'none'].includes(r.trim()) ? 'role_' + r.trim() : null; if (!op) return alert('Type agent, host or none'); await API.adminMark(key, p.id, op); }
          else if (what === 'delete') { const t = prompt('Delete ' + (p.nick || p.name) + ' and everything they have for good?\nType DELETE to confirm.'); if (t === null) return; await API.adminUserDelete(key, p.id, t); }
          load();
        } catch (e) { alert(e.message); }
      };
      const social = (p) => ['ig', 'snap', 'tiktok', 'wa'].filter((k) => p.socials[k]).map((k) => ({ ig: '📸', snap: '👻', tiktok: '🎵', wa: '💬' }[k] + ' ' + (k === 'wa' ? '+' : '@') + p.socials[k])).join('  ');
      const card = (p) => h('details', { class: 'inv ocard' }, h('summary', null, h('b', null, (p.nick || p.name || '?') + (p.verified ? ' ✅' : '') + (p.blocked ? ' 🚫' : '')), h('span', { class: 'hint' }, ' · ' + (p.age != null ? p.age + 'y ' : '') + p.country + ' · ⭐' + p.points + (p.paid_orders ? ' · paid ' + money(p.paid_cents) : '') + ' · ' + (p.last_seen ? ago(p.last_seen) : 'never'))),
        h('div', { class: 'kv' }, h('div', null, h('b', null, 'Name: '), p.name || '—'), h('div', null, h('b', null, 'Number: '), wa(p.phone)), h('div', null, h('b', null, 'Email: '), p.email || '—'), h('div', null, h('b', null, 'Social: '), social(p) || '—'),
          h('div', null, h('b', null, 'Groups: '), String(p.groups), h('b', null, '  Chats: '), String(p.chats), h('b', null, '  Paid orders: '), String(p.paid_orders)), h('div', { class: 'hint' }, 'Joined ' + ago(p.joined) + (p.role ? ' · role ' + p.role : ''))),
        h('div', { class: 'row' }, h('button', { class: 'btn sm pri', onclick: () => act(p, 'points') }, '± Points'), h('button', { class: 'btn sm', onclick: () => act(p, 'verify') }, p.verified ? 'Unverify' : '✓ Verify'), h('button', { class: 'btn sm', onclick: () => act(p, 'role') }, 'Role'), h('button', { class: 'btn sm', onclick: () => act(p, 'block') }, p.blocked ? 'Unblock' : 'Block'), h('button', { class: 'btn sm danger', onclick: () => act(p, 'delete') }, 'Delete')));
      const csv = () => { const cols = ['id', 'nick', 'name', 'phone', 'email', 'age', 'country', 'instagram', 'snapchat', 'tiktok', 'whatsapp', 'points', 'groups', 'chats', 'paid_orders', 'paid_usd', 'verified', 'blocked', 'joined', 'last_seen']; const qv = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; const body = rows.map((p) => [p.id, p.nick, p.name, p.phone, p.email, p.age, p.country, p.socials.ig, p.socials.snap, p.socials.tiktok, p.socials.wa, p.points, p.groups, p.chats, p.paid_orders, (p.paid_cents / 100).toFixed(2), p.verified, p.blocked, p.joined, p.last_seen].map(qv).join(',')); const blob = new Blob([[cols.join(',')].concat(body).join('\n')], { type: 'text/csv' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'people.csv'; a.click(); };
      async function load() {
        peopleState.filter = filter; peopleState.q = q;
        chips.replaceChildren(...[['all', 'All'], ['online', 'Online'], ['verified', 'Verified'], ['unverified', 'Not verified'], ['selfie', 'Selfie waiting'], ['paid', 'Paid before'], ['never_paid', 'Never paid'], ['blocked', 'Blocked']].map(([k, l]) => h('button', { class: 'chip' + (k === filter ? ' on' : ''), type: 'button', onclick: () => { filter = k; load(); } }, l)));
        list.replaceChildren(h('p', { class: 'hint spark' }, 'Loading…'));
        try { rows = (await API.adminPeople(key, filter, q)).people; } catch (e) { return list.replaceChildren(h('div', { class: 'note' }, e.message)); }
        list.replaceChildren(h('small', { class: 'hint' }, rows.length + ' people'), ...(rows.length ? rows.map(card) : [h('p', { class: 'hint' }, 'Nobody here.')]));
      }
      let st; search.oninput = () => { clearTimeout(st); st = setTimeout(() => { q = search.value.trim(); load(); }, 350); };
      c.replaceChildren(h('div', { class: 'h2' }, '👥 People'), h('p', { class: 'hint' }, 'Everyone with their details, so you can build communities later. Tap a person to open them.'), search, chips, h('div', { class: 'row' }, h('button', { class: 'btn sm', type: 'button', onclick: csv }, '⬇ Export CSV')), list);
      load();
    },

    async support(c, rerender) {
      const d = await API.adminSupportList(key), box = h('div', { class: 'stack' });
      const open = async (t) => {
        const m = (await API.adminSupportThread(key, t.thread)).messages, inp = h('input', { type: 'text', maxlength: 500, placeholder: 'Reply as ADate Team', 'aria-label': 'Reply' });
        const send = async () => { if (!inp.value.trim()) return; try { await API.adminSupportReply(key, t.thread, inp.value); open(t); } catch (e) { alert(e.message); } };
        inp.onkeydown = (e) => { if (e.key === 'Enter') send(); };
        box.replaceChildren(h('div', { class: 'row' }, h('button', { class: 'btn sm', type: 'button', onclick: rerender }, '← Back'), h('b', null, t.nick), h('span', { class: 'hint' }, wa(t.phone))),
          ...m.map((x) => h('div', { class: 'cmsg' + (x.mine ? ' mine' : '') }, h('div', { class: 'bub' }, x.body), h('small', null, ago(x.at)))), h('div', { class: 'composer' }, inp, h('button', { class: 'btn pri', type: 'button', onclick: send }, 'Send')));
      };
      box.replaceChildren(h('div', { class: 'h2' }, '💬 Support'), h('p', { class: 'hint' }, 'People who wrote to the ADate Team (for example when they cannot pay with Whish).'),
        ...(d.threads.length ? d.threads.map((t) => h('button', { class: 'roomcard rowbtn', type: 'button', onclick: () => open(t) }, h('span', { class: 'rc-e' }, t.waiting ? '🔴' : '✅'), h('span', { class: 'rc-t' }, h('b', null, t.nick), h('small', null, t.last_body.slice(0, 60) + ' · ' + (t.last_at ? ago(t.last_at) : ''))))) : [h('p', { class: 'hint' }, 'Nobody wrote yet.')]));
      c.replaceChildren(box);
    },

    async more(c, rerender) {
      const sub = h('div', { class: 'stack' }), menu = h('div', { class: 'row ochips' });
      const draw = () => { menu.replaceChildren(...[['prices', '⭐ Prices'], ['settings', '🔧 Numbers'], ['selfies', '🤳 Selfies'], ['reports', '🚩 Reports']].map(([k, l]) => h('button', { class: 'chip' + (k === moreTab ? ' on' : ''), type: 'button', onclick: () => { moreTab = k; draw(); MORE[k](sub); } }, l))); };
      c.replaceChildren(h('div', { class: 'h2' }, '⚙️ More'), menu, sub, h('a', { class: 'btn block', href: '#/admin-old' }, 'Old dashboard (invites, questions, hosts)'));
      draw(); MORE[moreTab](sub);
    }
  };
  let moreTab = 'prices'; const peopleState = { filter: 'all', q: '' };
  const shell2 = () => shell();

  const MORE = {
    async prices(sub) {
      const d = await API.adminPrices(key), groups = {}; d.prices.forEach((p) => (groups[p.group] = groups[p.group] || []).push(p));
      sub.replaceChildren(h('p', { class: 'hint' }, 'Change any number here. It applies at once, no code. Prices of packs are in US cents (260 = $2.60).'),
        ...Object.entries(groups).map(([g, items]) => h('div', { class: 'stack' }, h('div', { class: 'h2' }, g), ...items.map((p) => { const inp = h('input', { type: 'number', min: 0, value: p.value, inputmode: 'numeric', 'aria-label': p.label }), msg = h('small', { class: 'hint' }, p.value !== p.default ? 'default ' + p.default : ''); return h('div', { class: 'stack' }, h('b', null, p.label), h('div', { class: 'row' }, inp, h('button', { class: 'btn sm pri', type: 'button', onclick: async () => { try { await API.adminPriceSet(key, p.key, inp.value); msg.textContent = '✅ Saved'; } catch (e) { msg.textContent = e.message; } } }, 'Save'), msg)); }))));
    },
    async settings(sub) {
      const s = await API.adminSettings(key);
      const f = (label, name, ph) => { const inp = h('input', { type: 'text', value: s[name] || '', placeholder: ph, 'aria-label': label }), msg = h('small', { class: 'hint' }); return h('div', { class: 'stack' }, h('b', null, label), h('div', { class: 'row' }, inp, h('button', { class: 'btn sm pri', type: 'button', onclick: async () => { try { await API.adminSet(key, name, inp.value); msg.textContent = '✅ Saved'; } catch (e) { msg.textContent = e.message; } } }, 'Save'), msg)); };
      sub.replaceChildren(f('Your Whish number (digits, with country code)', 'whish_number', '9617…'), f('Note shown to people who pay (optional)', 'whish_note', 'Send exactly the amount, then add the receipt.'), f('Your WhatsApp number for verification', 'owner_whatsapp', '9617…'));
    },
    async selfies(sub) {
      const d = await API.adminSelfies(key);
      const decide = async (x, ok) => { try { await API.adminSelfieDecide(key, x.id, ok); MORE.selfies(sub); } catch (e) { alert(e.message); } };
      sub.replaceChildren(h('p', { class: 'hint' }, 'The person must hold up the number of fingers shown as the code. Accept only if it matches.'), ...(d.selfies.length ? d.selfies.map((x) => h('div', { class: 'inv' }, h('header', null, h('h3', null, x.nick || x.name || '?'), h('span', { class: 'badge' }, 'code ' + x.code)), h('img', { src: x.data, alt: 'Selfie', style: 'max-width:100%;max-height:340px;border-radius:12px' }), h('div', { class: 'row' }, h('button', { class: 'btn sm pri', onclick: () => decide(x, true) }, '✅ Accept'), h('button', { class: 'btn sm danger', onclick: () => decide(x, false) }, 'Reject')))) : [h('p', { class: 'hint' }, 'No selfies waiting.')]));
    },
    async reports(sub) {
      const d = await API.adminReports(key), t = d.targets || [];
      const act = async (u, op) => { try { if (op === 'block') { if (!confirm('Block this account?')) return; await API.adminMark(key, u.id, 'block'); } else await API.adminMod(key, u.id, op); MORE.reports(sub); } catch (e) { alert(e.message); } };
      sub.replaceChildren(h('p', { class: 'hint' }, 'Three different people reporting the same member in 24 hours mutes them for 24 hours.'), ...(t.length ? t.map((u) => h('div', { class: 'inv' }, h('header', null, h('h3', null, '🚩 ' + (u.nick || u.name || 'Member')), h('span', { class: 'badge' }, u.today + ' in 24h')), h('div', { class: 'kv' }, h('div', null, h('b', null, 'Number: '), wa(u.phone)), ...(u.bodies || []).map((x) => h('div', { class: 'bubble' }, x))),
        h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => act(u, 'unmute') }, 'Unmute'), h('button', { class: 'btn sm', onclick: () => act(u, 'dismiss') }, 'Dismiss'), h('button', { class: 'btn sm danger', onclick: () => act(u, 'block') }, 'Block')))) : [h('p', { class: 'hint' }, 'No reports.')]));
    }
  };

  window.OwnerDash = {
    open() {
      init();
      try { key = sessionStorage.getItem('adate.key') || localStorage.getItem('adate.keyR') || ''; } catch (e) { key = ''; }
      if (!key) return login();
      API.adminOverview(key).then(() => shell()).catch(() => { forgetKey(); key = ''; login('Enter your owner key.'); });
    }
  };
})();
