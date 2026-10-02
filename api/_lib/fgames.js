// Games between two people who already have a private chat (friends). One game at a time per chat.
// The inviter picks the game; the other one accepts when they come online (a push tells them). Turns can be taken at any time.
const games = require('./games');
const { pushUsers, ageOf } = require('./community');
const { LEVELS, priceOf } = require('./play');

/** Truth or Dare between two friends: they take turns. The one whose turn it is picks Truth or Dare, answers in the chat, and presses Done. */
const todLive = (st) => new Date(st.until) > new Date();
const todView = (st, uid) => ({ type: 'tod', level: st.level, name: LEVELS[st.level].name, my_turn: st.turn === uid && todLive(st), phase: st.phase, kind: st.kind || null, text: st.phase === 'asked' ? st.text : null, until: st.until, count: st.count, done: !todLive(st) });

async function handle(action, ctx) {
  const { sql, b, res, bad, userOf } = ctx, out = (j) => { res.status(200).json(j); return true; };
  if (!/^fgame_/.test(action)) return false;
  const u = await userOf(sql, b.session);
  const id = Number(b.thread); if (!Number.isInteger(id) || id < 1) throw bad('Bad id');
  const th = await sql`select * from dm_threads where id = ${id} and (a = ${u.id} or b = ${u.id})`; if (!th.length) throw bad('Not found', 404);
  if (th[0].status !== 'open') throw bad('Open the chat first', 403);
  const other = th[0].a === u.id ? th[0].b : th[0].a;
  const blocked = await sql`select 1 from blocks where (blocker = ${u.id} and blocked = ${other}) or (blocker = ${other} and blocked = ${u.id}) limit 1`; if (blocked.length) throw bad('You cannot play with this person', 403);
  const current = async () => (await sql`select * from fgames where thread_id = ${id} and status in ('invited', 'active') order by id desc limit 1`)[0] || null;
  const shape = (g) => g ? { id: g.id, type: g.type, status: g.status, by_me: g.started_by === u.id, view: g.status === 'active' ? (g.type === 'tod' ? todView(g.state, u.id) : games.view(g.type, g.state, u.id)) : null, label: games.LABEL[g.type] } : null;
  const save = async (g, st) => { st.v = (st.v || 0) + 1; const r = await sql`update fgames set state = ${JSON.stringify(st)}::jsonb where id = ${g.id} and (state->>'v')::int = ${st.v - 1} returning id`; if (!r.length) throw bad('Try again', 409); };
  const online = async () => { const r = await sql`select last_seen from users where id = ${other}`; return !!(r[0] && r[0].last_seen && Date.now() - new Date(r[0].last_seen).getTime() < 150000); };

  if (action === 'fgame_state') { const g = await current(); return out({ game: shape(g), other_online: await online() }); }
  if (action === 'fgame_invite') {
    if (b.type !== 'tod' && !games.TYPES.includes(b.type)) throw bad('Pick a game');
    if (await current()) throw bad('There is already a game in this chat', 409);
    let st;
    if (b.type === 'tod') { // Truth or Dare: both must be old enough for the level, and the one who invites pays for 24 hours
      const lv = Number(b.level); if (!LEVELS[lv]) throw bad('Pick a level');
      const ot = (await sql`select birthdate from users where id = ${other}`)[0];
      if (ageOf(u.birthdate) < LEVELS[lv].min || !ot || ageOf(ot.birthdate) < LEVELS[lv].min) throw bad(`This level is for ages ${LEVELS[lv].min} and up, for both of you`, 403);
      const price = await priceOf(sql, lv), bal = (await sql`select coalesce(sum(delta), 0)::int as n from points_ledger where user_id = ${u.id}`)[0].n;
      if (bal < price) throw bad(`Level ${lv} costs ${price} points for 24 hours. You have ${bal}.`, 402);
      st = { v: 0, level: lv, price, until: null, turn: u.id, phase: 'pick', kind: null, text: null, seen: [], count: 0 };
    } else st = games.init(b.type, u.id, other);
    await sql`insert into fgames (thread_id, type, state, status, started_by) values (${id}, ${b.type}, ${JSON.stringify(st)}::jsonb, 'invited', ${u.id})`;
    await sql`insert into dm_messages (thread_id, from_user, body) values (${id}, ${u.id}, ${'🎮 ' + (u.nick || 'Someone') + ' invites you to play ' + games.LABEL[b.type]})`;
    await pushUsers(sql, [other], '🎮 ' + (u.nick || 'Someone') + ' wants to play with you', games.LABEL[b.type] + '. Tap to play.', '/#/dm/' + id);
    return out({ ok: true, game: shape(await current()) });
  }
  const g0 = await current();
  if (!g0) throw bad('No game right now', 409);
  if (action === 'fgame_accept') {
    if (g0.status !== 'invited' || g0.started_by === u.id) throw bad('Nothing to accept', 409);
    if (g0.type === 'tod') { // the inviter pays now, and the 24 hours start
      const st = g0.state, price = st.price, bal = (await sql`select coalesce(sum(delta), 0)::int as n from points_ledger where user_id = ${g0.started_by}`)[0].n;
      if (bal < price) throw bad('Your friend does not have enough points any more', 402);
      await sql`insert into points_ledger (user_id, delta, reason, ref) values (${g0.started_by}, ${-price}, 'tod', ${String(g0.id)})`;
      st.until = new Date(Date.now() + 24 * 3600 * 1000).toISOString(); await save(g0, st);
    }
    await sql`update fgames set status = 'active' where id = ${g0.id}`;
    await pushUsers(sql, [other], '🎮 ' + (u.nick || 'Your friend') + ' joined the game', 'It is on!', '/#/dm/' + id);
    return out({ ok: true, game: shape(await current()) });
  }
  if (action === 'fgame_decline' || action === 'fgame_close') {
    await sql`update fgames set status = ${action === 'fgame_decline' ? 'declined' : 'done'} where id = ${g0.id}`;
    return out({ ok: true });
  }
  if (action === 'fgame_act') { // a move: cell, stroke, clear, guess or pick
    if (g0.status !== 'active') throw bad('The game has not started', 409);
    if (g0.type === 'tod') {
      const st = g0.state;
      if (!todLive(st)) { await sql`update fgames set status = 'done' where id = ${g0.id}`; throw bad('The 24 hours are over. Start a new game to play again.', 409); }
      if (st.turn !== u.id) throw bad('Wait for your turn', 409);
      if (b.tod === 'pick') {
        if (st.phase !== 'pick') throw bad('Answer the question first', 409);
        const kind = b.kind === 'dare' ? 'dare' : 'truth';
        let q = await sql`select id, text from tod_questions where level = ${st.level} and kind = ${kind} and active and not (id = any(${st.seen})) order by random() limit 1`;
        if (!q.length) q = await sql`select id, text from tod_questions where level = ${st.level} and kind = ${kind} and active order by random() limit 1`;
        if (!q.length) throw bad('No questions of this kind yet', 404);
        st.phase = 'asked'; st.kind = kind; st.text = q[0].text; st.seen = st.seen.concat([q[0].id]).slice(-80);
        await save(g0, st);
        await sql`insert into dm_messages (thread_id, from_user, body) values (${id}, ${u.id}, ${(kind === 'truth' ? '🟣 Truth: ' : '🟠 Dare: ') + q[0].text})`;
      } else if (b.tod === 'done') {
        if (st.phase !== 'asked') throw bad('Pick Truth or Dare first', 409);
        st.turn = other; st.phase = 'pick'; st.kind = null; st.text = null; st.count = (st.count || 0) + 1; await save(g0, st);
        await pushUsers(sql, [other], '🎭 Your turn: Truth or Dare', (u.nick || 'Your friend') + ' finished. Pick Truth or Dare.', '/#/dm/' + id);
      } else throw bad('Bad move', 400);
      return out({ ok: true, game: shape(await current()) });
    }
    let r; try { r = games.act(g0.type, g0.state, u.id, { cell: b.cell, stroke: b.stroke, clear: !!b.clear, pick: b.pick, guess: b.guess === undefined ? undefined : String(b.guess) }); } catch (e) { throw bad(e.message, e.status || 409); }
    await save(g0, r.st);
    const view = games.view(g0.type, r.st, u.id);
    if (view.done) await sql`update fgames set status = 'done' where id = ${g0.id}`;
    if (r.text && r.kind === 'game') await sql`insert into dm_messages (thread_id, from_user, body) values (${id}, ${u.id}, ${r.text})`;
    if ((g0.type === 'xo' || g0.type === 'quiz') && !(await online())) await pushUsers(sql, [other], '🎮 Your turn', (u.nick || 'Your friend') + ' played. Tap to continue.', '/#/dm/' + id);
    return out({ ok: true, correct: r.correct, game: shape(await current()) || { id: g0.id, type: g0.type, status: 'done', by_me: g0.started_by === u.id, view, label: games.LABEL[g0.type] } });
  }
  return false;
}
module.exports = { handle };
