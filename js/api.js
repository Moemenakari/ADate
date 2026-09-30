// Tiny client for the optional Supabase backend (see supabase/schema.sql).
// Without it the site still works: the invite lives inside the link and the answer is sent by WhatsApp/share.
(function () {
  const CFG = window.ADATE_CONFIG || {};
  const enabled = !!(CFG.supabaseUrl && CFG.supabaseKey);
  const rnd = (n, al) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (b) => al[b % al.length]).join(''); };
  async function rpc(fn, args) {
    const r = await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/adate_${fn}`, {
      method: 'POST', headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify(args)
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Request failed (' + r.status + ')');
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }
  window.API = {
    enabled,
    newId: () => rnd(8, 'abcdefghjkmnpqrstuvwxyz23456789'),
    newToken: () => rnd(28, 'abcdefghjkmnpqrstuvwxyz23456789'),
    create: (id, token, config) => rpc('create_invite', { p_id: id, p_token: token, p_config: config }),
    update: (id, token, config) => rpc('update_invite', { p_id: id, p_token: token, p_config: config }),
    open: (id) => rpc('open_invite', { p_id: id }),
    respond: (id, answer, message) => rpc('submit_response', { p_id: id, p_answer: answer, p_message: message }),
    status: (id, token) => rpc('get_status', { p_id: id, p_token: token }),
    remove: (id, token) => rpc('delete_invite', { p_id: id, p_token: token })
  };
})();
