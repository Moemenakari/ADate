// The owner dashboard backend. Every action here is protected by the owner key (checked in handler.js); no account is an admin.
const prices = require('./prices');
const { pushUsers, pushOwner, ageOf, bandOf } = require('./community');

const ACTIONS = ['admin_overview', 'admin_people', 'admin_user_delete', 'admin_support_list', 'admin_support_thread', 'admin_support_reply', 'admin_push_save', 'admin_prices', 'admin_price_set'];

async function handle(action, ctx) {
  if (!ACTIONS.includes(action)) return false;
  const { sql, b, res, bad } = ctx, out = (j) => { res.status(200).json(j); return true; };
  const team = async () => { const r = await sql`select id from users where phone = 'team-account' limit 1`; if (!r.length) throw bad('The team account is missing', 500); return r[0].id; };

  if (action === 'admin_overview') {
    const one = async (q) => (await q)[0].n;
    return out({
      users: await one(sql`select count(*)::int as n from users where profile_done and role is distinct from 'team'`),
      today: await one(sql`select count(*)::int as n from users where profile_done and created_at > now() - interval '24 hours' and role is distinct from 'team'`),
      online: await one(sql`select count(*)::int as n from users where last_seen > now() - interval '150 seconds' and role is distinct from 'team'`),
      week_active: await one(sql`select count(*)::int as n from users where last_seen > now() - interval '7 days' and role is distinct from 'team'`),
      orders_waiting: await one(sql`select count(*)::int as n from orders where status = 'claimed'`),
      selfies_waiting: await one(sql`select count(*)::int as n from users where selfie_state = 'pending' and selfie is not null`),
      reports_week: await one(sql`select count(*)::int as n from reports where created_at > now() - interval '7 days'`),
      support_open: await one(sql`select count(*)::int as n from dm_threads t join users x on x.id = t.a or x.id = t.b where x.role = 'team' and exists (select 1 from dm_messages m where m.thread_id = t.id and m.from_user <> x.id and m.created_at > now() - interval '3 days')`),
      revenue_cents: await one(sql`select coalesce(sum(cents), 0)::int as n from orders where status = 'paid'`),
      paid_people: await one(sql`select count(distinct user_id)::int as n from orders where status = 'paid'`),
      points_out: await one(sql`select coalesce(sum(delta), 0)::int as n from points_ledger`),
      alert_devices: await one(sql`select count(*)::int as n from admin_subs`)
    });
  }

  if (action === 'admin_people') { // one row per person with everything the owner may want to see
    const f = String(b.filter || 'all'), q = String(b.q || '').replace(/[%_\\]/g, ' ').trim().slice(0, 40), like = '%' + q + '%';
    const rows = await sql`select * from (
        select u.id, u.nick, u.first_name, u.last_name, u.phone, u.email, u.birthdate, u.country, u.socials, u.blocked, u.verified, u.selfie_ok, u.selfie_state, u.role, u.last_seen, u.created_at,
          (select coalesce(sum(delta), 0)::int from points_ledger l where l.user_id = u.id) as points,
          (select count(*)::int from room_members m where m.user_id = u.id) as groups,
          (select count(*)::int from dm_threads t where (t.a = u.id or t.b = u.id) and t.status = 'open') as chats,
          (select count(*)::int from orders o where o.user_id = u.id and o.status = 'paid') as paid_orders,
          (select coalesce(sum(o.cents), 0)::int from orders o where o.user_id = u.id and o.status = 'paid') as paid_cents
        from users u where u.profile_done and u.role is distinct from 'team'
          and (${q} = '' or u.nick ilike ${like} or u.first_name ilike ${like} or u.last_name ilike ${like} or u.phone like ${like} or u.email ilike ${like})
      ) x
      where (${f} = 'all' or (${f} = 'verified' and (x.selfie_ok or x.verified)) or (${f} = 'unverified' and not (x.selfie_ok or x.verified)) or (${f} = 'selfie' and x.selfie_state = 'pending')
        or (${f} = 'paid' and x.paid_orders > 0) or (${f} = 'never_paid' and x.paid_orders = 0) or (${f} = 'blocked' and x.blocked) or (${f} = 'online' and x.last_seen > now() - interval '150 seconds'))
      order by x.created_at desc limit 300`;
    return out({ people: rows.map((r) => ({ id: r.id, nick: r.nick || '', name: [r.first_name, r.last_name].filter(Boolean).join(' '), phone: r.phone, email: r.email || '', age: r.birthdate ? ageOf(r.birthdate) : null, country: r.country || '', socials: r.socials || {}, blocked: !!r.blocked, verified: !!(r.selfie_ok || r.verified), selfie_state: r.selfie_state || '', role: r.role || '', last_seen: r.last_seen, joined: r.created_at, points: r.points, groups: r.groups, chats: r.chats, paid_orders: r.paid_orders, paid_cents: r.paid_cents })) });
  }

  if (action === 'admin_user_delete') { // removes an account and everything that belongs to it; the owner types DELETE
    const id = Number(b.user_id); if (!Number.isInteger(id) || id < 1) throw bad('Bad id');
    if (String(b.confirm) !== 'DELETE') throw bad('Type DELETE to confirm');
    const t = await sql`select id, role from users where id = ${id}`; if (!t.length) throw bad('No such account', 404);
    if (t[0].role === 'team') throw bad('The team account cannot be deleted', 403);
    await sql`delete from users where id = ${id}`;
    return out({ ok: true });
  }

  if (action === 'admin_support_list') { // everyone who has written to the team
    const tid = await team();
    const rows = await sql`select t.id as thread, x.id as user_id, x.nick, x.first_name, x.phone,
        (select body from dm_messages m where m.thread_id = t.id order by m.id desc limit 1) as last_body,
        (select from_user from dm_messages m where m.thread_id = t.id order by m.id desc limit 1) as last_from,
        (select max(created_at) from dm_messages m where m.thread_id = t.id) as last_at
      from dm_threads t join users x on x.id = case when t.a = ${tid} then t.b else t.a end where (t.a = ${tid} or t.b = ${tid}) order by last_at desc nulls last limit 100`;
    return out({ threads: rows.map((r) => ({ thread: r.thread, user_id: r.user_id, nick: r.nick || r.first_name || ('+' + r.phone), phone: r.phone, last_body: r.last_body || '', waiting: !!r.last_body && r.last_from !== tid, last_at: r.last_at })) });
  }
  if (action === 'admin_support_thread') {
    const tid = await team(), th = Number(b.thread);
    const t = await sql`select * from dm_threads where id = ${th} and (a = ${tid} or b = ${tid})`; if (!t.length) throw bad('Not found', 404);
    const msgs = await sql`select id, from_user, body, created_at as at from dm_messages where thread_id = ${th} order by id desc limit 80`;
    return out({ messages: msgs.reverse().map((m) => ({ id: m.id, mine: m.from_user === tid, body: m.body, at: m.at })) });
  }
  if (action === 'admin_support_reply') { // the owner answers as "Oppa Team"
    const tid = await team(), th = Number(b.thread), body = String(b.body || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!body) throw bad('Write a message');
    const t = (await sql`select * from dm_threads where id = ${th} and (a = ${tid} or b = ${tid})`)[0]; if (!t) throw bad('Not found', 404);
    await sql`insert into dm_messages (thread_id, from_user, body) values (${th}, ${tid}, ${body})`;
    await sql`update dm_threads set status = 'open', unlocked = true where id = ${th}`;
    await pushUsers(sql, [t.a === tid ? t.b : t.a], '💬 Oppa Team', body.slice(0, 120), '/#/dm/' + th);
    return out({ ok: true });
  }

  if (action === 'admin_push_save') { // this phone will get the owner alerts
    const e = String(b.endpoint || ''), p = String(b.p256dh || ''), a = String(b.auth || '');
    if (!/^https:\/\//.test(e) || e.length > 600 || !p || !a) throw bad('Bad subscription');
    await sql`insert into admin_subs (endpoint, p256dh, auth) values (${e}, ${p}, ${a}) on conflict (endpoint) do update set p256dh = ${p}, auth = ${a}`;
    return out({ ok: true });
  }

  if (action === 'admin_prices') {
    const P = await prices.get(sql);
    return out({ prices: Object.entries(prices.DEFAULTS).map(([key, v]) => ({ key, label: v[1], group: v[2], value: P[key], default: v[0] })) });
  }
  if (action === 'admin_price_set') {
    const k = String(b.name || ''), n = Number(b.value);
    if (!prices.DEFAULTS[k]) throw bad('Unknown price'); if (!Number.isFinite(n) || n < 0 || n > 1000000) throw bad('Write a number');
    await sql`insert into settings (key, value) values (${k}, ${String(Math.round(n))}) on conflict (key) do update set value = ${String(Math.round(n))}`;
    prices.reset();
    return out({ ok: true });
  }
  return false;
}
module.exports = { handle, ACTIONS };
