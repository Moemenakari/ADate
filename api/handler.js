// One serverless function for the whole backend. Env: DATABASE_URL (Neon), ADMIN_KEY (owner dashboard).
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

let _sql;
const db = () => (_sql = _sql || neon(process.env.DATABASE_URL));
const ID = /^[a-z0-9]{6,16}$/, TOK = /^[a-z0-9]{16,40}$/;
const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const digits = (s) => String(s || '').replace(/\D/g, '');
const bad = (message, status) => Object.assign(new Error(message), { status: status || 400 });
const same = (a, b) => crypto.timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));

function checkConfig(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) throw bad('Bad invite');
  if (JSON.stringify(c).length > 900000) throw bad('Invite is too large');
}
const cols = (c) => ({ name: String(c.from || '').slice(0, 60), phone: digits(c.contact).slice(0, 16), to: String(c.to || '').slice(0, 60), type: String(c.type || '').slice(0, 20) });

async function owned(sql, id, token) {
  if (!ID.test(id || '') || !TOK.test(token || '')) throw bad('Not allowed', 403);
  const rows = await sql`select * from invites where id = ${id} and token_hash = ${hash(token)}`;
  if (!rows.length) throw bad('Not allowed', 403);
  return rows[0];
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const action = String((req.query && req.query.action) || '');
  try {
    if (action === 'ping') return res.status(200).json({ ok: true, app: 'adate' });
    if (req.method !== 'POST') throw bad('POST only', 405);
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const sql = db();

    if (action === 'create') {
      if (!ID.test(b.id || '') || !TOK.test(b.token || '')) throw bad('Bad id');
      if (b.consent !== true) throw bad('Please accept the privacy note');
      checkConfig(b.config);
      const c = cols(b.config);
      if (c.phone.length < 8) throw bad('A valid WhatsApp number is needed');
      await sql`insert into invites (id, token_hash, config, sender_name, sender_phone, to_name, type, consent)
                values (${b.id}, ${hash(b.token)}, ${JSON.stringify(b.config)}::jsonb, ${c.name}, ${c.phone}, ${c.to}, ${c.type}, true)`;
      return res.status(200).json({ ok: true });
    }
    if (action === 'update') {
      await owned(sql, b.id, b.token); checkConfig(b.config);
      const c = cols(b.config);
      await sql`update invites set config = ${JSON.stringify(b.config)}::jsonb, sender_name = ${c.name}, sender_phone = ${c.phone}, to_name = ${c.to}, type = ${c.type} where id = ${b.id}`;
      return res.status(200).json({ ok: true });
    }
    if (action === 'open') {
      if (!ID.test(b.id || '')) throw bad('Not found', 404);
      const rows = await sql`update invites set opens = opens + 1, first_opened_at = coalesce(first_opened_at, now()), last_opened_at = now() where id = ${b.id} returning config`;
      if (!rows.length) throw bad('Not found', 404);
      return res.status(200).json(rows[0].config);
    }
    if (action === 'respond') {
      if (!ID.test(b.id || '')) throw bad('Not found', 404);
      if (JSON.stringify(b.answer || {}).length > 8000 || String(b.message || '').length > 1500) throw bad('Too large');
      const have = await sql`select (select count(*) from responses where invite_id = ${b.id})::int as n from invites where id = ${b.id}`;
      if (!have.length) throw bad('Not found', 404);
      if (have[0].n >= 20) throw bad('Too many answers');
      await sql`insert into responses (invite_id, answer, message, receiver_phone)
                values (${b.id}, ${JSON.stringify(b.answer || {})}::jsonb, ${String(b.message || '').slice(0, 1500)}, ${digits(b.phone).slice(0, 16) || null})`;
      return res.status(200).json({ ok: true });
    }
    if (action === 'status') {
      const i = await owned(sql, b.id, b.token);
      const rs = await sql`select created_at as at, answer, message, receiver_phone as phone from responses where invite_id = ${b.id} order by created_at desc`;
      return res.status(200).json({ created_at: i.created_at, opens: i.opens, first_opened_at: i.first_opened_at, last_opened_at: i.last_opened_at, config: i.config, responses: rs });
    }
    if (action === 'remove') {
      await owned(sql, b.id, b.token);
      await sql`delete from invites where id = ${b.id}`;
      return res.status(200).json({ ok: true });
    }
    if (action === 'admin') {
      if (!process.env.ADMIN_KEY || !b.key || !same(b.key, process.env.ADMIN_KEY)) throw bad('Wrong key', 403);
      const rows = await sql`select i.id, i.created_at, i.type, i.sender_name, i.sender_phone, i.to_name, i.opens,
          (select count(*) from responses r where r.invite_id = i.id)::int as answers,
          (select max(created_at) from responses r where r.invite_id = i.id) as last_answer_at,
          (select r.receiver_phone from responses r where r.invite_id = i.id and r.receiver_phone is not null order by r.created_at desc limit 1) as receiver_phone
        from invites i order by i.created_at desc limit 1000`;
      const stats = {
        invites: rows.length, opened: rows.filter((r) => r.opens > 0).length, answered: rows.filter((r) => r.answers > 0).length,
        phones: new Set(rows.map((r) => r.sender_phone).concat(rows.map((r) => r.receiver_phone)).filter(Boolean)).size
      };
      return res.status(200).json({ stats, invites: rows });
    }
    throw bad('Unknown action', 404);
  } catch (e) {
    if (!e.status) console.error(e);
    res.status(e.status || 500).json({ message: e.status ? e.message : 'Server error' });
  }
};
