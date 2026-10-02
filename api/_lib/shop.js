// Buying points. The person pays with Whish (a link the owner shares), tells us the reference, and the owner approves it.
// Nothing here touches a card or a bank: we only record a claim and, once the owner confirms the payment, add the points.
const { pushUsers } = require('./community');
// 12 points = $2.60, 29 points = $5, 100 points = $10 (the two old packs stay known so old orders can still be settled, but are not sold any more)
const FIRST_BUY_BONUS = 10; // free points on a person's first paid order
const crypto = require('crypto');
const PRODUCTS = { points100: { cents: 1000, points: 100, label: '100 points' }, points12: { cents: 260, points: 12, label: '12 points' }, points29: { cents: 500, points: 29, label: '29 points' }, points5: { cents: 100, points: 5, label: '5 points', old: true }, points25: { cents: 500, points: 25, label: '25 points', old: true } };

/** Marks an order paid and adds the points, once. Used by the owner's Accept button and by the card webhook. */
async function settleOrder(sql, id) {
  const o = await sql`select * from orders where id = ${id} and status in ('pending', 'claimed')`;
  if (!o.length) return false;
  const p = PRODUCTS[o[0].kind]; if (!p) return false;
  const done = await sql`update orders set status = 'paid', decided_at = now() where id = ${id} and status in ('pending', 'claimed') returning id`; // claim first so two taps (or a repeated webhook) can never pay twice
  if (!done.length) return false;
  const first = !(await sql`select 1 from points_ledger where user_id = ${o[0].user_id} and reason = 'buy' limit 1`).length;
  await sql`insert into points_ledger (user_id, delta, reason, ref) values (${o[0].user_id}, ${p.points}, 'buy', ${String(id)})`;
  if (first) await sql`insert into points_ledger (user_id, delta, reason, ref) select ${o[0].user_id}, ${FIRST_BUY_BONUS}, 'first_buy', ${String(id)} where not exists (select 1 from points_ledger where user_id = ${o[0].user_id} and reason = 'first_buy')`;
  await pushUsers(sql, [o[0].user_id], '⭐ Points added', `${p.points} points are in your account.`, '/#/points');
  return true;
}

async function handle(action, ctx) {
  const { sql, b, res, bad, userOf } = ctx, out = (j) => { res.status(200).json(j); return true; };
  const need = async () => { const u = await userOf(sql, b.session); if (!u.profile_done) throw bad('Finish your profile first', 403); return u; };

  if (action === 'shop') {
    const u = await need();
    const s = await sql`select key, value from settings where key in ('whish_link', 'whish_note', 'whish_number', 'whish_link_points12', 'whish_link_points29', 'whish_link_points100', 'card_checkout_url')`;
    const orders = await sql`select id, kind, cents, status, created_at as at from orders where user_id = ${u.id} order by id desc limit 20`;
    return out({ card_ready: !!(s.find((x) => x.key === 'card_checkout_url') || {}).value, first_bonus: orders.some((x) => x.status === 'paid') ? 0 : FIRST_BUY_BONUS, products: Object.entries(PRODUCTS).filter(([, p]) => !p.old).sort((x, y) => x[1].cents - y[1].cents).map(([kind, p]) => ({ kind, cents: p.cents, points: p.points, label: p.label })), settings: Object.fromEntries(s.map((x) => [x.key, x.value])), orders });
  }
  if (action === 'order_cancel') { // the person picked the wrong pack: close an unpaid order
    const u = await need(), id = Number(b.id);
    if (!Number.isInteger(id)) throw bad('Bad id');
    await sql`update orders set status = 'rejected', decided_at = now() where id = ${id} and user_id = ${u.id} and status = 'pending'`;
    return out({ ok: true });
  }
  if (action === 'pay_card') { // sends the person to the card provider's own page; we never see the card
    const u = await need(), id = Number(b.id);
    const o = await sql`select id, kind, cents from orders where id = ${id} and user_id = ${u.id} and status in ('pending', 'claimed')`;
    if (!o.length) throw bad('Order not found', 404);
    const r = await sql`select value from settings where key = 'card_checkout_url'`;
    if (!r.length || !r[0].value) throw bad('Card payment is not ready yet. Use the Whish option for now.', 503);
    const url = r[0].value.replace('{order}', 'AD-' + o[0].id).replace('{amount}', (o[0].cents / 100).toFixed(2)).replace('{kind}', o[0].kind);
    return out({ url });
  }
  if (action === 'pay_webhook') { // the card provider tells us a payment succeeded; signed with a shared secret
    const secret = process.env.PAY_WEBHOOK_SECRET;
    if (!secret) throw bad('Not enabled', 503);
    const ref = String(b.order || '').replace(/^AD-/, ''), id = Number(ref), amount = Number(b.amount_cents), status = String(b.status || '');
    const want = crypto.createHmac('sha256', secret).update(`${b.order}.${status}.${amount}`).digest('hex');
    const got = String(b.signature || '');
    if (got.length !== want.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))) throw bad('Bad signature', 401);
    if (status !== 'paid' || !Number.isInteger(id)) return out({ ok: true, ignored: true });
    const o = await sql`select cents from orders where id = ${id}`;
    if (!o.length || amount < o[0].cents) throw bad('Amount does not match', 409);
    await settleOrder(sql, id);
    return out({ ok: true });
  }
  if (action === 'order_create') {
    const u = await need(), p = PRODUCTS[b.kind];
    if (!p) throw bad('Bad product');
    const n = await sql`select count(*)::int as n from orders where user_id = ${u.id} and status in ('pending', 'claimed')`;
    if (n[0].n >= 3) throw bad('You already have orders waiting. Wait until they are checked.', 429);
    const r = await sql`insert into orders (user_id, kind, cents) values (${u.id}, ${b.kind}, ${p.cents}) returning id`;
    return out({ id: r[0].id, ref: 'AD-' + r[0].id });
  }
  if (action === 'order_paid') {
    const u = await need(), id = Number(b.id);
    if (!Number.isInteger(id)) throw bad('Bad id');
    const r = await sql`update orders set status = 'claimed', note = ${String(b.note || '').trim().slice(0, 120)} where id = ${id} and user_id = ${u.id} and status = 'pending' returning id`;
    if (!r.length) throw bad('Order not found', 404);
    const admins = await sql`select id from users where is_admin and not blocked`; // the owner is told at once so the points can be added in minutes
    await pushUsers(sql, admins.map((x) => x.id), '💳 A payment is waiting', 'Open Orders, check it on Whish and add the points.', '/#/admin');
    return out({ ok: true });
  }
  return false;
}

/** Owner only (the handler already checked the key). */
async function handleAdmin(action, ctx) {
  const { sql, b, res, bad } = ctx, out = (j) => { res.status(200).json(j); return true; };
  if (action === 'admin_orders') {
    const rows = await sql`select o.id, o.kind, o.cents, o.status, o.note, o.created_at as at, u.name, u.nick, u.phone from orders o join users u on u.id = o.user_id where o.status in ('pending', 'claimed') order by (o.status = 'claimed') desc, o.id desc limit 100`;
    const done = await sql`select o.id, o.kind, o.cents, o.status, o.created_at as at, u.name, u.phone from orders o join users u on u.id = o.user_id where o.status in ('paid', 'rejected') order by o.id desc limit 30`;
    return out({ orders: rows, done });
  }
  if (action === 'admin_order_decide') {
    const id = Number(b.id);
    if (!Number.isInteger(id)) throw bad('Bad id');
    const o = await sql`select * from orders where id = ${id} and status in ('pending', 'claimed')`;
    if (!o.length) throw bad('Order not found', 404);
    if (!b.approve) { await sql`update orders set status = 'rejected', decided_at = now() where id = ${id}`; return out({ ok: true }); }
    if (!(await settleOrder(sql, id))) throw bad('Order already decided', 409);
    return out({ ok: true });
  }
  return false;
}
module.exports = { handle, handleAdmin, PRODUCTS };
