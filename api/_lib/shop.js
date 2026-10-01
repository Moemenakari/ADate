// Buying points. The person pays with Whish (a link the owner shares), tells us the reference, and the owner approves it.
// Nothing here touches a card or a bank: we only record a claim and, once the owner confirms the payment, add the points.
// 5 points = $1, 25 points = $5
const PRODUCTS = { points5: { cents: 100, points: 5, label: '5 points' }, points25: { cents: 500, points: 25, label: '25 points' } };

async function handle(action, ctx) {
  const { sql, b, res, bad, userOf } = ctx, out = (j) => { res.status(200).json(j); return true; };
  const need = async () => { const u = await userOf(sql, b.session); if (!u.profile_done) throw bad('Finish your profile first', 403); return u; };

  if (action === 'shop') {
    const u = await need();
    const s = await sql`select key, value from settings where key in ('whish_link', 'whish_note')`;
    const orders = await sql`select id, kind, cents, status, created_at as at from orders where user_id = ${u.id} order by id desc limit 20`;
    return out({ products: Object.entries(PRODUCTS).map(([kind, p]) => ({ kind, cents: p.cents, points: p.points, label: p.label })), settings: Object.fromEntries(s.map((x) => [x.key, x.value])), orders });
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
    const p = PRODUCTS[o[0].kind];
    if (!b.approve) { await sql`update orders set status = 'rejected', decided_at = now() where id = ${id}`; return out({ ok: true }); }
    const done = await sql`update orders set status = 'paid', decided_at = now() where id = ${id} and status in ('pending', 'claimed') returning id`; // claim the order first so two taps can never pay twice
    if (!done.length) throw bad('Order already decided', 409);
    await sql`insert into points_ledger (user_id, delta, reason, ref) values (${o[0].user_id}, ${p.points}, 'buy', ${String(id)})`;
    return out({ ok: true });
  }
  return false;
}
module.exports = { handle, handleAdmin, PRODUCTS };
