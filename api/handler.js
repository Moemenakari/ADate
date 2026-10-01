// One serverless function for the whole backend. Env: DATABASE_URL (Neon), ADMIN_KEY (owner dashboard).
// Accounts are phone number + password (hashed with scrypt, never stored in clear).
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

let _sql;
const db = () => (_sql = _sql || neon(process.env.DATABASE_URL));
const ID = /^[a-z0-9]{6,16}$/, TOK = /^[a-z0-9]{16,40}$/, SES = /^[a-f0-9]{48}$/;
const QUESTIONS = ['What is your pet’s name?', 'What year were you born?', 'What is your favourite food?', 'What was your childhood nickname?', 'What was your first school called?'];
const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const digits = (s) => String(s || '').replace(/\D/g, '');
const bad = (message, status) => Object.assign(new Error(message), { status: status || 400 });
const same = (a, b) => crypto.timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
const salt = () => crypto.randomBytes(16).toString('hex');
const kdf = (secret, s) => crypto.scryptSync(String(secret), s, 32).toString('hex');
const eq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const norm = (a) => String(a || '').trim().toLowerCase();

function checkConfig(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) throw bad('Bad invite');
  if (JSON.stringify(c).length > 900000) throw bad('Invite is too large');
}
const cols = (c) => ({ name: String(c.from || '').slice(0, 60), phone: digits(c.contact).slice(0, 16), to: String(c.to || '').slice(0, 60), type: String(c.type || '').slice(0, 20) });
const publicUser = (u) => ({ phone: u.phone, name: u.name, email: u.email });

async function newSession(sql, userId) {
  const t = crypto.randomBytes(24).toString('hex');
  await sql`insert into sessions (token_hash, user_id) values (${hash(t)}, ${userId})`;
  return t;
}
async function userOf(sql, session) {
  if (!SES.test(session || '')) throw bad('Please log in', 401);
  const r = await sql`select u.* from sessions s join users u on u.id = s.user_id where s.token_hash = ${hash(session)}`;
  if (!r.length) throw bad('Please log in', 401);
  return r[0];
}
// the owner of an invite: logged-in account that created it, or the holder of its private token
async function owned(sql, b) {
  if (!ID.test(b.id || '')) throw bad('Not allowed', 403);
  if (b.session) {
    const u = await userOf(sql, b.session);
    const r = await sql`select * from invites where id = ${b.id} and user_id = ${u.id}`;
    if (r.length) return r[0];
  }
  if (TOK.test(b.token || '')) {
    const r = await sql`select * from invites where id = ${b.id} and token_hash = ${hash(b.token)}`;
    if (r.length) return r[0];
  }
  throw bad('Not allowed', 403);
}
// brute-force guard: 5 wrong tries lock the number for 10 minutes
async function checkLock(sql, u) { if (u.locked_until && new Date(u.locked_until) > new Date()) throw bad('Too many tries. Wait 10 minutes and try again.', 429); }
async function fail(sql, u) {
  const n = (u.fails || 0) + 1;
  if (n >= 5) await sql`update users set fails = 0, locked_until = now() + interval '10 minutes' where id = ${u.id}`;
  else await sql`update users set fails = ${n} where id = ${u.id}`;
}
function checkPassword(p) { if (typeof p !== 'string' || p.length < 6 || p.length > 100) throw bad('Password needs at least 6 characters'); }

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const action = String((req.query && req.query.action) || '');
  try {
    if (action === 'ping') return res.status(200).json({ ok: true, app: 'adate', questions: QUESTIONS });
    if (req.method !== 'POST') throw bad('POST only', 405);
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const sql = db();

    /* ---------- accounts ---------- */
    if (action === 'signup') {
      const phone = digits(b.phone);
      if (phone.length < 8 || phone.length > 16) throw bad('That number does not look right');
      checkPassword(b.password);
      if (!QUESTIONS.includes(b.question) || norm(b.answer).length < 2) throw bad('Pick a security question and answer it');
      const email = String(b.email || '').trim().slice(0, 120);
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('That email does not look right');
      const ps = salt(), as = salt();
      let u;
      try {
        const r = await sql`insert into users (phone, name, email, pass_salt, pass_hash, question, answer_salt, answer_hash)
          values (${phone}, ${String(b.name || '').slice(0, 60)}, ${email || null}, ${ps}, ${kdf(b.password, ps)}, ${b.question}, ${as}, ${kdf(norm(b.answer), as)}) returning *`;
        u = r[0];
      } catch (e) { if (e.code === '23505') throw bad('This number already has an account. Please log in.', 409); throw e; }
      return res.status(200).json({ session: await newSession(sql, u.id), user: publicUser(u) });
    }
    if (action === 'login') {
      const phone = digits(b.phone);
      const r = await sql`select * from users where phone = ${phone}`;
      if (!r.length) throw bad('Wrong number or password', 401);
      const u = r[0]; await checkLock(sql, u);
      if (!eq(kdf(b.password || '', u.pass_salt), u.pass_hash)) { await fail(sql, u); throw bad('Wrong number or password', 401); }
      await sql`update users set fails = 0, last_login_at = now() where id = ${u.id}`;
      return res.status(200).json({ session: await newSession(sql, u.id), user: publicUser(u) });
    }
    if (action === 'recover_question') {
      const r = await sql`select question from users where phone = ${digits(b.phone)}`;
      if (!r.length) throw bad('No account with this number', 404);
      return res.status(200).json({ question: r[0].question });
    }
    if (action === 'recover') {
      const r = await sql`select * from users where phone = ${digits(b.phone)}`;
      if (!r.length) throw bad('No account with this number', 404);
      const u = r[0]; await checkLock(sql, u); checkPassword(b.password);
      if (!eq(kdf(norm(b.answer), u.answer_salt), u.answer_hash)) { await fail(sql, u); throw bad('That answer is not right', 401); }
      const ps = salt();
      await sql`update users set pass_salt = ${ps}, pass_hash = ${kdf(b.password, ps)}, fails = 0 where id = ${u.id}`;
      await sql`delete from sessions where user_id = ${u.id}`;
      return res.status(200).json({ session: await newSession(sql, u.id), user: publicUser(u) });
    }
    if (action === 'logout') { if (SES.test(b.session || '')) await sql`delete from sessions where token_hash = ${hash(b.session)}`; return res.status(200).json({ ok: true }); }
    if (action === 'me') {
      const u = await userOf(sql, b.session);
      const invites = await sql`select i.id, i.type, i.to_name, i.created_at, i.opens, i.last_opened_at,
          (select count(*) from responses r where r.invite_id = i.id)::int as answers,
          (select count(*) from responses r where r.invite_id = i.id and r.seen_at is null)::int as unseen
        from invites i where i.user_id = ${u.id} order by i.created_at desc limit 100`;
      const unseen = await sql`select r.id, r.invite_id, i.to_name, r.created_at as at, r.answer, r.message, r.receiver_phone as phone
        from responses r join invites i on i.id = r.invite_id where i.user_id = ${u.id} and r.seen_at is null order by r.created_at desc limit 20`;
      return res.status(200).json({ user: publicUser(u), invites, unseen });
    }
    if (action === 'inbox') { // one invite with all its answers; reading it marks them as seen
      const i = await owned(sql, b);
      const rs = await sql`select created_at as at, answer, message, receiver_phone as phone from responses where invite_id = ${b.id} order by created_at desc`;
      await sql`update responses set seen_at = now() where invite_id = ${b.id} and seen_at is null`;
      return res.status(200).json({ created_at: i.created_at, opens: i.opens, first_opened_at: i.first_opened_at, last_opened_at: i.last_opened_at, config: i.config, responses: rs });
    }

    /* ---------- invites ---------- */
    if (action === 'create') {
      if (!ID.test(b.id || '') || !TOK.test(b.token || '')) throw bad('Bad id');
      if (b.consent !== true) throw bad('Please accept the privacy note');
      const u = await userOf(sql, b.session);
      checkConfig(b.config);
      const c = cols(b.config);
      await sql`insert into invites (id, token_hash, config, sender_name, sender_phone, to_name, type, consent, user_id)
                values (${b.id}, ${hash(b.token)}, ${JSON.stringify(b.config)}::jsonb, ${c.name}, ${c.phone || u.phone}, ${c.to}, ${c.type}, true, ${u.id})`;
      return res.status(200).json({ ok: true });
    }
    if (action === 'update') {
      await owned(sql, b); checkConfig(b.config);
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
      const msg = String(b.message || '').trim();
      if (!msg) throw bad('The message is empty');
      if (JSON.stringify(b.answer || {}).length > 8000 || msg.length > 1500) throw bad('Too large');
      const have = await sql`select (select count(*) from responses where invite_id = ${b.id})::int as n from invites where id = ${b.id}`;
      if (!have.length) throw bad('Not found', 404);
      if (have[0].n >= 20) throw bad('Too many answers');
      await sql`insert into responses (invite_id, answer, message, receiver_phone)
                values (${b.id}, ${JSON.stringify(b.answer || {})}::jsonb, ${msg.slice(0, 1500)}, ${digits(b.phone).slice(0, 16) || null})`;
      return res.status(200).json({ ok: true });
    }
    if (action === 'status') { // legacy private-link access
      const i = await owned(sql, b);
      const rs = await sql`select created_at as at, answer, message, receiver_phone as phone from responses where invite_id = ${b.id} order by created_at desc`;
      return res.status(200).json({ created_at: i.created_at, opens: i.opens, first_opened_at: i.first_opened_at, last_opened_at: i.last_opened_at, config: i.config, responses: rs });
    }
    if (action === 'remove') {
      await owned(sql, b);
      await sql`delete from invites where id = ${b.id}`;
      return res.status(200).json({ ok: true });
    }

    /* ---------- site owner ---------- */
    if (action === 'admin' || action === 'admin_reset') {
      if (!process.env.ADMIN_KEY || !b.key || !same(b.key, process.env.ADMIN_KEY)) throw bad('Wrong key', 403);
      if (action === 'admin_reset') { // owner sets a temporary password; passwords themselves are never readable
        const phone = digits(b.phone);
        const temp = crypto.randomBytes(5).toString('hex'), ps = salt();
        const r = await sql`update users set pass_salt = ${ps}, pass_hash = ${kdf(temp, ps)}, fails = 0, locked_until = null where phone = ${phone} returning id`;
        if (!r.length) throw bad('No such account', 404);
        await sql`delete from sessions where user_id = ${r[0].id}`;
        return res.status(200).json({ phone, temp });
      }
      const users = await sql`select u.id, u.phone, u.name, u.email, u.created_at, u.last_login_at, u.question,
          (select count(*) from invites i where i.user_id = u.id)::int as invites from users u order by u.created_at desc limit 1000`;
      const invites = await sql`select i.id, i.created_at, i.type, i.sender_name, i.sender_phone, i.to_name, i.opens,
          (select count(*) from responses r where r.invite_id = i.id)::int as answers,
          (select max(created_at) from responses r where r.invite_id = i.id) as last_answer_at,
          (select r.receiver_phone from responses r where r.invite_id = i.id and r.receiver_phone is not null order by r.created_at desc limit 1) as receiver_phone
        from invites i order by i.created_at desc limit 1000`;
      const answers = await sql`select r.created_at as at, r.message, r.receiver_phone, r.answer, i.sender_name, i.to_name, i.sender_phone
        from responses r join invites i on i.id = r.invite_id order by r.created_at desc limit 100`;
      const stats = {
        users: users.length, invites: invites.length, opened: invites.filter((r) => r.opens > 0).length, answered: invites.filter((r) => r.answers > 0).length,
        phones: new Set(users.map((r) => r.phone).concat(invites.map((r) => r.sender_phone), invites.map((r) => r.receiver_phone)).filter(Boolean)).size
      };
      return res.status(200).json({ stats, users, invites, answers });
    }
    throw bad('Unknown action', 404);
  } catch (e) {
    if (!e.status) console.error(e);
    res.status(e.status || 500).json({ message: e.status ? e.message : 'Server error' });
  }
};
