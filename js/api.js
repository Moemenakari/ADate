// Client for the backend in /api (Vercel + Neon). If it isn't there (GitHub Pages, local file server)
// the site falls back to "demo mode": the invite lives inside the link.
(function () {
  const CFG = window.ADATE_CONFIG || {};
  const base = (CFG.apiBase || '') + '/api';
  const rnd = (n, al) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (b) => al[b % al.length]).join(''); };
  async function call(action, body) {
    const r = await fetch(`${base}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* not json */ }
    if (!r.ok) throw new Error((j && j.message) || 'Request failed (' + r.status + ')');
    return j;
  }
  async function ping() {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
    try { const r = await fetch(`${base}/ping`, { signal: ctl.signal }); const j = await r.json(); return !!(j && j.ok && j.app === 'adate'); } catch (e) { return false; } finally { clearTimeout(t); }
  }
  const API = {
    enabled: false,
    newId: () => rnd(8, 'abcdefghjkmnpqrstuvwxyz23456789'),
    newToken: () => rnd(28, 'abcdefghjkmnpqrstuvwxyz23456789'),
    create: (id, token, config, consent) => call('create', { id, token, config, consent }),
    update: (id, token, config) => call('update', { id, token, config }),
    open: (id) => call('open', { id }),
    respond: (id, answer, message, phone) => call('respond', { id, answer, message, phone }),
    status: (id, token) => call('status', { id, token }),
    remove: (id, token) => call('remove', { id, token }),
    admin: (key) => call('admin', { key })
  };
  API.ready = ping().then((ok) => { API.enabled = ok; return ok; });
  window.API = API;
})();
