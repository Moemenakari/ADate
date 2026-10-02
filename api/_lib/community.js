// Community engine: rooms, text-only chat, private messages inside age circles, points, referrals, reports, mutes, blocks.
// Called from api/handler.js. Every rule is enforced here on the server; the page never decides.
const webpush = require('web-push');

const CC_COUNTRY = { 961: 'LB', 966: 'SA', 971: 'AE', 974: 'QA', 965: 'KW', 973: 'BH', 968: 'OM', 962: 'JO', 963: 'SY', 964: 'IQ', 20: 'EG', 90: 'TR', 357: 'CY', 33: 'FR', 49: 'DE', 44: 'GB', 1: 'US', 55: 'BR', 61: 'AU', 46: 'SE', 39: 'IT', 34: 'ES' };
const countryOf = (phone) => { const p = String(phone || ''); for (const len of [3, 2, 1]) { const c = CC_COUNTRY[p.slice(0, len)]; if (c) return c; } return null; };
const ZODIAC = [['Capricorn', 1, 19], ['Aquarius', 2, 18], ['Pisces', 3, 20], ['Aries', 4, 19], ['Taurus', 5, 20], ['Gemini', 6, 20], ['Cancer', 7, 22], ['Leo', 8, 22], ['Virgo', 9, 22], ['Libra', 10, 22], ['Scorpio', 11, 21], ['Sagittarius', 12, 21], ['Capricorn', 13, 31]];
const zodiac = (iso) => { const [, m, d] = String(iso).split('-').map(Number); const z = ZODIAC.find(([, mm, dd]) => m < mm || (m === mm && d <= dd)); return z ? z[0] : ''; };
const dateStr = (v) => (v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : String(v || '').slice(0, 10));
const ageOf = (iso) => { const [y, m, d] = dateStr(iso).split('-').map(Number), n = new Date(); let a = n.getFullYear() - y; if (n.getMonth() + 1 < m || (n.getMonth() + 1 === m && n.getDate() < d)) a--; return a; };
const circlesOf = (age) => { const c = []; if (age >= 13 && age <= 18) c.push('13-18'); if (age >= 16 && age <= 22) c.push('16-22'); if (age >= 18) c.push('18+'); return c; };
const shareCircle = (a, b) => circlesOf(a).some((c) => circlesOf(b).includes(c));
const bandOf = (age) => (age < 16 ? '13-15' : age < 18 ? '16-17' : age < 25 ? '18-24' : age < 35 ? '25-34' : '35+');

/** Text-only chat: no links, no phone numbers, no usernames, no spam. Returns '' when fine, otherwise the reason. */
function screenText(raw, max) {
  const t = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!t) return 'Write something first';
  if (t.length > (max || 500)) return 'That is too long';
  if (/(https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(com|net|org|io|me|app|ly|gg|tv|co|lb|xyz|info|link|page|site)\b)/i.test(t)) return 'No links please';
  if (/\d[\d\s().\-+]{5,}\d/.test(t) || t.replace(/\D/g, '').length >= 8) return 'No phone numbers please';
  if (/@\w{3,}/.test(t) || /\b(snap|snapchat|insta|instagram|whats?app|telegram|tiktok|discord)\b\s*[:=@\-]\s*\w{3,}/i.test(t) || /\b(add|dm|text|message)\s+me\s+(on|at)\b/i.test(t)) return 'No usernames or contacts please';
  return '';
}

// Seasonal frames around the profile picture: 5 points, can be bought while the season runs and are kept afterwards.
const FRAMES = { halloween: { name: 'Halloween', emoji: '🎃', price: 5, from: '2026-10-01', to: '2026-11-05' }, newyear: { name: 'New Year', emoji: '🎆', price: 5, from: '2026-12-15', to: '2027-01-06' }, ramadan: { name: 'Ramadan', emoji: '🌙', price: 5, from: '2027-02-08', to: '2027-03-12' } };
const frameOpen = (f) => { const t = new Date().toISOString().slice(0, 10); return t >= f.from && t <= f.to; };
const PHOTO_PRICE = 25, SHARE_REWARD = 2, SHARE_PER_DAY = 3;
const roomPrice = (r, msgs24) => (r.free || r.kind !== 'interest' ? 0 : 10 + 5 * Math.round(3 * Math.min(1, msgs24 / 300)));
const photoOn = (u) => !!u.photo_ok && !!u.photo_until && new Date(u.photo_until) > new Date();
async function balanceOf(sql, uid) { const r = await sql`select coalesce(sum(delta), 0)::int as n from points_ledger where user_id = ${uid}`; return r[0].n; }
async function addPoints(sql, uid, delta, reason, ref) { await sql`insert into points_ledger (user_id, delta, reason, ref) values (${uid}, ${delta}, ${reason}, ${ref || null})`; }

let _vapid = false;
async function pushUsers(sql, userIds, title, body, url) {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv || !userIds.length) return;
  try {
    const subs = await sql`select endpoint, p256dh, auth from push_subs where user_id = any(${userIds})`;
    if (!_vapid) { webpush.setVapidDetails('https://adate.vercel.app', pub, priv); _vapid = true; }
    const payload = JSON.stringify({ title, body, url: url || '/#/', tag: 'adate-' + Date.now() });
    await Promise.allSettled(subs.map(async (x) => {
      try { await webpush.sendNotification({ endpoint: x.endpoint, keys: { p256dh: x.p256dh, auth: x.auth } }, payload, { TTL: 3600, timeout: 4000 }); }
      catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sql`delete from push_subs where endpoint = ${x.endpoint}`; }
    }));
  } catch (e) { console.error('push failed', e && e.message); }
}
async function notifyAdmins(sql, title, body) { const a = await sql`select id from users where is_admin and not blocked`; await pushUsers(sql, a.map((x) => x.id), title, body, '/#/admin'); }

async function handle(action, ctx) {
  const { sql, b, res, bad, userOf } = ctx, out = (j) => { res.status(200).json(j); return true; };
  const need = async () => { const u = await userOf(sql, b.session); if (!u.profile_done || !u.birthdate) throw bad('Finish your profile first', 403); return u; };
  const idNum = (v) => { const n = Number(v); if (!Number.isInteger(n) || n < 1) throw bad('Bad id'); return n; };
  const blockedPair = async (x, y) => (await sql`select 1 from blocks where (blocker = ${x} and blocked = ${y}) or (blocker = ${y} and blocked = ${x}) limit 1`).length > 0;

  switch (action) {
    /* ------------------------------------------------ the hub */
    case 'hub': {
      const u = await need(), age = ageOf(u.birthdate);
      const bal = await balanceOf(sql, u.id);
      const dm = await sql`select count(*)::int as n from dm_threads where status = 'pending' and started_by <> ${u.id} and (a = ${u.id} or b = ${u.id})`;
      const nicks = await sql`select country, nick from nicknames where user_id = ${u.id}`;
      return out({ me: { id: u.id, nick: u.nick || '', country: u.country || countryOf(u.phone), theme: u.theme || '', avatar: u.avatar || '', ref_code: u.ref_code || '', points: bal, age_band: bandOf(age), circles: circlesOf(age), muted_until: u.muted_until, is_admin: !!u.is_admin, verified: !!u.verified, nicks, photo_ok: photoOn(u), photo_until: u.photo_until || null, has_photo: !!u.photo, photo_price: PHOTO_PRICE, frame: u.frame || '', frames: (u.frames || []).filter((k) => FRAMES[k]), frame_shop: Object.entries(FRAMES).map(([key, f]) => ({ key, name: f.name, emoji: f.emoji, price: f.price, open: frameOpen(f), own: (u.frames || []).includes(key) })) }, dm_requests: dm[0].n });
    }
    /* ------------------------------------------------ nickname, theme, avatar */
    case 'nick_set': {
      const u = await need();
      const country = b.country === '*' ? '*' : String(b.country || '').toUpperCase().slice(0, 2); if (!/^(\*|[A-Z]{2})$/.test(country)) throw bad('Bad country');
      const nick = String(b.nick || '').trim();
      if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,19}$/u.test(nick)) throw bad('Nickname: 2 to 20 letters or numbers');
      const why = screenText(nick, 20); if (why) throw bad(why);
      const had = await sql`select nick from nicknames where user_id = ${u.id} and country = ${country}`;
      if (had.length && had[0].nick.toLowerCase() === nick.toLowerCase()) return out({ ok: true, nick });
      if (had.length) { if ((await balanceOf(sql, u.id)) < 10) throw bad('Changing a nickname costs 10 points', 402); }
      try { await sql`insert into nicknames (user_id, country, nick) values (${u.id}, ${country}, ${nick}) on conflict (user_id, country) do update set nick = ${nick}`; }
      catch (e) { if (e.code === '23505') throw bad('That nickname is taken here. Try another.', 409); throw e; }
      if (had.length) await addPoints(sql, u.id, -10, 'nick', country);
      if (country === '*') await sql`update users set nick = ${nick} where id = ${u.id}`;
      return out({ ok: true, nick });
    }
    case 'me_set': {
      const u = await need();
      const theme = b.theme == null ? u.theme : String(b.theme).slice(0, 30); if (theme && !/^[a-z0-9-]{1,30}$/.test(theme)) throw bad('Bad theme');
      const frame = b.frame == null ? u.frame : String(b.frame); if (frame && !(u.frames || []).includes(frame)) throw bad('Buy that frame first', 402);
      const avatar = b.avatar == null ? u.avatar : String(b.avatar).slice(0, 40); if (avatar && !/^(cartoon|animal):[a-z0-9-]{1,30}$/.test(avatar) && avatar !== u.avatar) throw bad('Bad avatar');
      await sql`update users set theme = ${theme || null}, avatar = ${avatar || null}, frame = ${frame || null} where id = ${u.id}`;
      return out({ ok: true });
    }
    case 'profile_view': {
      const u = await need(), id = idNum(b.user_id);
      const r = await sql`select id, nick, country, birthdate, interests, theme, avatar, photo, photo_ok, photo_until, frame, verified, blocked from users where id = ${id}`;
      if (!r.length || r[0].blocked) throw bad('Not found', 404);
      const t = r[0], age = ageOf(t.birthdate);
      const blockedByMe = (await sql`select 1 from blocks where blocker = ${u.id} and blocked = ${id}`).length > 0;
      return out({ id: t.id, nick: t.nick || 'Member', country: t.country, age: age >= 18 ? String(age) : bandOf(age), zodiac: zodiac(dateStr(t.birthdate)), interests: t.interests || [], theme: t.theme || '', avatar: t.avatar || '', photo: photoOn(t) ? (t.photo || '') : '', frame: t.frame || '', verified: !!t.verified, can_dm: id !== u.id && shareCircle(ageOf(u.birthdate), age), blocked: blockedByMe, me: id === u.id });
    }
    case 'photo_buy': { // a real photo costs 25 points for 30 days
      const u = await need(); if (photoOn(u)) return out({ ok: true, balance: await balanceOf(sql, u.id) });
      const bal = await balanceOf(sql, u.id); if (bal < PHOTO_PRICE) throw bad(`A real photo costs ${PHOTO_PRICE} points a month. You have ${bal}.`, 402);
      const r = await sql`update users set photo_ok = true, photo_until = now() + interval '30 days' where id = ${u.id} and (photo_until is null or photo_until <= now() or not photo_ok) returning id`;
      if (r.length) await addPoints(sql, u.id, -PHOTO_PRICE, 'photo');
      return out({ ok: true, balance: await balanceOf(sql, u.id) });
    }
    case 'photo_set': {
      const u = await need(); if (!photoOn(u)) throw bad('Get the real photo option first', 402);
      if (b.remove) { await sql`update users set photo = null where id = ${u.id}`; return out({ ok: true }); }
      const d = String(b.data || ''); if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(d) || d.length > 220000) throw bad('That picture is too big or not a picture');
      await sql`update users set photo = ${d} where id = ${u.id}`; return out({ ok: true });
    }
    case 'frame_buy': {
      const u = await need(), f = FRAMES[b.key]; if (!f) throw bad('Bad frame');
      if ((u.frames || []).includes(b.key)) return out({ ok: true });
      if (!frameOpen(f)) throw bad('This frame is not on sale right now', 403);
      const bal = await balanceOf(sql, u.id); if (bal < f.price) throw bad(`This frame costs ${f.price} points. You have ${bal}.`, 402);
      const r = await sql`update users set frames = array_append(coalesce(frames, '{}'), ${b.key}) where id = ${u.id} and not (${b.key} = any(coalesce(frames, '{}'))) returning id`;
      if (r.length) await addPoints(sql, u.id, -f.price, 'frame', b.key);
      return out({ ok: true, balance: await balanceOf(sql, u.id) });
    }
    case 'share_claim': { // sharing your link on Snapchat or any app earns points: 2 each, 3 times a day (we cannot see inside other apps, so this is a small trust reward)
      const u = await need();
      const n = await sql`select count(*)::int as n from points_ledger where user_id = ${u.id} and reason = 'share' and created_at > now() - interval '24 hours'`;
      if (n[0].n >= SHARE_PER_DAY) return out({ ok: true, earned: 0, balance: await balanceOf(sql, u.id) });
      await addPoints(sql, u.id, SHARE_REWARD, 'share');
      return out({ ok: true, earned: SHARE_REWARD, balance: await balanceOf(sql, u.id) });
    }
    /* ------------------------------------------------ points */
    case 'points': {
      const u = await need();
      const last = await sql`select max(created_at) as t, count(*) filter (where created_at > now() - interval '24 hours')::int as today from points_ledger where user_id = ${u.id} and reason = 'tick'`;
      const rows = await sql`select delta, reason, created_at as at from points_ledger where user_id = ${u.id} order by id desc limit 30`;
      const next = last[0].t ? new Date(new Date(last[0].t).getTime() + 6 * 3600e3) : new Date();
      return out({ balance: await balanceOf(sql, u.id), history: rows, next_tick_at: next, ticks_today: last[0].today });
    }
    case 'points_claim': { // +1 every 6 hours, at most 4 a day
      const u = await need();
      const last = await sql`select max(created_at) as t, count(*) filter (where created_at > now() - interval '24 hours')::int as today from points_ledger where user_id = ${u.id} and reason = 'tick'`;
      const ready = !last[0].t || Date.now() - new Date(last[0].t).getTime() >= 6 * 3600e3;
      if (ready && last[0].today < 4) await addPoints(sql, u.id, 1, 'tick');
      return out({ balance: await balanceOf(sql, u.id), claimed: ready && last[0].today < 4 });
    }
    case 'ref_join': { // a new account arrived through someone's invite link
      const u = await userOf(sql, b.session);
      const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
      if (!code || u.referred_by) return out({ ok: true });
      const inv = await sql`select id from users where ref_code = ${code} and id <> ${u.id} and not blocked`;
      if (!inv.length) return out({ ok: true });
      await sql`update users set referred_by = ${inv[0].id} where id = ${u.id} and referred_by is null`;
      await sql`insert into referrals (invited_id, inviter_id) values (${u.id}, ${inv[0].id}) on conflict do nothing`;
      return out({ ok: true });
    }
    /* ------------------------------------------------ rooms */
    case 'rooms': {
      const u = await need();
      const rows = await sql`select r.id, r.slug, r.title, r.emoji, r.kind, r.country, r.interest, r.free,
          (select count(*) from room_members m where m.room_id = r.id)::int as members,
          (select count(*) from messages x where x.room_id = r.id and x.created_at > now() - interval '24 hours')::int as msgs24,
          exists (select 1 from room_members m where m.room_id = r.id and m.user_id = ${u.id}) as member
        from rooms r where r.active order by r.id`;
      const mine = new Set(u.interests || []), country = u.country || countryOf(u.phone);
      const list = rows.map((r) => ({ ...r, price: roomPrice(r, r.msgs24), score: Math.min(100, (r.interest && mine.has(r.interest) ? 60 : 0) + (r.country && r.country === country ? 40 : 0) + Math.min(20, Math.round(r.msgs24 / 5))) }));
      list.sort((x, y) => (y.member - x.member) || (y.score - x.score) || (y.msgs24 - x.msgs24));
      return out({ rooms: list, balance: await balanceOf(sql, u.id) });
    }
    case 'room_join': {
      const u = await need(), id = idNum(b.room_id);
      const r = await sql`select r.*, (select count(*) from messages x where x.room_id = r.id and x.created_at > now() - interval '24 hours')::int as msgs24 from rooms r where r.id = ${id} and r.active`;
      if (!r.length) throw bad('Room not found', 404);
      if ((await sql`select 1 from room_members where room_id = ${id} and user_id = ${u.id}`).length) return out({ ok: true, balance: await balanceOf(sql, u.id) });
      const price = roomPrice(r[0], r[0].msgs24), bal = await balanceOf(sql, u.id);
      if (bal < price) throw bad(`This room costs ${price} points. You have ${bal}.`, 402);
      await sql`insert into room_members (room_id, user_id) values (${id}, ${u.id}) on conflict do nothing`;
      if (price) await addPoints(sql, u.id, -price, 'room', String(id));
      return out({ ok: true, price, balance: bal - price });
    }
    case 'room_leave': { const u = await need(); await sql`delete from room_members where room_id = ${idNum(b.room_id)} and user_id = ${u.id}`; return out({ ok: true }); }
    case 'msg_list': {
      const u = await need(), id = idNum(b.room_id), after = Number(b.after) || 0;
      if (!(await sql`select 1 from room_members where room_id = ${id} and user_id = ${u.id}`).length) throw bad('Join the room first', 403);
      const rows = after
        ? await sql`select m.id, m.user_id, m.nick, m.body, m.created_at as at from messages m where m.room_id = ${id} and m.id > ${after} and m.expires_at > now() and not exists (select 1 from blocks k where k.blocker = ${u.id} and k.blocked = m.user_id) order by m.id limit 100`
        : await sql`select * from (select m.id, m.user_id, m.nick, m.body, m.created_at as at from messages m where m.room_id = ${id} and m.expires_at > now() and not exists (select 1 from blocks k where k.blocker = ${u.id} and k.blocked = m.user_id) order by m.id desc limit 60) z order by id`;
      const info = after ? null : (await sql`select r.title, r.emoji, r.country, (select count(*) from room_members m where m.room_id = r.id)::int as members from rooms r where r.id = ${id}`)[0];
      return out({ messages: rows.map((m) => ({ ...m, mine: m.user_id === u.id })), room: info, muted_until: u.muted_until && new Date(u.muted_until) > new Date() ? u.muted_until : null });
    }
    case 'msg_send': {
      const u = await need(), id = idNum(b.room_id);
      if (u.muted_until && new Date(u.muted_until) > new Date()) throw bad('You are muted for a while. You can still read.', 403);
      if (!(await sql`select 1 from room_members where room_id = ${id} and user_id = ${u.id}`).length) throw bad('Join the room first', 403);
      const why = screenText(b.body); if (why) throw bad(why);
      const body = String(b.body).replace(/\s+/g, ' ').trim();
      const last = await sql`select body, created_at from messages where user_id = ${u.id} order by id desc limit 1`;
      if (last.length) { const dt = Date.now() - new Date(last[0].created_at).getTime(); if (dt < 2000) throw bad('Slow down a little', 429); if (dt < 30000 && last[0].body === body) throw bad('You just said that', 429); }
      const room = (await sql`select country from rooms where id = ${id}`)[0] || {};
      const nk = await sql`select nick from nicknames where user_id = ${u.id} and country in (${room.country || '*'}, '*') order by (country = '*') limit 1`;
      const nick = (nk[0] && nk[0].nick) || u.nick; if (!nick) throw bad('Choose a nickname first', 403);
      const r = await sql`insert into messages (room_id, user_id, nick, body) values (${id}, ${u.id}, ${nick}, ${body}) returning id`;
      await sql`delete from messages where room_id = ${id} and (expires_at < now() or id in (select id from messages where room_id = ${id} order by id desc offset 1000))`; // 3 days, or the newest 1000
      if (u.referred_by) { // the friend who invited her earns +5 once she sends her first message (max 10 a day)
        const ref = await sql`update referrals set counted = true where invited_id = ${u.id} and not counted returning inviter_id`;
        if (ref.length) { const today = await sql`select count(*)::int as n from points_ledger where user_id = ${ref[0].inviter_id} and reason = 'invite' and created_at > now() - interval '24 hours'`; if (today[0].n < 10) await addPoints(sql, ref[0].inviter_id, 5, 'invite', String(u.id)); }
      }
      return out({ ok: true, id: r[0].id });
    }
    /* ------------------------------------------------ safety */
    case 'user_block': {
      const u = await need(), id = idNum(b.user_id); if (id === u.id) throw bad('That is you');
      if (b.off) await sql`delete from blocks where blocker = ${u.id} and blocked = ${id}`; else await sql`insert into blocks (blocker, blocked) values (${u.id}, ${id}) on conflict do nothing`;
      return out({ ok: true });
    }
    case 'report': { // 3 different people reporting the same member in 24 hours mutes them for 24 hours and tells the owner
      const u = await need(), mid = idNum(b.message_id), dm = b.kind === 'dm';
      const m = dm ? await sql`select x.id, x.from_user as user_id, x.body, null::bigint as room_id from dm_messages x join dm_threads t on t.id = x.thread_id where x.id = ${mid} and (t.a = ${u.id} or t.b = ${u.id})`
        : await sql`select id, user_id, body, room_id from messages where id = ${mid}`;
      if (!m.length || m[0].user_id === u.id) throw bad('Not found', 404);
      const target = m[0].user_id;
      if (!(await sql`select 1 from reports where reporter = ${u.id} and target = ${target} and created_at > now() - interval '24 hours'`).length)
        await sql`insert into reports (reporter, target, where_kind, room_id, body) values (${u.id}, ${target}, ${dm ? 'dm' : 'room'}, ${m[0].room_id}, ${m[0].body})`;
      const n = await sql`select count(distinct reporter)::int as n from reports where target = ${target} and created_at > now() - interval '24 hours'`;
      let muted = false;
      if (n[0].n >= 3) {
        const t = (await sql`select id, nick, muted_until from users where id = ${target}`)[0];
        if (!t.muted_until || new Date(t.muted_until) < new Date()) { await sql`update users set muted_until = now() + interval '24 hours' where id = ${target}`; muted = true; await notifyAdmins(sql, '🚩 ' + (t.nick || 'A member') + ' was muted for 24 hours', '3 people reported them. Open the dashboard to review.'); }
      }
      return out({ ok: true, muted });
    }
    /* ------------------------------------------------ private messages, only inside shared age circles */
    case 'dm_list': {
      const u = await need();
      const rows = await sql`select t.id, t.status, t.started_by, case when t.a = ${u.id} then t.b else t.a end as other,
          (select nick from users where id = case when t.a = ${u.id} then t.b else t.a end) as nick,
          (select body from dm_messages x where x.thread_id = t.id order by id desc limit 1) as last_body,
          (select max(created_at) from dm_messages x where x.thread_id = t.id) as last_at
        from dm_threads t where (t.a = ${u.id} or t.b = ${u.id}) and t.status <> 'declined' order by last_at desc nulls last limit 100`;
      return out({ threads: rows });
    }
    case 'dm_start': {
      const u = await need(), to = idNum(b.to); if (to === u.id) throw bad('That is you');
      const t = await sql`select id, birthdate, blocked, muted_until, profile_done from users where id = ${to}`;
      if (!t.length || t[0].blocked || !t[0].profile_done) throw bad('Not found', 404);
      if (!shareCircle(ageOf(u.birthdate), ageOf(t[0].birthdate))) throw bad('You can only message people in your age circles', 403);
      if (await blockedPair(u.id, to)) throw bad('You cannot message this person', 403);
      if (u.muted_until && new Date(u.muted_until) > new Date()) throw bad('You are muted for a while', 403);
      const why = screenText(b.body); if (why) throw bad(why);
      const a = Math.min(u.id, to), c = Math.max(u.id, to);
      let th = await sql`select * from dm_threads where a = ${a} and b = ${c}`;
      if (!th.length) th = await sql`insert into dm_threads (a, b, started_by) values (${a}, ${c}, ${u.id}) returning *`;
      const T = th[0];
      if (T.status === 'declined') throw bad('This person is not taking messages from you', 403);
      if (T.status === 'pending') { if (T.started_by === u.id) { const n = await sql`select count(*)::int as n from dm_messages where thread_id = ${T.id} and from_user = ${u.id}`; if (n[0].n >= 1) throw bad('Wait until they accept your message', 403); } else await sql`update dm_threads set status = 'open' where id = ${T.id}`; }
      await sql`insert into dm_messages (thread_id, from_user, body) values (${T.id}, ${u.id}, ${String(b.body).replace(/\s+/g, ' ').trim()})`;
      await pushUsers(sql, [to], '💬 ' + (u.nick || 'Someone') + ' sent you a message', 'Open ADate to read it.', '/#/dms');
      return out({ ok: true, thread: T.id });
    }
    case 'dm_open': {
      const u = await need(), id = idNum(b.thread), after = Number(b.after) || 0;
      const t = await sql`select * from dm_threads where id = ${id} and (a = ${u.id} or b = ${u.id})`; if (!t.length) throw bad('Not found', 404);
      const other = t[0].a === u.id ? t[0].b : t[0].a;
      const rows = after ? await sql`select id, from_user, body, created_at as at from dm_messages where thread_id = ${id} and id > ${after} and expires_at > now() order by id limit 100`
        : await sql`select * from (select id, from_user, body, created_at as at from dm_messages where thread_id = ${id} and expires_at > now() order by id desc limit 60) z order by id`;
      const o = (await sql`select id, nick from users where id = ${other}`)[0];
      return out({ thread: { id, status: t[0].status, started_by: t[0].started_by }, other: o, messages: rows.map((m) => ({ ...m, mine: m.from_user === u.id })) });
    }
    case 'dm_send': {
      const u = await need(), id = idNum(b.thread);
      const t = await sql`select * from dm_threads where id = ${id} and (a = ${u.id} or b = ${u.id})`; if (!t.length) throw bad('Not found', 404);
      if (t[0].status !== 'open') throw bad('Wait until they accept', 403);
      const other = t[0].a === u.id ? t[0].b : t[0].a;
      if (await blockedPair(u.id, other)) throw bad('You cannot message this person', 403);
      if (u.muted_until && new Date(u.muted_until) > new Date()) throw bad('You are muted for a while', 403);
      const why = screenText(b.body); if (why) throw bad(why);
      const last = await sql`select created_at from dm_messages where from_user = ${u.id} order by id desc limit 1`;
      if (last.length && Date.now() - new Date(last[0].created_at).getTime() < 1500) throw bad('Slow down a little', 429);
      await sql`insert into dm_messages (thread_id, from_user, body) values (${id}, ${u.id}, ${String(b.body).replace(/\s+/g, ' ').trim()})`;
      await pushUsers(sql, [other], '💬 ' + (u.nick || 'Someone') + ' wrote to you', 'Open ADate to read it.', '/#/dm/' + id);
      return out({ ok: true });
    }
    case 'dm_respond': {
      const u = await need(), id = idNum(b.thread);
      const t = await sql`select * from dm_threads where id = ${id} and (a = ${u.id} or b = ${u.id}) and started_by <> ${u.id}`; if (!t.length) throw bad('Not found', 404);
      await sql`update dm_threads set status = ${b.accept ? 'open' : 'declined'} where id = ${id}`;
      if (b.block) await sql`insert into blocks (blocker, blocked) values (${u.id}, ${t[0].started_by}) on conflict do nothing`;
      return out({ ok: true });
    }
    /* ------------------------------------------------ cleanup: messages live 3 days, reports 7 days. Points and money are never touched. */
    case 'cleanup': {
      const a = await sql`delete from messages where expires_at < now() returning id`, d = await sql`delete from dm_messages where expires_at < now() returning id`, r = await sql`delete from reports where created_at < now() - interval '7 days' returning id`;
      return out({ ok: true, messages: a.length, dms: d.length, reports: r.length });
    }
    default: return false;
  }
}

/** Owner-only actions (the handler already checked the owner key). */
async function handleAdmin(action, ctx) {
  const { sql, b, res, bad } = ctx, out = (j) => { res.status(200).json(j); return true; };
  if (action === 'admin_reports') {
    const t = await sql`select u.id, u.nick, u.name, u.phone, u.muted_until, u.blocked,
        count(distinct r.reporter) filter (where r.created_at > now() - interval '24 hours')::int as today, count(distinct r.reporter)::int as week, max(r.created_at) as last_at,
        (array_agg(distinct r.body))[1:5] as bodies
      from reports r join users u on u.id = r.target where r.created_at > now() - interval '7 days' group by u.id order by max(r.created_at) desc limit 100`;
    return out({ targets: t });
  }
  if (action === 'admin_mod') {
    const id = Number(b.user_id); if (!Number.isInteger(id)) throw bad('Bad id');
    if (b.op === 'unmute') await sql`update users set muted_until = null where id = ${id}`;
    else if (b.op === 'dismiss') { await sql`delete from reports where target = ${id}`; await sql`update users set muted_until = null where id = ${id}`; }
    else if (b.op === 'mute') await sql`update users set muted_until = now() + interval '24 hours' where id = ${id}`;
    else throw bad('Bad action');
    return out({ ok: true });
  }
  return false;
}

module.exports = { handle, FRAMES, handleAdmin, screenText, circlesOf, shareCircle, ageOf, dateStr, countryOf, bandOf, zodiac };
