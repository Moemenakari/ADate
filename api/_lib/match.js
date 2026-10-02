// Random matching, text only. Two people who are online at the same time and fit each other's choices
// (age circle, who they want to meet, shared interests) are put in a short chat that is erased afterwards.
// They play up to 3 rounds of Truth or Dare questions; after each round each says Yes or No.
// If both say Yes at least 2 times out of 3 they become friends (a normal private chat opens). Otherwise they part.
const { ageOf, shareCircle, circlesOf, bandOf, screenText, reportTarget, pushUsers, zodiac, dateStr, photoOn, tickOf, roleOf } = require('./community');

const ROUNDS = 3, NEED_YES = 2, WAIT_SECONDS = 120, COOLDOWN_HOURS = 24;
const GENDERS = ['m', 'f'], MEETS = ['m', 'f', 'both'];
const games = require('./games');

async function handle(action, ctx) {
  const { sql, b, res, bad, userOf } = ctx, out = (j) => { res.status(200).json(j); return true; };
  const need = async () => {
    const u = await userOf(sql, b.session);
    if (!u.profile_done || !u.birthdate || !u.nick) throw bad('Finish your profile first', 403);
    if (u.muted_until && new Date(u.muted_until) > new Date()) throw bad('You are muted for a while', 403);
    return u;
  };
  const idNum = (v) => { const n = Number(v); if (!Number.isInteger(n) || n < 1) throw bad('Bad id'); return n; };
  const blockedPair = async (x, y) => (await sql`select 1 from blocks where (blocker = ${x} and blocked = ${y}) or (blocker = ${y} and blocked = ${x}) limit 1`).length > 0;
  const mine = async (u, id) => { const m = await sql`select * from matches where id = ${id} and (a = ${u.id} or b = ${u.id})`; if (!m.length) throw bad('Not found', 404); return m[0]; };
  const peerCard = async (u, m) => {
    const pid = m.a === u.id ? m.b : m.a;
    const p = (await sql`select id, nick, country, birthdate, interests, avatar, frame, langs, selfie_ok, is_admin, role, last_seen from users where id = ${pid}`)[0];
    const mi = new Set(u.interests || []);
    return { id: p.id, nick: p.nick, last_seen: p.last_seen, selfie_ok: tickOf(p), role: roleOf(p), country: p.country, age_band: bandOf(ageOf(p.birthdate)), avatar: p.avatar || '', frame: p.frame || '', langs: p.langs || [], shared: (p.interests || []).filter((x) => mi.has(x)) };
  };
  const stateOf = async (u, m) => {
    const pid = m.a === u.id ? m.b : m.a;
    const votes = await sql`select user_id, round, yes from match_votes where match_id = ${m.id}`;
    const mineV = votes.filter((v) => v.user_id === u.id), theirs = votes.filter((v) => v.user_id === pid);
    const round = m.round, myVote = mineV.find((v) => v.round === round), theirVote = theirs.find((v) => v.round === round);
    const g = round > 0 ? await sql`select type, state from match_games where match_id = ${m.id} and round = ${round}` : [];
    const game = g.length ? (g[0].type === 'tod' ? { type: 'tod', done: true } : games.view(g[0].type, g[0].state, u.id)) : null;
    return { id: m.id, state: m.state, round, rounds: ROUNDS, game, need_yes: NEED_YES, voted: !!myVote, their_voted: !!theirVote, my_yes: mineV.filter((v) => v.yes).length, thread: m.thread_id || null };
  };

  if (action === 'match_prefs') { // who I am, who I want to meet, languages
    const u = await userOf(sql, b.session);
    const g = String(b.gender || ''), meet = String(b.meet || 'both');
    if (!GENDERS.includes(g) || !MEETS.includes(meet)) throw bad('Pick who you are and who you want to meet');
    const langs = Array.isArray(b.langs) ? b.langs.map((x) => String(x).slice(0, 20)).slice(0, 5) : (u.langs || []);
    await sql`update users set gender = ${g}, meet = ${meet}, langs = ${langs} where id = ${u.id}`;
    return out({ ok: true });
  }
  if (action === 'match_join') {
    const u = await need();
    if (!u.gender) throw bad('Tell us who you are first', 409);
    const meet = u.meet || 'both', age = ageOf(u.birthdate);
    const live = await sql`select m.id from matches m where (m.a = ${u.id} or m.b = ${u.id}) and m.state = 'chat'`;
    if (live.length) return out({ state: 'matched', match: live[0].id });
    await sql`delete from match_queue where since < now() - ${WAIT_SECONDS + ' seconds'}::interval`;
    const cand = await sql`select q.user_id, q.since, u.birthdate, u.gender, u.meet, u.interests, u.langs from match_queue q join users u on u.id = q.user_id
      where q.user_id <> ${u.id} and not u.blocked and (u.muted_until is null or u.muted_until < now())
        and (${meet} = 'both' or u.gender = ${meet}) and (u.meet = 'both' or u.meet = ${u.gender})
        and not exists (select 1 from blocks bl where (bl.blocker = ${u.id} and bl.blocked = q.user_id) or (bl.blocker = q.user_id and bl.blocked = ${u.id}))
        and not exists (select 1 from matches mm where ((mm.a = ${u.id} and mm.b = q.user_id) or (mm.a = q.user_id and mm.b = ${u.id})) and mm.created_at > now() - ${COOLDOWN_HOURS + ' hours'}::interval)
      order by q.since limit 50`;
    const mi = new Set(u.interests || []), ml = new Set(u.langs || []);
    const ranked = cand.filter((c) => shareCircle(age, ageOf(c.birthdate)))
      .map((c) => ({ c, score: (c.interests || []).filter((x) => mi.has(x)).length * 2 + (c.langs || []).filter((x) => ml.has(x)).length }))
      .sort((x, y) => y.score - x.score || new Date(x.c.since) - new Date(y.c.since));
    for (const { c } of ranked) { // claim the waiting person; if someone else got them first, try the next one
      const got = await sql`delete from match_queue where user_id = ${c.user_id} returning user_id`;
      if (!got.length) continue;
      await sql`delete from match_queue where user_id = ${u.id}`;
      const a = Math.min(u.id, c.user_id), bb = Math.max(u.id, c.user_id);
      const m = await sql`insert into matches (a, b) values (${a}, ${bb}) returning id`;
      await pushUsers(sql, [c.user_id], '💜 You have a match', 'Someone is waiting to chat with you.', '/#/match');
      return out({ state: 'matched', match: m[0].id });
    }
    await sql`insert into match_queue (user_id, since) values (${u.id}, now()) on conflict (user_id) do update set since = now()`;
    return out({ state: 'waiting' });
  }
  if (action === 'match_state') {
    const u = await need();
    const live = await sql`select * from matches where (a = ${u.id} or b = ${u.id}) and state in ('chat') order by id desc limit 1`;
    if (live.length) return out({ state: 'matched', match: await stateOf(u, live[0]), peer: await peerCard(u, live[0]) });
    const last = await sql`select * from matches where (a = ${u.id} or b = ${u.id}) and state in ('friends', 'ended') and created_at > now() - interval '10 minutes' and not (seen_by @> ${[u.id]}::bigint[]) order by id desc limit 1`;
    if (last.length) return out({ state: last[0].state, match: await stateOf(u, last[0]), peer: await peerCard(u, last[0]) });
    const q = await sql`select since from match_queue where user_id = ${u.id}`;
    if (q.length) {
      if (new Date(q[0].since) < new Date(Date.now() - WAIT_SECONDS * 1000)) { await sql`delete from match_queue where user_id = ${u.id}`; return out({ state: 'nobody' }); }
      return out({ state: 'waiting', since: q[0].since });
    }
    return out({ state: 'idle', gender: u.gender || '', meet: u.meet || 'both', langs: u.langs || [] });
  }
  if (action === 'match_leave') { // leave the queue, or end the chat; also closes a finished one
    const u = await need();
    await sql`delete from match_queue where user_id = ${u.id}`;
    if (b.match) {
      const m = await mine(u, idNum(b.match));
      if (m.state === 'chat') await sql`update matches set state = 'ended', ended_at = now() where id = ${m.id}`;
      await sql`update matches set seen_by = array_append(seen_by, ${u.id}::bigint) where id = ${m.id} and not (seen_by @> ${[u.id]}::bigint[])`;
    }
    return out({ ok: true });
  }
  if (action === 'match_msgs') {
    const u = await need(), m = await mine(u, idNum(b.match)), after = Number(b.after) || 0;
    const rows = await sql`select id, from_user, body, kind, created_at as at from match_msgs where match_id = ${m.id} and id > ${after} order by id limit 100`;
    return out({ messages: rows.map((r) => ({ id: r.id, mine: r.from_user === u.id, body: r.body, kind: r.kind, at: r.at })), match: await stateOf(u, (await mine(u, m.id))) });
  }
  if (action === 'match_send') {
    const u = await need(), m = await mine(u, idNum(b.match));
    if (m.state !== 'chat') throw bad('This chat is over', 409);
    const why = screenText(b.body, 300); if (why) throw bad(why);
    const n = await sql`select count(*)::int as n from match_msgs where match_id = ${m.id}`; if (n[0].n >= 300) throw bad('This chat is full');
    await sql`insert into match_msgs (match_id, from_user, body) values (${m.id}, ${u.id}, ${String(b.body).replace(/\s+/g, ' ').trim()})`;
    return out({ ok: true });
  }
  if (action === 'match_game') { // starts the next round: a quick question, tic-tac-toe, or draw and guess
    const u = await need(), m = await mine(u, idNum(b.match)), type = games.TYPES.includes(b.type) ? b.type : 'quiz';
    if (m.state !== 'chat') throw bad('This chat is over', 409);
    if (m.round >= ROUNDS) throw bad('That was the last round. Say Yes or No.', 409);
    if (m.round > 0) { const v = await sql`select count(*)::int as n from match_votes where match_id = ${m.id} and round = ${m.round}`; if (v[0].n < 2) throw bad('Wait until you both answer Yes or No', 409); }
    const up = await sql`update matches set round = round + 1 where id = ${m.id} and round = ${m.round} returning round`;
    if (!up.length) return out({ ok: true });
    const st = games.init(type, u.id, u.id === m.a ? m.b : m.a);
    await sql`insert into match_games (match_id, round, type, state) values (${m.id}, ${up[0].round}, ${type}, ${JSON.stringify(st)}::jsonb)`;
    await sql`insert into match_msgs (match_id, from_user, body, kind) values (${m.id}, ${u.id}, ${type === 'quiz' ? '🎲 ' + st.q : games.LABEL[type]}, 'game')`;
    return out({ ok: true, round: up[0].round });
  }
  const playMatch = async (kind, payload) => { // one move in the game of the current round, for any game
    const u = await need(), m = await mine(u, idNum(b.match)); if (m.state !== 'chat') throw bad('This chat is over', 409);
    const g = await sql`select type, state from match_games where match_id = ${m.id} and round = ${m.round}`; if (!g.length || g[0].type !== kind) throw bad('No such game right now', 409);
    let r; try { r = games.act(kind, g[0].state, u.id, payload); } catch (e) { throw bad(e.message, e.status || 409); }
    const st = r.st; st.v = (st.v || 0) + 1;
    const ok = await sql`update match_games set state = ${JSON.stringify(st)}::jsonb where match_id = ${m.id} and round = ${m.round} and (state->>'v')::int = ${st.v - 1} returning match_id`; if (!ok.length) throw bad('Try again', 409);
    if (r.text) await sql`insert into match_msgs (match_id, from_user, body, kind) values (${m.id}, ${u.id}, ${r.text}, ${r.kind || 'text'})`;
    return out({ ok: true, correct: r.correct, match: await stateOf(u, await mine(u, m.id)) });
  };
  if (action === 'match_move') return playMatch('xo', { cell: b.cell });
  if (action === 'match_draw') return playMatch('draw', b.clear ? { clear: true } : { stroke: b.stroke });
  if (action === 'match_guess') return playMatch('draw', { guess: String(b.guess || '') });
  if (action === 'match_pick') return playMatch('quiz', { pick: b.pick });
  if (action === 'match_vote') { // Yes or No on this round; after the last round it is decided
    const u = await need(), m = await mine(u, idNum(b.match));
    if (m.state !== 'chat' || m.round < 1) throw bad('Start a game first', 409);
    await sql`insert into match_votes (match_id, user_id, round, yes) values (${m.id}, ${u.id}, ${m.round}, ${!!b.yes}) on conflict (match_id, user_id, round) do nothing`;
    const all = await sql`select user_id, yes from match_votes where match_id = ${m.id}`;
    if (m.round >= ROUNDS && all.length >= ROUNDS * 2) {
      const ya = all.filter((v) => v.user_id === m.a && v.yes).length, yb = all.filter((v) => v.user_id === m.b && v.yes).length;
      if (ya >= NEED_YES && yb >= NEED_YES) {
        let th = await sql`select id from dm_threads where a = ${m.a} and b = ${m.b}`;
        if (!th.length) th = await sql`insert into dm_threads (a, b, started_by, status) values (${m.a}, ${m.b}, ${u.id}, 'open') returning id`;
        else await sql`update dm_threads set status = 'open' where id = ${th[0].id}`;
        await sql`update dm_threads set source = coalesce(source, 'match'), unlock_until = case when source is null then now() + interval '1 hour' else unlock_until end where id = ${th[0].id}`; // a match chat is free for one hour; after that one of them unlocks it for 3 points
        await sql`update matches set state = 'friends', thread_id = ${th[0].id}, ended_at = now() where id = ${m.id} and state = 'chat'`;
        const other = u.id === m.a ? m.b : m.a; await pushUsers(sql, [other], '💜 You are now friends', 'Your match said Yes. Say hi!', '/#/dms');
      } else await sql`update matches set state = 'ended', ended_at = now() where id = ${m.id} and state = 'chat'`;
    }
    return out({ ok: true, match: await stateOf(u, await mine(u, m.id)) });
  }
  if (action === 'match_report') {
    const u = await need(), m = await mine(u, idNum(b.match)), pid = m.a === u.id ? m.b : m.a;
    const last = await sql`select body from match_msgs where match_id = ${m.id} and from_user = ${pid} order by id desc limit 1`;
    const muted = await reportTarget(sql, u.id, pid, 'match', last.length ? last[0].body : '');
    if (b.block) await sql`insert into blocks (blocker, blocked) values (${u.id}, ${pid}) on conflict do nothing`;
    if (m.state === 'chat') await sql`update matches set state = 'ended', ended_at = now() where id = ${m.id}`;
    return out({ ok: true, muted });
  }

  /* ------------------------------------------------ Swipe: browse people one card at a time */
  if (action === 'discover_next') {
    const u = await need();
    if (!u.gender) throw bad('Tell us who you are first', 409);
    const meet = u.meet || 'both', age = ageOf(u.birthdate), mi = new Set(u.interests || []);
    const rows = await sql`select t.id, t.nick, t.country, t.birthdate, t.interests, t.langs, t.avatar, t.frame, t.photo, t.photo_ok, t.photo_until, t.selfie_ok, t.is_admin, t.role, t.last_seen, (select s.created_at from swipes s where s.from_user = ${u.id} and s.to_user = t.id and s.act = 'skip') as skipped_at from users t
      where t.id <> ${u.id} and t.profile_done and t.nick is not null and not t.blocked and (t.muted_until is null or t.muted_until < now())
        and (${meet} = 'both' or t.gender = ${meet}) and (t.meet is null or t.meet = 'both' or t.meet = ${u.gender})
        and not exists (select 1 from swipes s where s.from_user = ${u.id} and s.to_user = t.id and s.act = 'invite')
        and not exists (select 1 from blocks bl where (bl.blocker = ${u.id} and bl.blocked = t.id) or (bl.blocker = t.id and bl.blocked = ${u.id}))
      order by t.last_login_at desc nulls last limit 200`;
    const ok = rows.filter((t) => shareCircle(age, ageOf(t.birthdate)))
      .map((t) => ({ t, fresh: !t.skipped_at, score: (t.interests || []).filter((x) => mi.has(x)).length * 3 + (t.country && t.country === u.country ? 2 : 0) + Math.random() }))
      .sort((x, y) => (y.fresh - x.fresh) || (x.fresh ? y.score - x.score : new Date(x.t.skipped_at) - new Date(y.t.skipped_at))); // people you skipped come back, oldest skip first, once the new ones run out
    if (!ok.length) return out({ card: null });
    const t = ok[0].t;
    return out({ card: { id: t.id, nick: t.nick, last_seen: t.last_seen, selfie_ok: tickOf(t), role: roleOf(t), country: t.country, age_band: bandOf(ageOf(t.birthdate)), zodiac: zodiac(dateStr(t.birthdate)), avatar: t.avatar || '', frame: t.frame || '', photo: photoOn(t) ? (t.photo || '') : '', interests: t.interests || [], shared: (t.interests || []).filter((x) => mi.has(x)), langs: t.langs || [] } });
  }
  if (action === 'discover_act') { // Skip, or Invite with an optional first message
    const u = await need(), to = idNum(b.to); if (to === u.id) throw bad('That is you');
    const t = await sql`select id, birthdate, blocked, profile_done from users where id = ${to}`;
    if (!t.length || t[0].blocked || !t[0].profile_done) throw bad('Not found', 404);
    if (b.act !== 'invite') { await sql`insert into swipes (from_user, to_user, act) values (${u.id}, ${to}, 'skip') on conflict (from_user, to_user) do update set act = 'skip', created_at = now() where swipes.act <> 'invite'`; return out({ ok: true }); }
    if (!shareCircle(ageOf(u.birthdate), ageOf(t[0].birthdate))) throw bad('You can only message people in your age circles', 403);
    if (await blockedPair(u.id, to)) throw bad('You cannot message this person', 403);
    const body = String(b.body || '').trim() || '👋'; if (body !== '👋') { const why = screenText(body, 300); if (why) throw bad(why); }
    await sql`insert into swipes (from_user, to_user, act) values (${u.id}, ${to}, 'invite') on conflict (from_user, to_user) do update set act = 'invite', created_at = now()`;
    const a = Math.min(u.id, to), c = Math.max(u.id, to);
    let th = await sql`select * from dm_threads where a = ${a} and b = ${c}`;
    if (!th.length) th = await sql`insert into dm_threads (a, b, started_by) values (${a}, ${c}, ${u.id}) returning *`;
    const T = th[0];
    if (T.status === 'declined') return out({ ok: true, state: 'declined' });
    const theyInvited = (await sql`select 1 from swipes where from_user = ${to} and to_user = ${u.id} and act = 'invite'`).length > 0;
    if (T.status === 'pending') { if (T.started_by !== u.id || theyInvited) await sql`update dm_threads set status = 'open' where id = ${T.id}`; else if ((await sql`select count(*)::int as n from dm_messages where thread_id = ${T.id} and from_user = ${u.id}`)[0].n >= 1) return out({ ok: true, state: 'waiting' }); }
    await sql`insert into dm_messages (thread_id, from_user, body) values (${T.id}, ${u.id}, ${body})`;
    await pushUsers(sql, [to], '💜 ' + (u.nick || 'Someone') + ' invited you', 'Open ADate to see who it is.', '/#/dms');
    return out({ ok: true, state: T.status === 'open' || theyInvited ? 'friends' : 'sent', thread: T.id });
  }
  if (action === 'discover_report') {
    const u = await need(), to = idNum(b.to);
    const muted = await reportTarget(sql, u.id, to, 'card', 'Reported from Swipe');
    await sql`insert into blocks (blocker, blocked) values (${u.id}, ${to}) on conflict do nothing`;
    return out({ ok: true, muted });
  }
  if (action === 'discover_near') { // places near me by country; never exact positions
    const u = await need(), c = u.country || null;
    const rooms = await sql`select r.id, r.title, r.emoji, (select count(*)::int from room_members m where m.room_id = r.id) as members from rooms r where r.kind = 'region' and (${c}::text is null or r.country = ${c}) order by members desc, r.title limit 60`;
    const n = c ? await sql`select count(*)::int as n from users where country = ${c} and profile_done and not blocked` : [{ n: 0 }];
    return out({ country: c, people: n[0].n, rooms });
  }
  return false;
}
module.exports = { handle };
