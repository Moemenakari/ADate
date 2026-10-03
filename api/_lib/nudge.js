// Reminder pushes, one random message per person about every 3 hours, never at night in their own country. They can switch them off in Settings or mute a chat.
// Called every hour by a GitHub Actions schedule as GET /api/nudge. If env CRON_SECRET is set it must be sent as a Bearer token.
const { pushUsers } = require('./community');

const TZ = { LB: 'Asia/Beirut', SY: 'Asia/Damascus', JO: 'Asia/Amman', IQ: 'Asia/Baghdad', SA: 'Asia/Riyadh', AE: 'Asia/Dubai', KW: 'Asia/Kuwait', QA: 'Asia/Qatar', BH: 'Asia/Bahrain', EG: 'Africa/Cairo', TR: 'Europe/Istanbul', GB: 'Europe/London', FR: 'Europe/Paris', DE: 'Europe/Berlin', US: 'America/New_York', CA: 'America/Toronto', AU: 'Australia/Sydney' };
const localHour = (cc) => { try { return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: TZ[cc] || 'Asia/Beirut' }).format(new Date())) % 24; } catch (e) { return 12; } };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/** Everything we could say to this person right now. Real situations first, general invitations after. */
async function optionsFor(sql, u, online) {
  const o = [];
  const streak = await sql`select id from dm_threads where status = 'open' and streak >= 2 and streak_day = current_date - 1 and ((a = ${u.id} and (a_day is null or a_day < current_date)) or (b = ${u.id} and (b_day is null or b_day < current_date))) limit 1`;
  if (streak.length) o.push({ t: '🔥 Your streak is about to end', b: 'Say hi today to keep it going.', url: '/#/dm/' + streak[0].id, real: true });
  const inv = await sql`select 1 from matches where kind = 'invite' and state = 'invited' and judge = ${u.id} limit 1`;
  if (inv.length) o.push({ t: '🎮 You have a game invitation', b: 'Someone is waiting for your answer.', url: '/#/dms', real: true });
  const box = await sql`select 1 from points_ledger where user_id = ${u.id} and reason = 'box' and created_at >= date_trunc('day', now())`;
  if (!box.length) o.push({ t: '🎁 Today\'s free box is ready', b: 'Open it and get your coins.', url: '/#/', real: true });
  if (u.birthdate && new Date(u.birthdate).toISOString().slice(5, 10) === new Date().toISOString().slice(5, 10)) o.push({ t: '🎂 Happy birthday!', b: 'Your gift is waiting for you.', url: '/#/', real: true });
  const rooms = await sql`select r.title, r.kind from rooms r join room_members m on m.room_id = r.id where m.user_id = ${u.id} and r.active and not exists (select 1 from notif_mutes nm where nm.user_id = ${u.id} and nm.kind = 'room' and nm.ref = r.id) and exists (select 1 from messages x where x.room_id = r.id and x.created_at > now() - interval '6 hours' and x.user_id <> ${u.id}) limit 5`;
  for (const r of rooms) o.push({ t: '💬 ' + r.title + ' has new messages', b: 'Come and see what you missed.', url: '/#/rooms', real: true });
  if (u.birthdate && Date.now() - new Date(u.birthdate).getTime() >= 18 * 365.25 * 86400000) { const so = u.socials || {}; // social accounts are for adults only
    if (!so.ig) o.push({ t: '⭐ Add your Instagram', b: 'Get 5 points for adding it to your profile.', url: '/#/settings', real: true });
    if (!so.snap) o.push({ t: '⭐ Add your Snapchat', b: 'Get 5 points for adding it to your profile.', url: '/#/settings', real: true });
    if (!so.wa) o.push({ t: '⭐ Add your WhatsApp number', b: 'Get 5 points. Only people who pay can see it.', url: '/#/settings', real: true }); }
  if (!u.selfie_ok) o.push({ t: '✅ Get your verified tick', b: 'Send a selfie and earn points.', url: '/#/settings', real: true });
  const bal = (await sql`select coalesce(sum(delta), 0)::int as n from points_ledger where user_id = ${u.id}`)[0].n;
  if (bal >= 2) o.push({ t: '⭐ You have ' + bal + ' points', b: 'You can open a Truth or Dare with them.', url: '/#/tod', real: true });
  if (online > 0) o.push({ t: '👋 We missed you!', b: online + ' people are online right now.', url: '/#/online' });
  o.push({ t: '🎮 Quick game of XO?', b: 'Play with someone random in 10 seconds.', url: '/#/match' });
  o.push({ t: '🎲 The daily question is ready', b: 'Answer and see who chose like you.', url: '/#/match' });
  o.push({ t: '✨ Something new is waiting for you', b: 'Come and take a look.', url: '/#/' });
  return o;
}

async function run(sql) {
  const online = (await sql`select count(*)::int as n from users where last_seen > now() - interval '150 seconds'`)[0].n;
  const people = await sql`select u.id, u.birthdate, u.selfie_ok, u.country, u.socials from users u
    where not u.blocked and u.profile_done and not u.nudge_off
      and (u.nudged_at is null or u.nudged_at < now() - interval '170 minutes')
      and exists (select 1 from push_subs p where p.user_id = u.id) limit 300`;
  let sent = 0;
  for (const u of people) {
    const h = localHour(u.country); if (h >= 22 || h < 9) continue; // not at night for them
    const opts = await optionsFor(sql, u, online), real = opts.filter((x) => x.real), m = pick(real.length && Math.random() < 0.7 ? real : opts);
    await sql`update users set nudged_at = now() where id = ${u.id}`;
    await pushUsers(sql, [u.id], m.t, m.b, m.url); sent++;
  }
  return { sent, people: people.length };
}

async function handle(action, ctx) {
  if (action !== 'nudge') return false;
  const { sql, req, res, bad } = ctx;
  const secret = process.env.CRON_SECRET;
  if (secret && (req.headers.authorization || '') !== 'Bearer ' + secret) throw bad('Not allowed', 403);
  res.status(200).json({ ok: true, ...(await run(sql)) });
  return true;
}
module.exports = { handle, run };
