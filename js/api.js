// Client for the backend in /api (Vercel + Neon). If it isn't there (GitHub Pages, local file server)
// the site falls back to "demo mode": the invite lives inside the link.
(function () {
  const CFG = window.ADATE_CONFIG || {};
  const base = (CFG.apiBase || '') + '/api';
  const rnd = (n, al) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (b) => al[b % al.length]).join(''); };
  async function call(action, body, keep) { // keep: lets the request finish even if the browser jumps to WhatsApp
    const r = await fetch(`${base}/${action}`, { method: 'POST', keepalive: !!keep, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* not json */ }
    if (!r.ok) { if (r.status === 402) { try { window.dispatchEvent(new CustomEvent('adate:needpoints', { detail: (j && j.message) || '' })); } catch (e) { /* ok */ } } throw new Error((j && j.message) || 'Request failed (' + r.status + ')'); }
    return j;
  }
  async function ping() {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
    try { const r = await fetch(`${base}/ping`, { signal: ctl.signal }); const j = await r.json(); if (j && j.questions) API.questions = j.questions; if (j && j.vapid) API.vapid = j.vapid; if (j && j.google) API.google = j.google; if (j && j.q2) API.q2 = j.q2; return !!(j && j.ok && j.app === 'adate'); } catch (e) { return false; } finally { clearTimeout(t); }
  }
  const visitor = () => { try { let v = localStorage.getItem('adate.visitor'); if (!v) { v = rnd(12, 'abcdefghjkmnpqrstuvwxyz23456789'); localStorage.setItem('adate.visitor', v); } return v; } catch (e) { return 'anon'; } };
  const KEY = 'adate.session';
  // The login is kept in two places (storage and a long cookie) so it survives the browser cleaning one of them.
  const COOKIE = 'adate_s';
  const getCookie = () => { try { const m = document.cookie.split('; ').find((c) => c.startsWith(COOKIE + '=')); return m ? JSON.parse(decodeURIComponent(m.slice(COOKIE.length + 1))) : null; } catch (e) { return null; } };
  const setCookie = (v) => { try { document.cookie = COOKIE + '=' + (v ? encodeURIComponent(JSON.stringify(v)) : '') + '; Max-Age=' + (v ? 34560000 : 0) + '; Path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); } catch (e) { /* cookies blocked */ } };
  const read = () => { let v = null; try { v = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* storage blocked */ } if (!v) { v = getCookie(); if (v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* ok */ } } } return v; };
  const write = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ } setCookie(v); };
  try { const v0 = read(); if (v0) setCookie(v0); if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* optional */ }
  const tok = () => (read() || {}).token;
  const stash = (u, token) => write({ token: token || tok(), phone: u.phone || '', name: u.name || '', profile_done: !!u.profile_done, google: !!u.google });
  const keep = (r) => { stash(r.user, r.session); return r; };
  const API = {
    enabled: false,
    questions: [],
    vapid: null,
    google: null,
    q2: 'Which phone do you use now? (brand and model)',
    get session() { return read(); },
    clear: () => write(null),
    newId: () => rnd(8, 'abcdefghjkmnpqrstuvwxyz23456789'),
    newToken: () => rnd(28, 'abcdefghjkmnpqrstuvwxyz23456789'),
    todState: () => call('tod_state', { session: tok() }),
    todUnlock: (level) => call('tod_unlock', { session: tok(), level }),
    todNext: (level, kind, seen) => call('tod_next', { session: tok(), level, kind, seen }),
    adminTod: (key, o) => call('admin_tod', Object.assign({ key }, o || {})),
    shop: () => call('shop', { session: tok() }),
    orderCreate: (kind) => call('order_create', { session: tok(), kind }),
    orderPaid: (id, note) => call('order_paid', { session: tok(), id, note }),
    adminOrders: (key) => call('admin_orders', { key }),
    adminOrderDecide: (key, id, approve) => call('admin_order_decide', { key, id, approve }),
    photoBuy: () => call('photo_buy', { session: tok() }),
    photoSet: (data, remove) => call('photo_set', { session: tok(), data, remove: !!remove }),
    frameBuy: (key) => call('frame_buy', { session: tok(), key }),
    shareClaim: () => call('share_claim', { session: tok() }),
    hub: () => call('hub', { session: tok() }),
    rooms: () => call('rooms', { session: tok() }),
    roomJoin: (room_id) => call('room_join', { session: tok(), room_id }),
    roomLeave: (room_id) => call('room_leave', { session: tok(), room_id }),
    msgList: (room_id, after) => call('msg_list', { session: tok(), room_id, after }),
    msgSend: (room_id, body) => call('msg_send', { session: tok(), room_id, body }),
    report: (message_id, kind) => call('report', { session: tok(), message_id, kind }),
    userBlock: (user_id, off) => call('user_block', { session: tok(), user_id, off: !!off }),
    profileView: (user_id) => call('profile_view', { session: tok(), user_id }),
    nickSet: (country, nick) => call('nick_set', { session: tok(), country, nick }),
    meSet: (o) => call('me_set', Object.assign({ session: tok() }, o)),
    points: () => call('points', { session: tok() }),
    pointsClaim: () => call('points_claim', { session: tok() }),
    refJoin: (code) => call('ref_join', { session: tok(), code }),
    dmList: () => call('dm_list', { session: tok() }),
    dmStart: (to, body) => call('dm_start', { session: tok(), to, body }),
    dmOpen: (thread, after) => call('dm_open', { session: tok(), thread, after }),
    dmSend: (thread, body) => call('dm_send', { session: tok(), thread, body }),
    dmRespond: (thread, accept, block) => call('dm_respond', { session: tok(), thread, accept: !!accept, block: !!block }),
    adminReports: (key) => call('admin_reports', { key }),
    adminMod: (key, user_id, op) => call('admin_mod', { key, user_id, op }),
    signup: (b) => call('signup', b).then(keep),
    login: (phone, password) => call('login', { phone, password }).then(keep),
    recoverEmailStart: (email) => call('recover_email_start', { email }),
    recoverEmail: (b) => call('recover_email', b).then(keep),
    publicSettings: () => call('public_settings', {}),
    adminSettings: (key) => call('admin_settings', { key }),
    adminSet: (key, name, value) => call('admin_set', { key, name, value }),
    recoverQuestion: (phone) => call('recover_question', { phone }),
    recover: (phone, answer, password) => call('recover', { phone, answer, password }).then(keep),
    logout: () => call('logout', { session: tok() }).catch(() => {}).then(() => write(null)),
    me: () => call('me', { session: tok() }).then((r) => { if (r && r.user) stash(r.user); return r; }),
    googleLogin: (credential) => call('google', { credential }).then(keep),
    profileSet: (p) => call('profile_set', Object.assign({ session: tok() }, p)).then((r) => { stash(r.user); return r; }),
    linkLegacy: (phone, password) => call('link_legacy', { session: tok(), phone, password }).then((r) => { stash(r.user); return r; }),
    inbox: (id) => call('inbox', { id, session: tok() }),
    create: (id, token, config, consent) => call('create', { id, token, config, consent, session: tok() }),
    update: (id, token, config) => call('update', { id, token, config, session: tok() }),
    open: (id) => call('open', { id, visitor: visitor() }),
    pushSubscribe: (sub) => call('push_subscribe', { session: tok(), sub }),
    pushUnsubscribe: (endpoint) => call('push_unsubscribe', { session: tok(), endpoint }),
    track: (id, kind, data) => call('track', { id, kind, data, visitor: visitor() }, true).catch(() => {}),
    respond: (id, answer, message, phone, ig) => call('respond', { id, answer, message, phone, ig }, true),
    status: (id, token) => call('status', { id, token }),
    remove: (id, token) => call('remove', { id, token, session: tok() }),
    admin: (key) => call('admin', { key }),
    adminReset: (key, phone) => call('admin_reset', { key, phone }),
    adminInvite: (key, id) => call('admin_invite', { key, id }),
    matchPrefs: (o) => call('match_prefs', Object.assign({ session: tok() }, o)),
    matchJoin: () => call('match_join', { session: tok() }),
    matchState: () => call('match_state', { session: tok() }),
    matchLeave: (match) => call('match_leave', { session: tok(), match }),
    matchMsgs: (match, after) => call('match_msgs', { session: tok(), match, after }),
    matchSend: (match, body) => call('match_send', { session: tok(), match, body }),
    matchGame: (match, type) => call('match_game', { session: tok(), match, type }),
    matchMove: (match, cell) => call('match_move', { session: tok(), match, cell }),
    matchDraw: (match, stroke, clear) => call('match_draw', { session: tok(), match, stroke, clear: !!clear }),
    fgameState: (thread) => call('fgame_state', { session: tok(), thread }),
    fgameInvite: (thread, type, level) => call('fgame_invite', { session: tok(), thread, type, level }),
    fgameAccept: (thread) => call('fgame_accept', { session: tok(), thread }),
    fgameClose: (thread, decline) => call(decline ? 'fgame_decline' : 'fgame_close', { session: tok(), thread }),
    fgameAct: (thread, o) => call('fgame_act', Object.assign({ session: tok(), thread }, o || {})),
    dmUnlock: (thread) => call('dm_unlock', { session: tok(), thread }),
    dmPayOpen: (thread) => call('dm_pay_open', { session: tok(), thread }),
    matchStateOf: (match) => call('match_state', { session: tok(), match }),
    inviteGame: (to) => call('invite_game', { session: tok(), to }),
    inviteList: () => call('invite_list', { session: tok() }),
    inviteRespond: (match, accept) => call('invite_respond', { session: tok(), match, accept: !!accept }),
    onlineList: () => call('online_list', { session: tok() }),
    matchPick: (match, pick) => call('match_pick', { session: tok(), match, pick }),
    matchGuess: (match, guess) => call('match_guess', { session: tok(), match, guess }),
    matchVote: (match, yes) => call('match_vote', { session: tok(), match, yes }),
    matchReport: (match, block) => call('match_report', { session: tok(), match, block }),
    discoverNext: () => call('discover_next', { session: tok() }),
    discoverAct: (to, act, body) => call('discover_act', { session: tok(), to, act, body }),
    discoverReport: (to) => call('discover_report', { session: tok(), to }),
    discoverNear: () => call('discover_near', { session: tok() }),
    blocksList: () => call('blocks_list', { session: tok() }),
    deleteAccount: (password, confirm) => call('account_delete', { session: tok(), password, confirm }).then(() => write(null)),
    orderCancel: (id) => call('order_cancel', { session: tok(), id }),
    socialGet: () => call('social_get', { session: tok() }),
    socialSet: (o) => call('social_set', Object.assign({ session: tok() }, o)),
    socialView: (user_id, key) => call('social_view', { session: tok(), user_id, key }),
    viewsList: () => call('views_list', { session: tok() }),
    boxState: () => call('box_state', { session: tok() }),
    boxOpen: () => call('box_open', { session: tok() }),
    adminHosts: (key) => call('admin_hosts', { key }),
    selfieState: () => call('selfie_state', { session: tok() }),
    selfieSubmit: (data) => call('selfie_submit', { session: tok(), data }),
    adminSelfies: (key) => call('admin_selfies', { key }),
    adminSelfieDecide: (key, user_id, approve) => call('admin_selfie_decide', { key, user_id, approve }),
    supportOpen: () => call('support_open', { session: tok() }),
    notices: () => call('notices_list', { session: tok() }),
    noticeRead: (id) => call('notice_read', { session: tok(), id }),
    adminGift: (key, user_id, points, message) => call('admin_gift', { key, user_id, points, message }),
    viewsFeed: () => call('views_feed', { session: tok() }),
    viewReveal: (viewer) => call('view_reveal', { session: tok(), viewer }),
    birthdaySet: (birthdate) => call('birthday_set', { session: tok(), birthdate }),
    muteGet: (kind, id) => call('mute_get', { session: tok(), kind, id }),
    muteSet: (kind, id, on) => call('mute_set', { session: tok(), kind, id, on }),
    nudgeSet: (off) => call('nudge_set', { session: tok(), off }),
    installClaim: () => call('install_claim', { session: tok() }),
    payCard: (id) => call('pay_card', { session: tok(), id }),
    adminMark: (key, id, op, note) => call('admin_mark', { key, id, op, note })
  };
  API.ready = ping().then((ok) => { API.enabled = ok; return ok; });
  window.API = API;
})();
