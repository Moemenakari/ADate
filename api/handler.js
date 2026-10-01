// One serverless function for the whole backend. Env: DATABASE_URL (Neon), ADMIN_KEY (owner dashboard).
// Accounts are phone number + password (hashed with scrypt, never stored in clear).
const { neon } = require('@neondatabase/serverless');
const webpush = require('web-push');
const crypto = require('crypto');
const community = require('./_lib/community');
const play = require('./_lib/play');
const shop = require('./_lib/shop');

let _sql;
const db = () => (_sql = _sql || neon(process.env.DATABASE_URL));
const ID = /^[a-z0-9]{6,16}$/, TOK = /^[a-z0-9]{16,40}$/, SES = /^[a-f0-9]{48}$/;
const QUESTIONS = ['What is your pet’s name?', 'What year were you born?', 'What is your favourite food?', 'What was your childhood nickname?', 'What was your first school called?'];
const Q2 = 'Which phone do you use now? (brand and model)';
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
// The Google client ID is public (it is in every sign-in page); it only says which app the token was made for. There is no secret in this code.
const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID || '53008505841-vo4k1nv7rtvqp9t58tkdgncc18ee4duf.apps.googleusercontent.com';
const igOk = (v) => (/^[A-Za-z0-9._]{1,30}$/.test(v) && !/^\.+$/.test(v) ? v : '');
const contactOf = (v) => { const t = String(v || '').trim(); return t[0] === '@' ? (igOk(t.slice(1)) ? '@' + igOk(t.slice(1)) : '') : digits(t).slice(0, 16); };
const cols = (c) => ({ name: String(c.from || '').slice(0, 60), phone: digits(c.contact).slice(0, 16), to: String(c.to || '').slice(0, 60), type: String(c.type || '').slice(0, 20), toc: contactOf(c.toContact) || null });
const publicUser = (u) => ({ phone: u.phone, name: u.name, email: u.email, first_name: u.first_name || '', last_name: u.last_name || '', birthdate: u.birthdate ? community.dateStr(u.birthdate) : '', interests: u.interests || [], profile_done: !!u.profile_done, google: !!u.google_sub, has_password: !!u.pass_hash, has_recovery: !!(u.answer_hash && u.answer2_hash), verified: !!u.verified, verify_code: u.verify_code || '' });
const ageOn = (iso) => { const d = new Date(iso + 'T00:00:00Z'), n = new Date(); let a = n.getUTCFullYear() - d.getUTCFullYear(); if (n.getUTCMonth() < d.getUTCMonth() || (n.getUTCMonth() === d.getUTCMonth() && n.getUTCDate() < d.getUTCDate())) a--; return a; };
async function verifyGoogle(cred) { // the Google sign-in button gives the browser a signed token; Google itself tells us whether it is real and for our app
  const cid = GOOGLE_ID;
  if (!cid) throw bad('Google sign-in is not set up yet', 503);
  if (typeof cred !== 'string' || cred.length < 50 || cred.length > 4000) throw bad('Bad sign-in', 401);
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(cred));
  if (!r.ok) throw bad('Google did not accept that sign-in', 401);
  const t = await r.json();
  if (t.aud !== cid || !['accounts.google.com', 'https://accounts.google.com'].includes(t.iss) || String(t.email_verified) !== 'true' || !t.sub || Number(t.exp) * 1000 < Date.now()) throw bad('Google did not accept that sign-in', 401);
  return t;
}

async function newSession(sql, userId) {
  const t = crypto.randomBytes(24).toString('hex');
  await sql`insert into sessions (token_hash, user_id) values (${hash(t)}, ${userId})`;
  return t;
}
async function userOf(sql, session) {
  if (!SES.test(session || '')) throw bad('Please log in', 401);
  const r = await sql`select u.* from sessions s join users u on u.id = s.user_id where s.token_hash = ${hash(session)}`;
  if (!r.length) throw bad('Please log in', 401);
  if (r[0].blocked) throw bad('This account is blocked', 403);
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
// Phone notification to the invite's owner. throttleSec avoids spamming on repeated opens.
let _vapid = false;
async function notify(sql, inviteId, kind, title, body, throttleSec) {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return;
  try {
    const inv = await sql`select user_id, last_notified_at from invites where id = ${inviteId}`;
    if (!inv.length || !inv[0].user_id) return;
    if (throttleSec && inv[0].last_notified_at && Date.now() - new Date(inv[0].last_notified_at).getTime() < throttleSec * 1000) return;
    const subs = await sql`select endpoint, p256dh, auth from push_subs where user_id = ${inv[0].user_id}`;
    if (!subs.length) return;
    await sql`update invites set last_notified_at = now() where id = ${inviteId}`;
    if (!_vapid) { webpush.setVapidDetails('https://adate.vercel.app', pub, priv); _vapid = true; }
    const payload = JSON.stringify({ title, body, url: '/#/mine', tag: kind + inviteId });
    await Promise.allSettled(subs.map(async (x) => {
      try { await webpush.sendNotification({ endpoint: x.endpoint, keys: { p256dh: x.p256dh, auth: x.auth } }, payload, { TTL: 3600, timeout: 4000 }); }
      catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sql`delete from push_subs where endpoint = ${x.endpoint}`; }
    }));
  } catch (e) { console.error('notify failed', e && e.message); }
}
const nameOf = async (sql, id) => { const r = await sql`select to_name from invites where id = ${id}`; return (r[0] && r[0].to_name) || 'Someone'; };
function checkPassword(p) { if (typeof p !== 'string' || p.length < 6 || p.length > 100) throw bad('Password needs at least 6 characters'); }

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const action = String((req.query && req.query.action) || '');
  try {
    if (action === 'ping') return res.status(200).json({ ok: true, app: 'adate', questions: QUESTIONS, q2: Q2, vapid: process.env.VAPID_PUBLIC_KEY || null, google: GOOGLE_ID || null });
    if (req.method !== 'POST' && action !== 'cleanup') throw bad('POST only', 405);
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const sql = db();
    if (await community.handle(action, { sql, b, res, bad, userOf })) return;
    if (await play.handle(action, { sql, b, res, bad, userOf })) return;
    if (await shop.handle(action, { sql, b, res, bad, userOf })) return;

    /* ---------- accounts ---------- */
    if (action === 'signup') {
      const phone = digits(b.phone);
      if (phone.length < 8 || phone.length > 16) throw bad('That number does not look right');
      checkPassword(b.password);
      if (!QUESTIONS.includes(b.question) || norm(b.answer).length < 2) throw bad('Pick a security question and answer it');
      const email = String(b.email || '').trim().toLowerCase().slice(0, 120);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('Write your email correctly. It is how you get your account back.');
      if (norm(b.answer2).length < 2) throw bad('Answer the second question too');
      const ps = salt(), as = salt(), as2 = salt();
      let u;
      try {
        const r = await sql`insert into users (phone, name, email, pass_salt, pass_hash, question, answer_salt, answer_hash, question2, answer2_salt, answer2_hash)
          values (${phone}, ${String(b.name || '').slice(0, 60)}, ${email}, ${ps}, ${kdf(b.password, ps)}, ${b.question}, ${as}, ${kdf(norm(b.answer), as)}, ${Q2}, ${as2}, ${kdf(norm(b.answer2), as2)}) returning *`;
        u = r[0];
      } catch (e) { if (e.code === '23505') throw bad('This number already has an account. Please log in.', 409); throw e; }
      return res.status(200).json({ session: await newSession(sql, u.id), user: publicUser(u) });
    }
    if (action === 'login') {
      const phone = digits(b.phone);
      const r = await sql`select * from users where phone = ${phone}`;
      if (!r.length) throw bad('Wrong number or password', 401);
      const u = r[0]; if (u.blocked) throw bad('This account is blocked', 403); await checkLock(sql, u);
      if (!u.pass_hash || !eq(kdf(b.password || '', u.pass_salt), u.pass_hash)) { await fail(sql, u); throw bad('Wrong number or password', 401); }
      await sql`update users set fails = 0, last_login_at = now() where id = ${u.id}`;
      return res.status(200).json({ session: await newSession(sql, u.id), user: publicUser(u) });
    }
    if (action === 'google') {
      const t = await verifyGoogle(b.credential);
      let r = await sql`select * from users where google_sub = ${t.sub}`;
      if (!r.length) r = await sql`insert into users (google_sub, email, name, first_name, last_name) values (${t.sub}, ${String(t.email || '').slice(0, 120)}, ${String(t.given_name || t.name || '').slice(0, 60)}, ${String(t.given_name || '').slice(0, 40)}, ${String(t.family_name || '').slice(0, 40)}) returning *`;
      if (r[0].blocked) throw bad('This account is blocked', 403);
      await sql`update users set last_login_at = now() where id = ${r[0].id}`;
      return res.status(200).json({ session: await newSession(sql, r[0].id), user: publicUser(r[0]) });
    }
    if (action === 'profile_set') {
      const u = await userOf(sql, b.session);
      const first = String(b.first_name || '').trim().slice(0, 40), last = String(b.last_name || '').trim().slice(0, 40), phone = digits(b.phone);
      if (!first || !last) throw bad('Add your first and last name');
      if (phone.length < 8 || phone.length > 15) throw bad('That number does not look right');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.birthdate || '') || isNaN(new Date(b.birthdate))) throw bad('Pick your birthday');
      const age = ageOn(b.birthdate); if (age < 13) throw bad('ADate is for ages 13 and up'); if (age > 100) throw bad('That birthday does not look right');
      const interests = Array.isArray(b.interests) ? [...new Set(b.interests.map((x) => String(x).trim().slice(0, 30)).filter(Boolean))].slice(0, 10) : [];
      if (interests.length < 1) throw bad('Pick at least one interest');
      const email = String(b.email || u.email || '').trim().toLowerCase().slice(0, 120);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('Write your email correctly');
      let pw = null;
      if (!u.pass_hash) { checkPassword(b.password); if (b.password !== b.password2) throw bad('The two passwords are not the same'); pw = salt(); }
      let rec = null;
      if (!(u.answer_hash && u.answer2_hash)) { if (!QUESTIONS.includes(b.question) || norm(b.answer).length < 2 || norm(b.answer2).length < 2) throw bad('Answer both security questions'); rec = [salt(), salt()]; }
      const clash = await sql`select id from users where phone = ${phone} and id <> ${u.id}`;
      if (clash.length) throw bad('This number is already used by another account. If it is your older ADate account, use “Link my old account”.', 409);
      const code = u.verify_code || crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
      const r = await sql`update users set first_name = ${first}, last_name = ${last}, name = ${first}, phone = ${phone}, email = ${email}, birthdate = ${b.birthdate}::date, interests = ${interests}, profile_done = true, verify_code = ${code} where id = ${u.id} returning *`;
      if (pw) await sql`update users set pass_salt = ${pw}, pass_hash = ${kdf(b.password, pw)} where id = ${u.id}`;
      if (rec) await sql`update users set question = ${b.question}, answer_salt = ${rec[0]}, answer_hash = ${kdf(norm(b.answer), rec[0])}, question2 = ${Q2}, answer2_salt = ${rec[1]}, answer2_hash = ${kdf(norm(b.answer2), rec[1])} where id = ${u.id}`;
      const refc = u.ref_code || crypto.randomBytes(5).toString('hex').slice(0, 8).toUpperCase();
      await sql`update users set ref_code = ${refc}, country = coalesce(country, ${community.countryOf(phone)}) where id = ${u.id}`;
      if (!(await sql`select 1 from points_ledger where user_id = ${u.id} and reason = 'profile'`).length) await sql`insert into points_ledger (user_id, delta, reason) values (${u.id}, 15, 'profile')`; // completing the profile earns 15 points, once
      const fresh = await sql`select * from users where id = ${u.id}`; r[0] = fresh[0];
      return res.status(200).json({ user: publicUser(r[0]) });
    }
    if (action === 'link_legacy') { // bring the invites of an older phone+password account into this one
      const u = await userOf(sql, b.session);
      const r = await sql`select * from users where phone = ${digits(b.phone)} and pass_hash is not null`;
      if (!r.length || r[0].id === u.id) throw bad('Wrong number or password', 401);
      const old = r[0]; await checkLock(sql, old);
      if (!eq(kdf(b.password || '', old.pass_salt), old.pass_hash)) { await fail(sql, old); throw bad('Wrong number or password', 401); }
      await sql`update invites set user_id = ${u.id} where user_id = ${old.id}`;
      await sql`update push_subs set user_id = ${u.id} where user_id = ${old.id}`;
      await sql`delete from users where id = ${old.id}`;
      if (!u.phone) await sql`update users set phone = ${old.phone} where id = ${u.id}`;
      const n = await sql`select * from users where id = ${u.id}`;
      return res.status(200).json({ user: publicUser(n[0]) });
    }
    if (action === 'recover_email_start') {
      const r = await sql`select question, question2 from users where lower(email) = ${String(b.email || '').trim().toLowerCase()} and answer_hash is not null and answer2_hash is not null and not blocked`;
      if (!r.length) throw bad('No account with this email and security answers', 404);
      return res.status(200).json({ q1: r[0].question, q2: r[0].question2 });
    }
    if (action === 'recover_email') {
      const r = await sql`select * from users where lower(email) = ${String(b.email || '').trim().toLowerCase()} and answer_hash is not null and answer2_hash is not null`;
      if (!r.length) throw bad('No account with this email', 404);
      const u = r[0]; if (u.blocked) throw bad('This account is blocked', 403); await checkLock(sql, u); checkPassword(b.password);
      if (b.password !== b.password2) throw bad('The two passwords are not the same');
      if (!eq(kdf(norm(b.answer), u.answer_salt), u.answer_hash) || !eq(kdf(norm(b.answer2), u.answer2_salt), u.answer2_hash)) { await fail(sql, u); throw bad('Those answers are not right', 401); }
      const ps = salt();
      await sql`update users set pass_salt = ${ps}, pass_hash = ${kdf(b.password, ps)}, fails = 0 where id = ${u.id}`;
      await sql`delete from sessions where user_id = ${u.id}`;
      const f = await sql`select * from users where id = ${u.id}`;
      return res.status(200).json({ session: await newSession(sql, u.id), user: publicUser(f[0]) });
    }
    if (action === 'public_settings') { // numbers the owner chose to show (WhatsApp for verification, Whish for payments)
      const r = await sql`select key, value from settings where key in ('owner_whatsapp', 'whish_link', 'whish_note')`;
      return res.status(200).json(Object.fromEntries(r.map((x) => [x.key, x.value])));
    }
    if (action === 'recover_question') {
      const r = await sql`select question from users where phone = ${digits(b.phone)}`;
      if (!r.length) throw bad('No account with this number', 404);
      return res.status(200).json({ question: r[0].question });
    }
    if (action === 'recover') {
      const r = await sql`select * from users where phone = ${digits(b.phone)}`;
      if (!r.length) throw bad('No account with this number', 404);
      const u = r[0]; if (u.blocked) throw bad('This account is blocked', 403); await checkLock(sql, u); checkPassword(b.password);
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
      const unseen = await sql`select r.id, r.invite_id, i.to_name, r.created_at as at, r.answer, r.message, r.receiver_phone as phone, r.receiver_ig as ig
        from responses r join invites i on i.id = r.invite_id where i.user_id = ${u.id} and r.seen_at is null order by r.created_at desc limit 20`;
      return res.status(200).json({ user: publicUser(u), invites, unseen });
    }
    if (action === 'inbox') { // one invite with all its answers; reading it marks them as seen
      const i = await owned(sql, b);
      const rs = await sql`select created_at as at, answer, message, receiver_phone as phone, receiver_ig as ig from responses where invite_id = ${b.id} order by created_at desc`;
      const events = await sql`select created_at as at, kind, data, visitor from events where invite_id = ${b.id} and kind <> 'contact' order by created_at asc limit 400`;
      await sql`update responses set seen_at = now() where invite_id = ${b.id} and seen_at is null`;
      return res.status(200).json({ created_at: i.created_at, opens: i.opens, first_opened_at: i.first_opened_at, last_opened_at: i.last_opened_at, config: i.config, responses: rs, events });
    }

    if (action === 'push_subscribe') {
      const u = await userOf(sql, b.session);
      const sub = b.sub || {};
      if (typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || sub.endpoint.length > 600 || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) throw bad('Bad subscription');
      await sql`insert into push_subs (user_id, endpoint, p256dh, auth) values (${u.id}, ${sub.endpoint}, ${String(sub.keys.p256dh).slice(0, 200)}, ${String(sub.keys.auth).slice(0, 100)})
                on conflict (endpoint) do update set user_id = ${u.id}, p256dh = ${String(sub.keys.p256dh).slice(0, 200)}, auth = ${String(sub.keys.auth).slice(0, 100)}`;
      return res.status(200).json({ ok: true });
    }
    if (action === 'push_unsubscribe') {
      const u = await userOf(sql, b.session);
      if (typeof b.endpoint === 'string') await sql`delete from push_subs where endpoint = ${b.endpoint} and user_id = ${u.id}`;
      return res.status(200).json({ ok: true });
    }

    /* ---------- invites ---------- */
    if (action === 'create') {
      if (!ID.test(b.id || '') || !TOK.test(b.token || '')) throw bad('Bad id');
      if (b.consent !== true) throw bad('Please accept the privacy note');
      const u = await userOf(sql, b.session);
      if (!u.profile_done) throw bad('Finish your profile first', 403);
      checkConfig(b.config);
      const c = cols(b.config);
      if (!c.toc) throw bad('Add their WhatsApp number or Instagram');
      await sql`insert into invites (id, token_hash, config, sender_name, sender_phone, to_name, type, consent, user_id, to_contact)
                values (${b.id}, ${hash(b.token)}, ${JSON.stringify(b.config)}::jsonb, ${c.name}, ${u.phone || c.phone}, ${c.to}, ${c.type}, true, ${u.id}, ${c.toc})`;
      return res.status(200).json({ ok: true });
    }
    if (action === 'update') {
      await owned(sql, b); checkConfig(b.config);
      const c = cols(b.config);
      await sql`update invites set config = ${JSON.stringify(b.config)}::jsonb, sender_name = ${c.name}, sender_phone = ${c.phone}, to_name = ${c.to}, type = ${c.type}, to_contact = coalesce(${c.toc}, to_contact) where id = ${b.id}`;
      return res.status(200).json({ ok: true });
    }
    if (action === 'open') {
      if (!ID.test(b.id || '')) throw bad('Not found', 404);
      const rows = await sql`update invites set opens = opens + 1, first_opened_at = coalesce(first_opened_at, now()), last_opened_at = now() where id = ${b.id} returning config`;
      if (!rows.length) throw bad('Not found', 404);
      await sql`insert into events (invite_id, kind, data, visitor) values (${b.id}, 'open', '{}'::jsonb, ${String(b.visitor || '').slice(0, 24) || null})`;
      await notify(sql, b.id, 'open', '👀 ' + (rows[0].config.to || 'Someone') + ' opened your invite', 'Tap to follow what they do.', 120);
      return res.status(200).json(rows[0].config);
    }
    if (action === 'track') { // which screen they reached / how many times they pressed No. Fire-and-forget from the invite page.
      if (!ID.test(b.id || '') || !['step', 'no', 'leave', 'contact'].includes(b.kind)) throw bad('Bad event');
      let dd = b.data || {};
      if (b.kind === 'contact') dd = { phone: digits(dd.phone).slice(0, 16), ig: igOk(String(dd.ig || '').replace(/^@/, '').trim()), src: dd.src === 'contact' ? 'contact' : 'typed' }; // what the receiver typed on the last page, even if she never pressed send
      const data = JSON.stringify(dd);
      if (data.length > 600) throw bad('Too large');
      const have = await sql`select (select count(*) from events where invite_id = ${b.id})::int as n from invites where id = ${b.id}`;
      if (!have.length) throw bad('Not found', 404);
      if (have[0].n >= 400) return res.status(200).json({ ok: true });
      await sql`insert into events (invite_id, kind, data, visitor) values (${b.id}, ${b.kind}, ${data}::jsonb, ${String(b.visitor || '').slice(0, 24) || null})`;
      if (b.kind === 'step' && b.data && b.data.s === 'yay') await notify(sql, b.id, 'yes', '💖 ' + (await nameOf(sql, b.id)) + ' pressed YES!', 'They are picking a day now.', 0);
      return res.status(200).json({ ok: true });
    }
    if (action === 'respond') {
      if (!ID.test(b.id || '')) throw bad('Not found', 404);
      const msg = String(b.message || '').trim();
      if (!msg) throw bad('The message is empty');
      if (JSON.stringify(b.answer || {}).length > 8000 || msg.length > 1500) throw bad('Too large');
      const have = await sql`select (select count(*) from responses where invite_id = ${b.id})::int as n from invites where id = ${b.id}`;
      if (!have.length) throw bad('Not found', 404);
      if (have[0].n >= 20) throw bad('Too many answers');
      const rp = digits(b.phone).slice(0, 16), rig = igOk(String(b.ig || '').replace(/^@/, '').trim());
      if (rp.length < 8) throw bad('Add your WhatsApp number');
      await sql`insert into responses (invite_id, answer, message, receiver_phone, receiver_ig)
                values (${b.id}, ${JSON.stringify(b.answer || {})}::jsonb, ${msg.slice(0, 1500)}, ${rp}, ${rig || null})`;
      const later = b.answer && b.answer.yes === false, who = await nameOf(sql, b.id);
      await notify(sql, b.id, 'answer', later ? '🙂 ' + who + ' replied: not right now' : '💌 ' + who + ' answered your invite!', msg.slice(0, 90), 0);
      return res.status(200).json({ ok: true });
    }
    if (action === 'status') { // legacy private-link access
      const i = await owned(sql, b);
      const rs = await sql`select created_at as at, answer, message, receiver_phone as phone, receiver_ig as ig from responses where invite_id = ${b.id} order by created_at desc`;
      const events = await sql`select created_at as at, kind, data, visitor from events where invite_id = ${b.id} and kind <> 'contact' order by created_at asc limit 400`;
      return res.status(200).json({ created_at: i.created_at, opens: i.opens, first_opened_at: i.first_opened_at, last_opened_at: i.last_opened_at, config: i.config, responses: rs, events });
    }
    if (action === 'remove') {
      await owned(sql, b);
      await sql`delete from invites where id = ${b.id}`;
      return res.status(200).json({ ok: true });
    }

    /* ---------- site owner ---------- */
    if (action === 'admin_reports' || action === 'admin_mod' || action === 'admin_tod' || action === 'admin_orders' || action === 'admin_order_decide') { if (!process.env.ADMIN_KEY || !b.key || !same(b.key, process.env.ADMIN_KEY)) throw bad('Wrong key', 403); if (await community.handleAdmin(action, { sql, b, res, bad })) return; if (await play.handleAdmin(action, { sql, b, res, bad })) return; if (await shop.handleAdmin(action, { sql, b, res, bad })) return; }
    if (action === 'admin' || action === 'admin_reset' || action === 'admin_invite' || action === 'admin_mark' || action === 'admin_set' || action === 'admin_settings') {
      if (!process.env.ADMIN_KEY || !b.key || !same(b.key, process.env.ADMIN_KEY)) throw bad('Wrong key', 403);
      if (action === 'admin_invite') {
        if (!ID.test(b.id || '')) throw bad('Bad id');
        const i = await sql`select id, created_at, opens, first_opened_at, last_opened_at, config from invites where id = ${b.id}`;
        if (!i.length) throw bad('Not found', 404);
        const rs = await sql`select created_at as at, answer, message, receiver_phone as phone, receiver_ig as ig from responses where invite_id = ${b.id} order by created_at desc`;
        const events = await sql`select created_at as at, kind, data, visitor from events where invite_id = ${b.id} order by created_at asc limit 400`;
        return res.status(200).json({ created_at: i[0].created_at, opens: i[0].opens, first_opened_at: i[0].first_opened_at, last_opened_at: i[0].last_opened_at, config: i[0].config, responses: rs, events });
      }
      if (action === 'admin_settings') { const r = await sql`select key, value from settings`; return res.status(200).json(Object.fromEntries(r.map((x) => [x.key, x.value]))); }
      if (action === 'admin_set') {
        const k = String(b.name || ''); if (!['owner_whatsapp', 'whish_link', 'whish_note', 'tod_price_2', 'tod_price_3', 'tod_price_4', 'tod_price_5'].includes(k)) throw bad('Bad setting');
        const v = String(b.value || '').trim().slice(0, 300);
        await sql`insert into settings (key, value) values (${k}, ${v}) on conflict (key) do update set value = ${v}`;
        return res.status(200).json({ ok: true });
      }
      if (action === 'admin_mark') { // block / unblock / mark as verified, per account
        const id = Number(b.id); if (!Number.isInteger(id)) throw bad('Bad id');
        const op = String(b.op || '');
        if (!['block', 'unblock', 'verify', 'unverify', 'admin', 'unadmin', 'photo_off'].includes(op)) throw bad('Bad action');
        const note = String(b.note || '').slice(0, 200) || null;
        const r = op === 'block' ? await sql`update users set blocked = true, blocked_note = ${note} where id = ${id} returning id`
          : op === 'unblock' ? await sql`update users set blocked = false, blocked_note = null where id = ${id} returning id`
          : op === 'photo_off' ? await sql`update users set photo = null, photo_ok = false where id = ${id} returning id`
          : op === 'admin' || op === 'unadmin' ? await sql`update users set is_admin = ${op === 'admin'} where id = ${id} returning id`
          : await sql`update users set verified = ${op === 'verify'} where id = ${id} returning id`;
        if (!r.length) throw bad('No such account', 404);
        if (op === 'block') { await sql`delete from sessions where user_id = ${id}`; await sql`delete from push_subs where user_id = ${id}`; }
        return res.status(200).json({ ok: true });
      }
      if (action === 'admin_reset') { // owner sets a temporary password; passwords themselves are never readable
        const phone = digits(b.phone);
        const temp = crypto.randomBytes(5).toString('hex'), ps = salt();
        const r = await sql`update users set pass_salt = ${ps}, pass_hash = ${kdf(temp, ps)}, fails = 0, locked_until = null where phone = ${phone} returning id`;
        if (!r.length) throw bad('No such account', 404);
        await sql`delete from sessions where user_id = ${r[0].id}`;
        return res.status(200).json({ phone, temp });
      }
      const users = await sql`select u.id, u.phone, u.name, u.first_name, u.last_name, u.birthdate, u.interests, u.profile_done, u.blocked, u.blocked_note, u.verified, u.verify_code, u.is_admin, u.muted_until, (u.photo is not null) as has_photo, (u.google_sub is not null) as google, u.email, u.created_at, u.last_login_at, u.question,
          (select count(*) from invites i where i.user_id = u.id)::int as invites from users u order by u.created_at desc limit 1000`;
      const invites = await sql`select i.id, i.created_at, i.type, i.sender_name, i.sender_phone, i.to_name, i.to_contact, i.opens,
          i.first_opened_at, i.last_opened_at, i.config->>'toIg' as to_ig, (select u.email from users u where u.id = i.user_id) as account_email, (select u.id from users u where u.id = i.user_id) as account_id, (select e.data->>'phone' from events e where e.invite_id = i.id and e.kind = 'contact' and coalesce(e.data->>'phone', '') <> '' order by e.created_at desc limit 1) as typed_phone, (select e.data->>'ig' from events e where e.invite_id = i.id and e.kind = 'contact' and coalesce(e.data->>'ig', '') <> '' order by e.created_at desc limit 1) as typed_ig, (select nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '') from users u where u.id = i.user_id) as account_name,
          (select count(*) from responses r where r.invite_id = i.id)::int as answers,
          (select max(created_at) from responses r where r.invite_id = i.id) as last_answer_at,
          (select r.receiver_phone from responses r where r.invite_id = i.id and r.receiver_phone is not null order by r.created_at desc limit 1) as receiver_phone,
          (select r.receiver_ig from responses r where r.invite_id = i.id and r.receiver_ig is not null order by r.created_at desc limit 1) as receiver_ig,
          (select r.answer->>'src' from responses r where r.invite_id = i.id and r.receiver_phone is not null order by r.created_at desc limit 1) as receiver_src
        from invites i order by i.created_at desc limit 1000`;
      const answers = await sql`select r.invite_id, r.created_at as at, r.message, r.receiver_phone, r.receiver_ig, r.answer, i.sender_name, i.to_name, i.sender_phone
        from responses r join invites i on i.id = r.invite_id order by r.created_at desc limit 100`;
      const stats = {
        users: users.length, invites: invites.length, opened: invites.filter((r) => r.opens > 0).length, answered: invites.filter((r) => r.answers > 0).length,
        phones: new Set(users.map((r) => r.phone).concat(invites.map((r) => r.sender_phone), invites.map((r) => r.receiver_phone), invites.map((r) => (r.to_contact && r.to_contact[0] !== '@' ? r.to_contact : null))).filter(Boolean)).size
      };
      return res.status(200).json({ stats, users, invites, answers });
    }
    throw bad('Unknown action', 404);
  } catch (e) {
    if (!e.status) console.error(e);
    res.status(e.status || 500).json({ message: e.status ? e.message : 'Server error' });
  }
};
