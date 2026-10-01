// Client for the backend in /api (Vercel + Neon). If it isn't there (GitHub Pages, local file server)
// the site falls back to "demo mode": the invite lives inside the link.
(function () {
  const CFG = window.ADATE_CONFIG || {};
  const base = (CFG.apiBase || '') + '/api';
  const rnd = (n, al) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (b) => al[b % al.length]).join(''); };
  async function call(action, body, keep) { // keep: lets the request finish even if the browser jumps to WhatsApp
    const r = await fetch(`${base}/${action}`, { method: 'POST', keepalive: !!keep, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* not json */ }
    if (!r.ok) throw new Error((j && j.message) || 'Request failed (' + r.status + ')');
    return j;
  }
  async function ping() {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
    try { const r = await fetch(`${base}/ping`, { signal: ctl.signal }); const j = await r.json(); if (j && j.questions) API.questions = j.questions; if (j && j.vapid) API.vapid = j.vapid; if (j && j.google) API.google = j.google; return !!(j && j.ok && j.app === 'adate'); } catch (e) { return false; } finally { clearTimeout(t); }
  }
  const visitor = () => { try { let v = localStorage.getItem('adate.visitor'); if (!v) { v = rnd(12, 'abcdefghjkmnpqrstuvwxyz23456789'); localStorage.setItem('adate.visitor', v); } return v; } catch (e) { return 'anon'; } };
  const KEY = 'adate.session';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const write = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ } };
  const tok = () => (read() || {}).token;
  const stash = (u, token) => write({ token: token || tok(), phone: u.phone || '', name: u.name || '', profile_done: !!u.profile_done, google: !!u.google });
  const keep = (r) => { stash(r.user, r.session); return r; };
  const API = {
    enabled: false,
    questions: [],
    vapid: null,
    google: null,
    get session() { return read(); },
    clear: () => write(null),
    newId: () => rnd(8, 'abcdefghjkmnpqrstuvwxyz23456789'),
    newToken: () => rnd(28, 'abcdefghjkmnpqrstuvwxyz23456789'),
    signup: (b) => call('signup', b).then(keep),
    login: (phone, password) => call('login', { phone, password }).then(keep),
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
    adminInvite: (key, id) => call('admin_invite', { key, id })
  };
  API.ready = ping().then((ok) => { API.enabled = ok; return ok; });
  window.API = API;
})();
