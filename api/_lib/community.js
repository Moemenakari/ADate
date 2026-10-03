// Community engine: rooms, text-only chat, private messages inside age circles, points, referrals, reports, mutes, blocks.
// Called from api/handler.js. Every rule is enforced here on the server; the page never decides.
const prices = require('./prices');
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



/** The friend who shared the link earns 5 points once the invited person has really joined (finished setting up the account). One reward per new account, at most 10 a day. */
async function creditReferral(sql, uid) {
  const ref = await sql`update referrals set counted = true where invited_id = ${uid} and not counted returning inviter_id`;
  if (!ref.length) return false;
  const today = (await sql`select count(*)::int as n from points_ledger where user_id = ${ref[0].inviter_id} and reason = 'invite' and created_at > now() - interval '24 hours'`)[0].n;
  if (today >= 10) return false;
  const R = (await prices.get(sql)).invite_reward;
  await addPoints(sql, ref[0].inviter_id, R, 'invite', String(uid));
  await pushUsers(sql, [ref[0].inviter_id], '⭐ Your friend joined', 'You got ' + R + ' points.', '/#/points');
  return true;
}
/** The accounts of `t` that viewer `vid` has already paid for (all of them when the whole set was opened). */
async function openSocials(sql, vid, t) {
  const so = t.socials || {}; if (!Object.keys(so).length || vid === t.id) return {};
  const rows = await sql`select kind from social_unlocks where viewer = ${vid} and target = ${t.id}`, kinds = rows.map((r) => r.kind), out = {};
  for (const k of Object.keys(so)) if (kinds.includes(k) || (kinds.includes('*') && SOC_SET.includes(k))) out[k] = so[k];
  return out;
}
/** Small things a person can still do to earn points, most useful first. Social accounts are for adults only. */
function todoOf(u, age, P) {
  const t = [], so = u.socials || {}, SO = socOf(P);
  if (!tickOf(u) && u.selfie_state !== 'pending') t.push({ k: 'selfie', text: 'Verify yourself with a selfie', points: P.selfie_reward, href: '#/settings' });
  for (const [k, name] of [['ig', 'Instagram'], ['snap', 'Snapchat'], ['tiktok', 'TikTok']]) if (!so[k]) t.push({ k, text: 'Add your ' + name, points: SO.earn[k], href: '#/settings' });
  if (age >= 18 && !so.wa) t.push({ k: 'wa', text: 'Add your WhatsApp number', points: SO.earn.wa, href: '#/settings' });
  t.push({ k: 'invite', text: 'Invite a friend', points: P.invite_reward, href: '#/points' });
  return t;
}

// Seasonal frames around the profile picture: 5 points, can be bought while the season runs and are kept afterwards.
const FRAMES = { halloween: { name: 'Halloween', emoji: '🎃', price: 5, from: '2026-10-01', to: '2026-11-05' }, newyear: { name: 'New Year', emoji: '🎆', price: 5, from: '2026-12-15', to: '2027-01-06' }, ramadan: { name: 'Ramadan', emoji: '🌙', price: 5, from: '2027-02-08', to: '2027-03-12' } };
const frameOpen = (f) => { const t = new Date().toISOString().slice(0, 10); return t >= f.from && t <= f.to; };
/** Prices come from the owner dashboard (see prices.js). */
const socOf = (P) => ({ earn: { ig: P.soc_earn_ig, snap: P.soc_earn_snap, tiktok: P.soc_earn_tiktok, wa: P.soc_earn_wa }, price: { ig: P.soc_price_ig, snap: P.soc_price_snap, tiktok: P.soc_price_tiktok, wa: P.soc_price_wa }, all: P.soc_price_all });
const SOC_SET = ['ig', 'snap', 'tiktok'];
/** Social accounts are only shown inside the same age group: under 18 with under 18, adults with adults. */
const sameGroup = (a, b) => (a >= 18) === (b >= 18);
/** Replies fast: on average within half an hour, over at least 10 replies. */
const fastOf = (u) => (u.reply_n || 0) >= 10 && Number(u.reply_secs || 0) / u.reply_n <= 1800;
const dayStr = (d) => d.toISOString().slice(0, 10);
const streakOf = (t) => { // a streak shows while it was kept yesterday or today; nothing is taken away from anyone when it stops
  const today = dayStr(new Date()), yest = dayStr(new Date(Date.now() - 86400000)), sd = t.streak_day ? dateStr(t.streak_day) : '';
  const live = (sd === today || sd === yest) ? t.streak || 0 : 0;
  return { streak: live, streak_pending: live > 0 && sd !== today };
};
/** The tick: verified by selfie, or the owner. Moderators and agents get a tag, not a tick. */
const tickOf = (u) => !!(u.selfie_ok || u.role === 'team');
const roleOf = (u) => u.role || '';
const SHARE_REWARD = 2, SHARE_PER_DAY = 3;
const roomPrice = (r, msgs24) => (r.free || r.kind !== 'interest' ? 0 : 10 + 5 * Math.round(3 * Math.min(1, msgs24 / 300)));
const UNLOCK_PRICE = 3, OPEN_PRICE = 5;
const threadLocked = (t) => !!(!t.unlocked && ((t.source === 'match' && t.unlock_until && new Date(t.unlock_until) < new Date()) || t.source === 'gate'));
const unlockPrice = (t) => (t.source === 'gate' ? 2 : UNLOCK_PRICE);
const photoOn = (u) => (!!u.photo_ok && !!u.photo_until && new Date(u.photo_until) > new Date());
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
/** Alerts for the owner go to the phones registered from the owner dashboard (no account is an admin). */
async function pushOwner(sql, title, body, url) {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY; if (!pub || !priv) return 0;
  try {
    const subs = await sql`select endpoint, p256dh, auth from admin_subs`;
    if (!_vapid) { webpush.setVapidDetails('https://adate.vercel.app', pub, priv); _vapid = true; }
    const payload = JSON.stringify({ title, body, url: url || '/#/admin', tag: 'adate-owner-' + Date.now() });
    await Promise.allSettled(subs.map(async (x) => { try { await webpush.sendNotification({ endpoint: x.endpoint, keys: { p256dh: x.p256dh, auth: x.auth } }, payload, { TTL: 3600, timeout: 4000 }); } catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sql`delete from admin_subs where endpoint = ${x.endpoint}`; } }));
    return subs.length;
  } catch (e) { console.error('owner push failed', e && e.message); return 0; }
}
const notifyAdmins = (sql, title, body) => pushOwner(sql, title, body, '/#/admin');

async function handle(action, ctx) {
  const { sql, b, res, bad, userOf } = ctx, out = (j) => { res.status(200).json(j); return true; };
  const P = await prices.get(sql);
  const need = async () => { const u = await userOf(sql, b.session); if (!u.profile_done || !u.birthdate) throw bad('Finish your profile first', 403); return u; };
  const idNum = (v) => { const n = Number(v); if (!Number.isInteger(n) || n < 1) throw bad('Bad id'); return n; };
  const blockedPair = async (x, y) => (await sql`select 1 from blocks where (blocker = ${x} and blocked = ${y}) or (blocker = ${y} and blocked = ${x}) limit 1`).length > 0;

  switch (action) {
    /* ------------------------------------------------ the hub */
    case 'hub': {
      const u = await need(), age = ageOf(u.birthdate);
      { const t0 = new Date(), md = String(t0.getMonth() + 1).padStart(2, '0') + '-' + String(t0.getDate()).padStart(2, '0'); // birthday: +10 points and a message from the team, once a year
        if (dateStr(u.birthdate).slice(5) === md) { const gift = await sql`insert into points_ledger (user_id, delta, reason, ref) select ${u.id}, 10, 'birthday', ${String(t0.getFullYear())} where not exists (select 1 from points_ledger where user_id = ${u.id} and reason = 'birthday' and ref = ${String(t0.getFullYear())}) returning id`;
          if (gift.length) await sql`insert into notices (user_id, body, points) values (${u.id}, 'Happy birthday 🎂 from the Oppa HUB team! Here is a little gift.', 10)`; } }
      const bal = await balanceOf(sql, u.id);
      const dm = await sql`select count(*)::int as n from dm_threads where status = 'pending' and started_by <> ${u.id} and (a = ${u.id} or b = ${u.id})`;
      const nicks = await sql`select country, nick from nicknames where user_id = ${u.id}`;
      return out({ me: { id: u.id, nick: u.nick || '', country: u.country || countryOf(u.phone), theme: u.theme || '', avatar: u.avatar || '', ref_code: u.ref_code || '', points: bal, age_band: bandOf(age), circles: circlesOf(age), muted_until: u.muted_until, is_admin: !!u.is_admin, photo: photoOn(u) && u.photo ? u.photo : '', todo: todoOf(u, age, P), nudge_off: !!u.nudge_off, birthday_left: Math.max(0, 2 - (u.birthday_changes || 0)), verified: !!u.verified, nicks, photo_ok: photoOn(u), photo_until: u.photo_until || null, selfie_ok: tickOf(u), role: roleOf(u), has_photo: !!u.photo, photo_price: P.photo_price, frame: u.frame || '', frames: (u.frames || []).filter((k) => FRAMES[k]), frame_shop: Object.entries(FRAMES).map(([key, f]) => ({ key, name: f.name, emoji: f.emoji, price: f.price, open: frameOpen(f), own: (u.frames || []).includes(key) })) }, dm_requests: dm[0].n });
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
      const r = await sql`select id, nick, country, birthdate, interests, theme, avatar, photo, photo_ok, photo_until, frame, verified, selfie_ok, is_admin, role, socials, reply_n, reply_secs, blocked from users where id = ${id}`;
      if (!r.length || r[0].blocked) throw bad('Not found', 404);
      const t = r[0], age = ageOf(t.birthdate);
      const blockedByMe = (await sql`select 1 from blocks where blocker = ${u.id} and blocked = ${id}`).length > 0;
      if (id !== u.id && !(await blockedPair(u.id, id))) { // someone opened this profile: remember it, and tell them (at most one notice every 2 hours)
        const seen = await sql`select 1 from profile_views where viewer = ${u.id} and target = ${id} and created_at > now() - interval '24 hours'`;
        if (!seen.length) { const recent = await sql`select 1 from profile_views where target = ${id} and notified and created_at > now() - interval '2 hours'`; const tell = !recent.length;
          await sql`insert into profile_views (viewer, target, notified) values (${u.id}, ${id}, ${tell})`;
          if (tell) await pushUsers(sql, [id], '👀 Someone viewed your profile', 'Open Views to see who. It costs 1 star.', '/#/views'); } }
      return out({ id: t.id, nick: t.nick || 'Member', country: t.country, age: age >= 18 ? String(age) : bandOf(age), zodiac: zodiac(dateStr(t.birthdate)), interests: t.interests || [], theme: t.theme || '', avatar: t.avatar || '', photo: photoOn(t) ? (t.photo || '') : '', frame: t.frame || '', verified: !!t.verified, selfie_ok: tickOf(t), role: roleOf(t), fast: fastOf(t), can_socials: sameGroup(ageOf(u.birthdate), ageOf(t.birthdate)) && !!(t.socials && Object.keys(t.socials).length), socials_have: sameGroup(ageOf(u.birthdate), ageOf(t.birthdate)) && id !== u.id ? Object.keys(t.socials || {}) : [], socials_open: await openSocials(sql, u.id, t), soc_price: { ...socOf(P).price, all: P.soc_price_all }, can_dm: id !== u.id && shareCircle(ageOf(u.birthdate), age), blocked: blockedByMe, me: id === u.id });
    }
    case 'photo_buy': { // a real photo costs 25 points for 30 days
      const u = await need(); if (photoOn(u)) return out({ ok: true, balance: await balanceOf(sql, u.id) });
      const bal = await balanceOf(sql, u.id); if (bal < P.photo_price) throw bad(`A real photo costs ${P.photo_price} points a month. You have ${bal}.`, 402);
      const r = await sql`update users set photo_ok = true, photo_until = now() + interval '30 days' where id = ${u.id} and (photo_until is null or photo_until <= now() or not photo_ok) returning id`;
      if (r.length) await addPoints(sql, u.id, -P.photo_price, 'photo');
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
      if (!code || u.referred_by || u.profile_done) return out({ ok: true }); // only brand-new accounts count
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
      return out({ ok: true, id: r[0].id });
    }
    /* ------------------------------------------------ safety */
    case 'selfie_state': { // am I verified by selfie, is one waiting, and which number of fingers to show
      const u = await need();
      let code = u.selfie_code;
      if (!u.selfie_ok && !code) { code = 1 + Math.floor(Math.random() * 5); await sql`update users set selfie_code = ${code} where id = ${u.id}`; }
      return out({ ok: !!u.selfie_ok, state: u.selfie_ok ? 'approved' : u.selfie_state, code: u.selfie_ok ? null : code, reward: P.selfie_reward });
    }
    case 'selfie_submit': { // the picture is only for the owner to look at once, then it is deleted
      const u = await need();
      if (u.selfie_ok) throw bad('You are already verified');
      if (u.selfie_state === 'pending') throw bad('Your selfie is waiting to be checked', 409);
      const d = String(b.data || ''); if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(d) || d.length > 260000) throw bad('That picture is too big or not a picture');
      await sql`update users set selfie = ${d}, selfie_state = 'pending', selfie_at = now() where id = ${u.id}`;
      await notifyAdmins(sql, '🤳 A selfie is waiting', (u.nick || 'Someone') + ' wants to be verified.');
      return out({ ok: true });
    }
    case 'social_get': { // my own social accounts; everyone can add Instagram, Snapchat and TikTok, WhatsApp only adults
      const u = await need(), adult = ageOf(u.birthdate) >= 18;
      return out({ allowed: true, adult, socials: u.socials || {}, earn: socOf(P).earn });
    }
    case 'social_set': { // adding an account earns points, once per account
      const u = await need(), adult = ageOf(u.birthdate) >= 18;
      const cur = Object.assign({}, u.socials || {}), added = [];
      for (const key of ['ig', 'snap', 'tiktok', 'wa']) {
        if (b[key] === undefined) continue; const v = String(b[key] || '').trim().replace(/^@/, '');
        if (key === 'wa' && !adult) { if (v) throw bad('A phone number can only be added by adults', 403); continue; }
        if (!v) { delete cur[key]; continue; }
        if (key === 'wa' ? !/^\d{7,15}$/.test(v) : !/^[A-Za-z0-9._]{2,30}$/.test(v)) throw bad(key === 'wa' ? 'Write the WhatsApp number with digits only' : 'That username does not look right');
        if (cur[key] !== v) { if (!cur[key]) added.push(key); cur[key] = v; }
      }
      await sql`update users set socials = ${JSON.stringify(cur)}::jsonb where id = ${u.id}`;
      for (const key of added) await sql`insert into points_ledger (user_id, delta, reason, ref) select ${u.id}, ${socOf(P).earn[key]}, 'social', ${key} where not exists (select 1 from points_ledger where user_id = ${u.id} and reason = 'social' and ref = ${key})`;
      return out({ ok: true, socials: cur, balance: await balanceOf(sql, u.id) });
    }
    case 'social_view': { // open one account (10 points, WhatsApp 100) or Instagram, Snapchat and TikTok together (20); only inside the same age group
      const u = await need(), id = idNum(b.user_id);
      const t = (await sql`select id, nick, birthdate, socials, blocked from users where id = ${id}`)[0]; if (!t || t.blocked || !t.socials || !Object.keys(t.socials).length) throw bad('Nothing to show', 404);
      if (!sameGroup(ageOf(u.birthdate), ageOf(t.birthdate))) throw bad('Not available', 403);
      if (id === u.id || await blockedPair(u.id, id)) throw bad('Not available', 403);
      const key = String(b.key || '*'); if (key !== '*' && !t.socials[key]) throw bad('They have not added that one', 404);
      const open = await openSocials(sql, u.id, t), all = Object.keys(t.socials).filter((k) => SOC_SET.includes(k));
      const need2 = key === '*' ? all.filter((k) => !open[k]) : open[key] ? [] : [key];
      if (need2.length) {
        const price = key === '*' ? P.soc_price_all : socOf(P).price[key], bal = await balanceOf(sql, u.id);
        if (bal < price) throw bad(`${key === '*' ? 'Seeing all their accounts' : 'Seeing this account'} costs ${price} points. You have ${bal}.`, 402);
        await addPoints(sql, u.id, -price, 'social_view', String(id) + ':' + key);
        await sql`insert into social_unlocks (viewer, target, kind) values (${u.id}, ${id}, ${key}) on conflict do nothing`;
      }
      return out({ ok: true, nick: t.nick, socials_open: await openSocials(sql, u.id, t), balance: await balanceOf(sql, u.id) });
    }
    case 'views_feed': { // everybody who opened my profile or liked me lately. Names stay hidden until I open one for 1 star.
      const u = await need();
      const rows = await sql`select x.id, x.nick, x.avatar, x.frame, x.photo, x.photo_ok, x.photo_until, x.is_admin, x.birthdate, x.country, x.selfie_ok, x.role,
          greatest(coalesce(pv.at, 'epoch'), coalesce(sw.at, 'epoch')) as at, (pv.at is not null) as viewed, coalesce(sw.act, '') as liked,
          exists (select 1 from view_reveals r where r.user_id = ${u.id} and r.viewer = x.id) as revealed
        from users x
        left join (select viewer, max(created_at) as at from profile_views where target = ${u.id} and created_at > now() - interval '30 days' group by viewer) pv on pv.viewer = x.id
        left join (select from_user, act, created_at as at from swipes where to_user = ${u.id} and act in ('invite', 'boost') and created_at > now() - interval '30 days') sw on sw.from_user = x.id
        where x.id <> ${u.id} and not x.blocked and x.nick is not null and (pv.at is not null or sw.at is not null)
          and not exists (select 1 from blocks bl where (bl.blocker = ${u.id} and bl.blocked = x.id) or (bl.blocker = x.id and bl.blocked = ${u.id}))
        order by at desc limit 50`;
      const today = rows.filter((r) => Date.now() - new Date(r.at).getTime() < 86400000).length;
      return out({ today, price: P.view_reveal, views: rows.map((r) => { const base = { id: r.id, at: r.at, viewed: r.viewed, liked: r.liked, age_band: bandOf(ageOf(r.birthdate)), country: r.country || '', revealed: r.revealed };
        return r.revealed ? { ...base, nick: r.nick, avatar: r.avatar || '', frame: r.frame || '', photo: photoOn(r) ? (r.photo || '') : '', selfie_ok: tickOf(r), role: roleOf(r) } : base; }) });
    }
    case 'view_reveal': { // 1 star to see who it is; kept for good
      const u = await need(), id = idNum(b.viewer);
      const seen = await sql`select 1 from profile_views where viewer = ${id} and target = ${u.id} union select 1 from swipes where from_user = ${id} and to_user = ${u.id} and act in ('invite', 'boost') limit 1`;
      if (!seen.length || await blockedPair(u.id, id)) throw bad('Not found', 404);
      const had = await sql`select 1 from view_reveals where user_id = ${u.id} and viewer = ${id}`;
      if (!had.length) {
        const bal = await balanceOf(sql, u.id); if (bal < P.view_reveal) throw bad('Seeing who it is costs ' + P.view_reveal + ' star(s). You have ' + bal + '.', 402);
        const ins = await sql`insert into view_reveals (user_id, viewer) values (${u.id}, ${id}) on conflict do nothing returning viewer`;
        if (ins.length) await addPoints(sql, u.id, -P.view_reveal, 'view_reveal', String(id));
      }
      const t = (await sql`select id, nick, avatar, frame, photo, photo_ok, photo_until, is_admin, birthdate, selfie_ok, role from users where id = ${id}`)[0];
      return out({ ok: true, balance: await balanceOf(sql, u.id), person: { id: t.id, nick: t.nick, avatar: t.avatar || '', frame: t.frame || '', photo: photoOn(t) ? (t.photo || '') : '', selfie_ok: tickOf(t), role: roleOf(t), age_band: bandOf(ageOf(t.birthdate)) } });
    }
    case 'box_state': { // a free surprise once a day: 1 to 5 points, nothing to buy
      const u = await need();
      const t = await sql`select 1 from points_ledger where user_id = ${u.id} and reason = 'box' and created_at >= date_trunc('day', now())`;
      return out({ available: !t.length });
    }
    case 'box_open': {
      const u = await need();
      const prize = [1, 1, 1, 2, 2, 3, 5][Math.floor(Math.random() * 7)];
      const r = await sql`insert into points_ledger (user_id, delta, reason, ref) select ${u.id}, ${prize}, 'box', null where not exists (select 1 from points_ledger where user_id = ${u.id} and reason = 'box' and created_at >= date_trunc('day', now())) returning id`;
      if (!r.length) throw bad('Come back tomorrow for the next one', 409);
      return out({ ok: true, prize, balance: await balanceOf(sql, u.id) });
    }
    case 'birthday_set': { // a person can correct their birthday twice; it can never move a person under 18 into the adult group
      const u = await need(), d = String(b.birthdate || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(new Date(d))) throw bad('Pick your birthday');
      const now = ageOf(u.birthdate), next = ageOf(d);
      if (next < 13) throw bad('Oppa HUB is for ages 13 and up'); if (next > 100) throw bad('That birthday does not look right');
      if ((u.birthday_changes || 0) >= 2) throw bad('You already changed your birthday twice. Write to the team in the support chat if it is still wrong.', 403);
      if (now < 18 && next >= 18) throw bad('To move to the adult group, write to the team in the support chat.', 403);
      await sql`update users set birthdate = ${d}::date, birthday_changes = birthday_changes + 1 where id = ${u.id}`;
      return out({ ok: true, age_band: bandOf(next), left: 1 - (u.birthday_changes || 0) });
    }
    case 'mute_get': { const u = await need(); return out({ muted: (await sql`select 1 from notif_mutes where user_id = ${u.id} and kind = ${b.kind === 'room' ? 'room' : 'dm'} and ref = ${idNum(b.id)}`).length > 0 }); }
    case 'mute_set': {
      const u = await need(), kind = b.kind === 'room' ? 'room' : 'dm', ref = idNum(b.id);
      if (b.on) await sql`insert into notif_mutes (user_id, kind, ref) values (${u.id}, ${kind}, ${ref}) on conflict do nothing`; else await sql`delete from notif_mutes where user_id = ${u.id} and kind = ${kind} and ref = ${ref}`;
      return out({ ok: true });
    }
    case 'nudge_set': { // switch the reminder notifications on or off
      const u = await need();
      await sql`update users set nudge_off = ${!!b.off} where id = ${u.id}`;
      return out({ ok: true });
    }
    case 'notices_list': { // messages from the Oppa HUB team that I have not dismissed
      const u = await need();
      const rows = await sql`select id, body, points, created_at as at from notices where user_id = ${u.id} and not read order by id desc limit 10`;
      return out({ notices: rows });
    }
    case 'notice_read': {
      const u = await need();
      await sql`update notices set read = true where id = ${idNum(b.id)} and user_id = ${u.id}`;
      return out({ ok: true });
    }
    case 'install_claim': { // +10 points once, for opening Oppa HUB from the home screen
      const u = await need();
      const r = await sql`insert into points_ledger (user_id, delta, reason, ref) select ${u.id}, 10, 'install', null where not exists (select 1 from points_ledger where user_id = ${u.id} and reason = 'install') returning id`;
      return out({ ok: true, claimed: r.length > 0, balance: await balanceOf(sql, u.id) });
    }
    case 'blocks_list': {
      const u = await need();
      const rows = await sql`select x.blocked as id, coalesce(t.nick, 'Member') as nick, t.avatar from blocks x join users t on t.id = x.blocked where x.blocker = ${u.id} order by x.created_at desc limit 100`;
      return out({ blocked: rows });
    }
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
      const rows = await sql`select t.id, t.status, t.started_by, t.boosted, t.source, t.unlocked, t.streak, t.streak_day, case when t.a = ${u.id} then t.b else t.a end as other,
          (select nick from users where id = case when t.a = ${u.id} then t.b else t.a end) as nick,
          (select body from dm_messages x where x.thread_id = t.id order by id desc limit 1) as last_body,
          (select max(created_at) from dm_messages x where x.thread_id = t.id) as last_at
        from dm_threads t where (t.a = ${u.id} or t.b = ${u.id}) and t.status <> 'declined' order by last_at desc nulls last limit 100`;
      return out({ threads: rows.map((r) => { const s = streakOf(r); delete r.streak_day; return { ...r, ...s }; }) });
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
      await pushUsers(sql, [to], '💬 ' + (u.nick || 'Someone') + ' sent you a message', 'Open Oppa HUB to read it.', '/#/dms');
      return out({ ok: true, thread: T.id });
    }
    case 'support_open': { // a private chat with the Oppa Team (the owner answers from the owner dashboard); open at once, no request needed
      const u = await need();
      const adm = await sql`select id from users where phone = 'team-account' limit 1`;
      if (!adm.length) throw bad('Support is not ready yet. Use the payment options for now.', 503);
      const a = Math.min(u.id, adm[0].id), c2 = Math.max(u.id, adm[0].id);
      let th = await sql`select * from dm_threads where a = ${a} and b = ${c2}`;
      if (!th.length) { th = await sql`insert into dm_threads (a, b, started_by, status, unlocked) values (${a}, ${c2}, ${u.id}, 'open', true) returning *`; await pushOwner(sql, '💬 Someone wants help', (u.nick || 'A member') + ' opened the support chat.', '/#/admin'); }
      else if (th[0].status !== 'open' || !th[0].unlocked) await sql`update dm_threads set status = 'open', unlocked = true where id = ${th[0].id}`;
      return out({ thread: th[0].id });
    }
    case 'dm_open': {
      const u = await need(), id = idNum(b.thread), after = Number(b.after) || 0;
      const t = await sql`select * from dm_threads where id = ${id} and (a = ${u.id} or b = ${u.id})`; if (!t.length) throw bad('Not found', 404);
      const other = t[0].a === u.id ? t[0].b : t[0].a;
      const rows = after ? await sql`select id, from_user, body, created_at as at from dm_messages where thread_id = ${id} and id > ${after} and expires_at > now() order by id limit 100`
        : await sql`select * from (select id, from_user, body, created_at as at from dm_messages where thread_id = ${id} and expires_at > now() order by id desc limit 60) z order by id`;
      const o = (await sql`select id, nick, avatar, frame, role, selfie_ok, last_seen, reply_n, reply_secs from users where id = ${other}`)[0]; o.tick = tickOf(o); delete o.selfie_ok; o.fast = fastOf(o); delete o.reply_n; delete o.reply_secs;
      return out({ thread: { id, status: t[0].status, started_by: t[0].started_by, ...streakOf(t[0]), locked: threadLocked(t[0]), unlock_price: unlockPrice(t[0]), unlock_until: t[0].unlock_until, unlocked: !!t[0].unlocked, source: t[0].source || null }, balance: await balanceOf(sql, u.id), other: o, messages: rows.map((m) => ({ ...m, mine: m.from_user === u.id })) });
    }
    case 'dm_unlock': { // after the free hour of a match chat: one of them pays 3 points and it stays open
      const u = await need(), id = idNum(b.thread);
      const t = await sql`select * from dm_threads where id = ${id} and (a = ${u.id} or b = ${u.id})`; if (!t.length) throw bad('Not found', 404);
      if (!threadLocked(t[0])) return out({ ok: true, balance: await balanceOf(sql, u.id) });
      const price = unlockPrice(t[0]), bal = await balanceOf(sql, u.id); if (bal < price) throw bad(`Unlocking costs ${price} points. You have ${bal}.`, 402);
      const r = await sql`update dm_threads set unlocked = true where id = ${id} and not unlocked returning id`;
      if (r.length) await addPoints(sql, u.id, -price, 'dm_unlock', String(id));
      const other = t[0].a === u.id ? t[0].b : t[0].a; await pushUsers(sql, [other], '💬 The chat is open again', (u.nick || 'Your friend') + ' unlocked it.', '/#/dm/' + id);
      return out({ ok: true, balance: await balanceOf(sql, u.id) });
    }
    case 'dm_pay_open': { // you wrote first and they have not answered: pay 5 points and the chat opens at once
      const u = await need(), id = idNum(b.thread);
      const t = await sql`select * from dm_threads where id = ${id} and started_by = ${u.id} and (a = ${u.id} or b = ${u.id})`; if (!t.length) throw bad('Not found', 404);
      if (t[0].status === 'open') return out({ ok: true, balance: await balanceOf(sql, u.id) });
      if (t[0].status !== 'pending') throw bad('This person is not taking messages from you', 403);
      const bal = await balanceOf(sql, u.id); if (bal < OPEN_PRICE) throw bad(`Opening the chat costs ${OPEN_PRICE} points. You have ${bal}.`, 402);
      const r = await sql`update dm_threads set status = 'open' where id = ${id} and status = 'pending' returning id`;
      if (r.length) await addPoints(sql, u.id, -OPEN_PRICE, 'dm_open', String(id));
      const other = t[0].a === u.id ? t[0].b : t[0].a; await pushUsers(sql, [other], '💬 ' + (u.nick || 'Someone') + ' opened a chat with you', 'Open Oppa HUB to read it.', '/#/dm/' + id);
      return out({ ok: true, balance: await balanceOf(sql, u.id) });
    }
    case 'dm_send': {
      const u = await need(), id = idNum(b.thread);
      const t = await sql`select * from dm_threads where id = ${id} and (a = ${u.id} or b = ${u.id})`; if (!t.length) throw bad('Not found', 404);
      if (t[0].status !== 'open') throw bad('Wait until they accept', 403);
      if (threadLocked(t[0])) throw bad(t[0].source === 'gate' ? `Open this chat for ${unlockPrice(t[0])} points first.` : `The free hour is over. Unlock this chat for ${unlockPrice(t[0])} points.`, 402);
      const other = t[0].a === u.id ? t[0].b : t[0].a;
      if (await blockedPair(u.id, other)) throw bad('You cannot message this person', 403);
      if (u.muted_until && new Date(u.muted_until) > new Date()) throw bad('You are muted for a while', 403);
      const why = screenText(b.body); if (why) throw bad(why);
      const last = await sql`select created_at from dm_messages where from_user = ${u.id} order by id desc limit 1`;
      if (last.length && Date.now() - new Date(last[0].created_at).getTime() < 1500) throw bad('Slow down a little', 429);
      const prev = await sql`select from_user, created_at from dm_messages where thread_id = ${id} order by id desc limit 1`;
      if (prev.length && prev[0].from_user !== u.id) { const secs = Math.min(21600, Math.round((Date.now() - new Date(prev[0].created_at).getTime()) / 1000)); if (secs >= 0 && secs <= 86400) await sql`update users set reply_n = reply_n + 1, reply_secs = reply_secs + ${secs} where id = ${u.id}`; }
      await sql`insert into dm_messages (thread_id, from_user, body) values (${id}, ${u.id}, ${String(b.body).replace(/\s+/g, ' ').trim()})`;
      { const today = dayStr(new Date()), yest = dayStr(new Date(Date.now() - 86400000)), isA = t[0].a === u.id; // streak: both wrote today
        const aDay = isA ? today : (t[0].a_day ? dateStr(t[0].a_day) : null), bDay = isA ? (t[0].b_day ? dateStr(t[0].b_day) : null) : today, sd = t[0].streak_day ? dateStr(t[0].streak_day) : null;
        let streak = t[0].streak || 0, newSd = sd;
        if (aDay === today && bDay === today && sd !== today) { streak = sd === yest ? streak + 1 : 1; newSd = today; }
        await sql`update dm_threads set a_day = ${aDay}, b_day = ${bDay}, streak = ${streak}, streak_day = ${newSd} where id = ${id}`; }
      if ((await sql`select 1 from users where id = ${other} and role = 'team'`).length) { await pushOwner(sql, '💬 Message to the team', (u.nick || 'Someone') + ' wrote to the team.', '/#/admin'); return out({ ok: true }); }
      if (!(await sql`select 1 from notif_mutes where user_id = ${other} and kind = 'dm' and ref = ${id}`).length) await pushUsers(sql, [other], '💬 ' + (u.nick || 'Someone') + ' wrote to you', 'Open Oppa HUB to read it.', '/#/dm/' + id);
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
      await sql`delete from match_queue where since < now() - interval '10 minutes'`; await sql`update users set selfie = null, selfie_state = 'none' where selfie_state = 'pending' and selfie_at < now() - interval '7 days'`; await sql`update orders set receipt = null where receipt is not null and status in ('paid', 'rejected') and decided_at < now() - interval '60 days'`; await sql`delete from matches where created_at < now() - interval '3 days'`;
      const a = await sql`delete from messages where expires_at < now() returning id`, d = await sql`delete from dm_messages where expires_at < now() returning id`, r = await sql`delete from reports where created_at < now() - interval '7 days' returning id`;
      return out({ ok: true, messages: a.length, dms: d.length, reports: r.length });
    }
    default: return false;
  }
}

/** Record a report against a member; 3 different reporters in 24 hours mutes them for 24 hours. Used by rooms, DMs and random matches. */
async function reportTarget(sql, reporter, target, kind, body, roomId) {
  if (!(await sql`select 1 from reports where reporter = ${reporter} and target = ${target} and created_at > now() - interval '24 hours'`).length)
    await sql`insert into reports (reporter, target, where_kind, room_id, body) values (${reporter}, ${target}, ${kind}, ${roomId || null}, ${String(body || '').slice(0, 500)})`;
  await notifyAdmins(sql, '🚩 New report', 'Someone reported a member. Open Reports to review.');
  const n = await sql`select count(distinct reporter)::int as n from reports where target = ${target} and created_at > now() - interval '24 hours'`;
  let muted = false;
  if (n[0].n >= 3) {
    const t = (await sql`select id, nick, muted_until from users where id = ${target}`)[0];
    if (t && (!t.muted_until || new Date(t.muted_until) < new Date())) { await sql`update users set muted_until = now() + interval '24 hours' where id = ${target}`; muted = true; await notifyAdmins(sql, '🚩 ' + (t.nick || 'A member') + ' was muted for 24 hours', '3 people reported them. Open the dashboard to review.'); }
  }
  return muted;
}

/** Owner-only actions (the handler already checked the owner key). */
async function handleAdmin(action, ctx) {
  const { sql, b, res, bad } = ctx, out = (j) => { res.status(200).json(j); return true; };
  if (action === 'admin_test_push') { // the owner checks that alerts reach the phone
    const n = await pushOwner(sql, '✅ Test alert', 'If you can read this, owner alerts work on this phone.', '/#/admin');
    return out({ ok: true, devices: n });
  }
  if (action === 'admin_hosts') { // the official accounts: how active they are, and their points
    const rows = await sql`select u.id, u.nick, u.role, u.last_seen, u.photo_ok, (select coalesce(sum(delta), 0)::int from points_ledger l where l.user_id = u.id) as points,
        (select count(*)::int from dm_messages x where x.from_user = u.id and x.created_at > now() - interval '7 days') as dm7,
        (select count(*)::int from messages x where x.user_id = u.id and x.created_at > now() - interval '7 days') as room7,
        (select count(*)::int from match_msgs x where x.from_user = u.id and x.created_at > now() - interval '7 days') as match7
      from users u where u.role in ('host', 'bot') order by u.role, u.nick limit 100`;
    return out({ hosts: rows.map((r) => ({ ...r, messages7: r.dm7 + r.room7 + r.match7 })) });
  }
  if (action === 'admin_selfies') {
    const rows = await sql`select id, nick, name, first_name, last_name, phone, selfie as data, selfie_code as code, selfie_at as at from users where selfie_state = 'pending' and selfie is not null order by selfie_at limit 30`;
    return out({ selfies: rows });
  }
  if (action === 'admin_selfie_decide') { // approve: badge + points; either way the picture is erased now
    const uid = Number(b.user_id); if (!Number.isInteger(uid) || uid < 1) throw bad('Bad user');
    const t = await sql`select id from users where id = ${uid} and selfie_state = 'pending'`; if (!t.length) throw bad('Nothing waiting', 404);
    if (b.approve) {
      await sql`update users set selfie_ok = true, selfie_state = 'approved', selfie = null where id = ${uid}`;
      await sql`insert into points_ledger (user_id, delta, reason, ref) select ${uid}, ${(await prices.get(sql)).selfie_reward}, 'selfie', null where not exists (select 1 from points_ledger where user_id = ${uid} and reason = 'selfie')`;
      await sql`insert into notices (user_id, body, points) values (${uid}, 'You are now verified by selfie ✓ Thank you!', ${(await prices.get(sql)).selfie_reward})`;
      await pushUsers(sql, [uid], '✅ You are verified', `Your selfie was accepted. +${(await prices.get(sql)).selfie_reward} points.`, '/#/');
    } else {
      await sql`update users set selfie_state = 'rejected', selfie = null, selfie_code = ${1 + Math.floor(Math.random() * 5)} where id = ${uid}`;
      await sql`insert into notices (user_id, body, points) values (${uid}, 'Your selfie was not accepted. Try again: your face clear and the right number of fingers.', 0)`;
      await pushUsers(sql, [uid], '🤳 Selfie not accepted', 'Please try again from Settings.', '/#/settings');
    }
    return out({ ok: true });
  }
  if (action === 'admin_gift') { // the owner thanks someone: points (or a deduction) and a message from the team
    const uid = Number(b.user_id), pts = Math.trunc(Number(b.points) || 0), msg = String(b.message || '').trim().slice(0, 300);
    if (!Number.isInteger(uid) || uid < 1) throw bad('Bad user');
    if (Math.abs(pts) > 1000000) throw bad('Too many points');
    if (!pts && !msg) throw bad('Write a message or choose points');
    const t = await sql`select id from users where id = ${uid}`; if (!t.length) throw bad('Not found', 404);
    const body = msg || (pts > 0 ? 'Thank you for being great! Here are some points.' : 'Your points were adjusted.');
    const n = await sql`insert into notices (user_id, body, points) values (${uid}, ${body}, ${pts}) returning id`;
    if (pts) await addPoints(sql, uid, pts, 'gift', String(n[0].id));
    await pushUsers(sql, [uid], '🎁 A message from the Oppa HUB team', pts > 0 ? `${body} (+${pts} points)` : body, '/#/');
    return out({ ok: true, balance: await balanceOf(sql, uid) });
  }
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

module.exports = { handle, notifyAdmins, pushOwner, creditReferral, reportTarget, pushUsers, photoOn, tickOf, roleOf, fastOf, FRAMES, handleAdmin, screenText, circlesOf, shareCircle, ageOf, dateStr, countryOf, bandOf, zodiac };
