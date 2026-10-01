// Truth or Dare, five levels. Level 1 is free; the others are opened for 24 hours with points.
// Age limits are checked here on the server: set by LEVELS below.
const { ageOf } = require('./community');

const LEVELS = {
  1: { name: 'Friendly', min: 13, price: 0 },
  2: { name: 'Normal', min: 13, price: 10 },
  3: { name: 'Mixed', min: 13, price: 4 },
  4: { name: 'Flirty', min: 14, price: 10 },
  5: { name: 'Spicy', min: 15, price: 25 }
};

/** The owner can change a price in the dashboard (setting tod_price_N); these are the defaults. */
async function priceOf(sql, level) {
  const r = await sql`select value from settings where key = ${'tod_price_' + level}`;
  const n = r.length ? Number(r[0].value) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? Math.round(n) : LEVELS[level].price;
}
async function balanceOf(sql, uid) { const r = await sql`select coalesce(sum(delta), 0)::int as n from points_ledger where user_id = ${uid}`; return r[0].n; }
async function unlockedUntil(sql, uid, level) { const r = await sql`select until from tod_unlocks where user_id = ${uid} and level = ${level} and until > now()`; return r.length ? r[0].until : null; }

async function handle(action, ctx) {
  const { sql, b, res, bad, userOf } = ctx, out = (j) => { res.status(200).json(j); return true; };
  const need = async () => { const u = await userOf(sql, b.session); if (!u.profile_done || !u.birthdate) throw bad('Finish your profile first', 403); return u; };
  const level = () => { const lv = Number(b.level); if (!LEVELS[lv]) throw bad('Bad level'); return lv; };

  if (action === 'tod_state') {
    const u = await need(), age = ageOf(u.birthdate);
    const levels = [];
    for (const lv of [1, 2, 3, 4, 5]) levels.push({ level: lv, name: LEVELS[lv].name, min_age: LEVELS[lv].min, allowed: age >= LEVELS[lv].min, price: await priceOf(sql, lv), until: await unlockedUntil(sql, u.id, lv) });
    return out({ levels, balance: await balanceOf(sql, u.id) });
  }
  if (action === 'tod_unlock') { // opens a level for 24 hours; free levels need nothing
    const u = await need(), age = ageOf(u.birthdate), lv = level();
    if (age < LEVELS[lv].min) throw bad(`This level is for ages ${LEVELS[lv].min} and up`, 403);
    const price = await priceOf(sql, lv);
    const until = await unlockedUntil(sql, u.id, lv);
    if (until || price === 0) return out({ ok: true, until, balance: await balanceOf(sql, u.id) });
    const bal = await balanceOf(sql, u.id);
    if (bal < price) throw bad(`This level costs ${price} points for today. You have ${bal}.`, 402);
    await sql`insert into points_ledger (user_id, delta, reason, ref) values (${u.id}, ${-price}, 'tod', ${String(lv)})`;
    const r = await sql`insert into tod_unlocks (user_id, level, until) values (${u.id}, ${lv}, now() + interval '24 hours') on conflict (user_id, level) do update set until = now() + interval '24 hours' returning until`;
    return out({ ok: true, until: r[0].until, balance: bal - price });
  }
  if (action === 'tod_next') {
    const u = await need(), age = ageOf(u.birthdate), lv = level();
    if (age < LEVELS[lv].min) throw bad(`This level is for ages ${LEVELS[lv].min} and up`, 403);
    if ((await priceOf(sql, lv)) > 0 && !(await unlockedUntil(sql, u.id, lv))) throw bad('Open this level first', 402);
    const kind = b.kind === 'truth' || b.kind === 'dare' ? b.kind : null;
    const seen = Array.isArray(b.seen) ? b.seen.map(Number).filter(Number.isInteger).slice(-60) : [];
    let q = await sql`select id, kind, text from tod_questions where level = ${lv} and active and (${kind}::text is null or kind = ${kind}) and not (id = any(${seen})) order by random() limit 1`;
    if (!q.length) q = await sql`select id, kind, text from tod_questions where level = ${lv} and active and (${kind}::text is null or kind = ${kind}) order by random() limit 1`;
    if (!q.length) throw bad('No questions here yet', 404);
    return out(q[0]);
  }
  return false;
}

/** Owner only (the handler already checked the key): read, add, hide questions. */
async function handleAdmin(action, ctx) {
  const { sql, b, res, bad } = ctx;
  if (action !== 'admin_tod') return false;
  if (b.op === 'add') {
    const lv = Number(b.level), kind = b.kind === 'dare' ? 'dare' : 'truth', text = String(b.text || '').trim().slice(0, 300);
    if (!LEVELS[lv] || text.length < 5) throw bad('Pick a level and write the question');
    await sql`insert into tod_questions (level, kind, text) values (${lv}, ${kind}, ${text})`;
  } else if (b.op === 'hide' || b.op === 'show') {
    await sql`update tod_questions set active = ${b.op === 'show'} where id = ${Number(b.id)}`;
  }
  const rows = await sql`select id, level, kind, text, active from tod_questions order by level, kind, id`;
  res.status(200).json({ questions: rows });
  return true;
}
module.exports = { handle, handleAdmin, LEVELS };
