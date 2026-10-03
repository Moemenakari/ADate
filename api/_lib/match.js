// Random matching, text only. Two people who are online at the same time and fit each other's choices
// (age circle, who they want to meet, shared interests) are put in a short chat that is erased afterwards.
// They play up to 3 rounds of Truth or Dare questions; after each round each says Yes or No.
// If both say Yes at least 2 times out of 3 they become friends (a normal private chat opens). Otherwise they part.
const prices = require('./prices');
const { ageOf, shareCircle, circlesOf, bandOf, screenText, reportTarget, pushUsers, zodiac, dateStr, photoOn, tickOf, roleOf, fastOf } = require('./community');

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
    const p = (await sql`select id, nick, country, birthdate, interests, avatar, frame, langs, selfie_ok, is_admin, role, last_seen, reply_n, reply_secs from users where id = ${pid}`)[0];
    const mi = new Set(u.interests || []);
    return { id: p.id, nick: p.nick, last_seen: p.last_seen, selfie_ok: tickOf(p), role: roleOf(p), fast: fastOf(p), country: p.country, age_band: bandOf(ageOf(p.birthdate)), avatar: p.avatar || '', frame: p.frame || '', langs: p.langs || [], shared: (p.interests || []).filter((x) => mi.has(x)) };
  };
  const stateOf = async (u, m) => {
    const pid = m.a === u.id ? m.b : m.a, inv = m.kind === 'invite', judge = m.judge === u.id;
    const votes = await sql`select user_id, round, yes from match_votes where match_id = ${m.id}`;
    const mineV = votes.filter((v) => v.user_id === u.id), theirs = votes.filter((v) => v.user_id === pid);
    const round = m.round, myVote = mineV.find((v) => v.round === round), theirVote = theirs.find((v) => v.round === round);
    const g = round > 0 ? await sql`select type, state from match_games where match_id = ${m.id} and round = ${round}` : [];
    const game = g.length ? (g[0].type === 'tod' ? { type: 'tod', done: true } : games.view(g[0].type, g[0].state, u.id)) : null;
    const judged = inv ? votes.filter((v) => v.user_id === m.judge) : null; // in a game invitation only the invited person says Yes or No
    return { id: m.id, state: m.state, kind: m.kind || 'random', round, rounds: ROUNDS, game, need_yes: NEED_YES,
      voted: inv ? (judge ? !!myVote : true) : !!myVote, their_voted: inv ? (judge ? true : !!(judged || []).find((v) => v.round === round)) : !!theirVote,
      my_yes: inv ? (judged || []).filter((v) => v.yes).length : mineV.filter((v) => v.yes).length, is_judge: inv ? judge : true, invited_by_me: inv ? m.invited_by === u.id : false, thread: m.thread_id || null };
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
    const live = await sql`select m.id from matches m where (m.a = ${u.id} or m.b = ${u.id}) and m.state = 'chat' and m.kind = 'random'`;
    if (live.length) return out({ state: 'matched', match: live[0].id });
    await sql`delete from match_queue where since < now() - ${WAIT_SECONDS + ' seconds'}::interval`;
    const cand = await sql`select q.user_id, q.since, u.birthdate, u.gender, u.meet, u.interests, u.langs from match_queue q join users u on u.id = q.user_id
      where q.user_id <> ${u.id} and u.role is distinct from 'team' and not u.blocked and (u.muted_until is null or u.muted_until < now())
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
    if (b.match) { const x = await mine(u, idNum(b.match)); return out({ state: x.state === 'chat' ? 'matched' : x.state, match: await stateOf(u, x), peer: await peerCard(u, x) }); } // one particular game invitation
    const live = await sql`select * from matches where (a = ${u.id} or b = ${u.id}) and state in ('chat') and kind = 'random' order by id desc limit 1`;
    if (live.length) return out({ state: 'matched', match: await stateOf(u, live[0]), peer: await peerCard(u, live[0]) });
    const last = await sql`select * from matches where (a = ${u.id} or b = ${u.id}) and kind = 'random' and state in ('friends', 'ended') and created_at > now() - interval '10 minutes' and not (seen_by @> ${[u.id]}::bigint[]) order by id desc limit 1`;
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
    const u = await need(), m = await mine(u, idNum(b.match)), inv = m.kind === 'invite';
    const type = inv ? ['xo', 'draw', 'quiz'][m.round] : (games.TYPES.includes(b.type) ? b.type : 'quiz'); // an invitation always goes XO, then drawing, then the question
    if (m.state !== 'chat') throw bad('This chat is over', 409);
    if (m.round >= ROUNDS) throw bad('That was the last round. Say Yes or No.', 409);
    if (m.round > 0) { const v = await sql`select count(*)::int as n from match_votes where match_id = ${m.id} and round = ${m.round}`; if (v[0].n < (inv ? 1 : 2)) throw bad(inv ? 'Wait for their Yes or No' : 'Wait until you both answer Yes or No', 409); }
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
    if (m.kind === 'invite' && kind !== 'draw') { const o = u.id === m.a ? m.b : m.a, ls = await sql`select last_seen from users where id = ${o}`; if (!(ls[0] && ls[0].last_seen && Date.now() - new Date(ls[0].last_seen).getTime() < 150000)) await pushUsers(sql, [o], '🎮 Your turn', (u.nick || 'Someone') + ' played. Tap to continue.', '/#/play/' + m.id); }
    return out({ ok: true, correct: r.correct, match: await stateOf(u, await mine(u, m.id)) });
  };
  if (action === 'match_move') return playMatch('xo', { cell: b.cell });
  if (action === 'match_draw') return playMatch('draw', b.clear ? { clear: true } : { stroke: b.stroke });
  if (action === 'match_guess') return playMatch('draw', { guess: String(b.guess || '') });
  if (action === 'match_pick') return playMatch('quiz', { pick: b.pick });
  if (action === 'match_vote') { // Yes or No on this round; after the last round it is decided
    const u = await need(), m = await mine(u, idNum(b.match));
    if (m.state !== 'chat' || m.round < 1) throw bad('Start a game first', 409);
    if (m.kind === 'invite') { // only the invited person decides; two Yes out of three opens the chat (the inviter pays 2 points to start it)
      if (m.judge !== u.id) throw bad('Only the invited person says Yes or No', 403);
      await sql`insert into match_votes (match_id, user_id, round, yes) values (${m.id}, ${u.id}, ${m.round}, ${!!b.yes}) on conflict (match_id, user_id, round) do nothing`;
      const jv = await sql`select yes from match_votes where match_id = ${m.id} and user_id = ${u.id}`;
      if (m.round >= ROUNDS && jv.length >= ROUNDS) {
        const from = m.invited_by;
        if (jv.filter((v) => v.yes).length >= NEED_YES) {
          let th = await sql`select id from dm_threads where a = ${m.a} and b = ${m.b}`;
          if (!th.length) th = await sql`insert into dm_threads (a, b, started_by, status, source) values (${m.a}, ${m.b}, ${from}, 'open', 'gate') returning id`;
          else await sql`update dm_threads set status = 'open', source = coalesce(source, 'gate') where id = ${th[0].id}`;
          await sql`update matches set state = 'friends', thread_id = ${th[0].id}, ended_at = now() where id = ${m.id} and state = 'chat'`;
          await pushUsers(sql, [from], '💜 They said Yes', 'You passed the games. Open the chat for 2 points.', '/#/dm/' + th[0].id);
        } else { await sql`update matches set state = 'ended', ended_at = now() where id = ${m.id} and state = 'chat'`; await pushUsers(sql, [from], '🎮 The games are over', 'This time it was not a match. Try someone new.', '/#/match'); }
      }
      return out({ ok: true, match: await stateOf(u, await mine(u, m.id)) });
    }
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
    const rows = await sql`select t.id, t.nick, t.gender, t.country, t.birthdate, t.interests, t.langs, t.avatar, t.frame, t.photo, t.photo_ok, t.photo_until, t.selfie_ok, t.is_admin, t.role, t.last_seen, t.reply_n, t.reply_secs, (select s.created_at from swipes s where s.from_user = ${u.id} and s.to_user = t.id and s.act = 'skip') as skipped_at from users t
      where t.role is distinct from 'team' and t.id <> ${u.id} and t.profile_done and t.nick is not null and not t.blocked and (t.muted_until is null or t.muted_until < now())
        and (${meet} = 'both' or t.gender = ${meet}) and (t.meet is null or t.meet = 'both' or t.meet = ${u.gender})
        and not exists (select 1 from swipes s where s.from_user = ${u.id} and s.to_user = t.id and s.act = 'invite' and s.created_at > now() - interval '24 hours')
        and not exists (select 1 from dm_threads d where d.status = 'open' and ((d.a = ${u.id} and d.b = t.id) or (d.b = ${u.id} and d.a = t.id)))
        and not exists (select 1 from blocks bl where (bl.blocker = ${u.id} and bl.blocked = t.id) or (bl.blocker = t.id and bl.blocked = ${u.id}))
      order by t.last_login_at desc nulls last limit 200`;
    const ok = rows.filter((t) => shareCircle(age, ageOf(t.birthdate)))
      .map((t) => ({ t, fresh: !t.skipped_at, score: (t.interests || []).filter((x) => mi.has(x)).length * 3 + (t.country && t.country === u.country ? 2 : 0) + Math.random() }))
      .sort((x, y) => (y.fresh - x.fresh) || (x.fresh ? y.score - x.score : new Date(x.t.skipped_at) - new Date(y.t.skipped_at))); // people you skipped come back, oldest skip first, once the new ones run out
    if (!ok.length) return out({ card: null });
    const t = ok[0].t, P = await prices.get(sql), freeUntil = new Date(new Date(u.created_at).getTime() + P.swipe_free_days * 86400000), free = Date.now() < freeUntil.getTime() || t.gender === u.gender;
    if (!free && P.swipe_price > 0) { // after the free days, each person of the other gender costs stars (once a day per person)
      const seen = await sql`select 1 from swipe_views where viewer = ${u.id} and target = ${t.id} and day = current_date`;
      if (!seen.length) {
        const bal = (await sql`select coalesce(sum(delta), 0)::int as n from points_ledger where user_id = ${u.id}`)[0].n;
        if (bal < P.swipe_price) throw bad(`Your free days are over. Each new person costs ${P.swipe_price} star(s). You have ${bal}.`, 402);
        const ins = await sql`insert into swipe_views (viewer, target, day) values (${u.id}, ${t.id}, current_date) on conflict do nothing returning target`;
        if (ins.length) await sql`insert into points_ledger (user_id, delta, reason, ref) values (${u.id}, ${-P.swipe_price}, 'swipe', ${String(t.id)})`;
      }
    }
    return out({ card: { id: t.id, nick: t.nick, last_seen: t.last_seen, selfie_ok: tickOf(t), role: roleOf(t), fast: fastOf(t), country: t.country, age_band: bandOf(ageOf(t.birthdate)), zodiac: zodiac(dateStr(t.birthdate)), avatar: t.avatar || '', frame: t.frame || '', photo: photoOn(t) ? (t.photo || '') : '', interests: t.interests || [], shared: (t.interests || []).filter((x) => mi.has(x)), langs: t.langs || [] } });
  }
  if (action === 'discover_act') { // Skip, or Invite with an optional first message
    const u = await need(), to = idNum(b.to); if (to === u.id) throw bad('That is you');
    const t = await sql`select id, birthdate, blocked, profile_done from users where id = ${to}`;
    if (!t.length || t[0].blocked || !t[0].profile_done) throw bad('Not found', 404);
    if (b.act !== 'invite' && b.act !== 'boost') { await sql`insert into swipes (from_user, to_user, act) values (${u.id}, ${to}, 'skip') on conflict (from_user, to_user) do update set act = 'skip', created_at = now() where swipes.act <> 'invite'`; return out({ ok: true }); }
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
    let boosted = false;
    if (b.act === 'boost' && T.status !== 'open' && !theyInvited) { // a boost costs 5 points: the message goes to the top of their list with a notification
      const bal = (await sql`select coalesce(sum(delta), 0)::int as n from points_ledger where user_id = ${u.id}`)[0].n; if (bal < 5) throw bad(`A boost costs 5 points. You have ${bal}.`, 402);
      await sql`insert into points_ledger (user_id, delta, reason, ref) values (${u.id}, -5, 'boost', ${String(T.id)})`; await sql`update dm_threads set boosted = true where id = ${T.id}`; boosted = true;
    }
    await pushUsers(sql, [to], boosted ? '🚀 ' + (u.nick || 'Someone') + ' sent you a boosted message' : '💜 ' + (u.nick || 'Someone') + ' invited you', boosted ? body.slice(0, 80) : 'Open ADate to see who it is.', '/#/dms');
    return out({ ok: true, state: T.status === 'open' || theyInvited ? 'friends' : 'sent', thread: T.id, boosted });
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
  /* ------------------------------------------------ Game invitations from Swipe or Online */
  const cardOf = (u, p) => { const mi = new Set(u.interests || []); return { id: p.id, nick: p.nick, last_seen: p.last_seen, selfie_ok: tickOf(p), role: roleOf(p), fast: fastOf(p), country: p.country, age_band: bandOf(ageOf(p.birthdate)), avatar: p.avatar || '', frame: p.frame || '', shared: (p.interests || []).filter((x) => mi.has(x)) }; };
  if (action === 'invite_game') {
    const u = await need(), to = idNum(b.to); if (to === u.id) throw bad('That is you');
    const t = await sql`select id, nick, birthdate, blocked, profile_done from users where id = ${to}`;
    if (!t.length || t[0].blocked || !t[0].profile_done) throw bad('Not found', 404);
    if (!shareCircle(ageOf(u.birthdate), ageOf(t[0].birthdate))) throw bad('You can only play with people in your age circles', 403);
    if (await blockedPair(u.id, to)) throw bad('You cannot play with this person', 403);
    const a = Math.min(u.id, to), c = Math.max(u.id, to);
    const open = await sql`select id from matches where a = ${a} and b = ${c} and kind = 'invite' and state in ('invited', 'chat')`;
    if (open.length) return out({ ok: true, match: open[0].id, again: true });
    const r = await sql`insert into matches (a, b, kind, invited_by, judge, state) values (${a}, ${c}, 'invite', ${u.id}, ${to}, 'invited') returning id`;
    await sql`insert into swipes (from_user, to_user, act) values (${u.id}, ${to}, 'invite') on conflict (from_user, to_user) do update set act = 'invite', created_at = now()`;
    await pushUsers(sql, [to], '🎮 ' + (u.nick || 'Someone') + ' invited you to play', 'XO, drawing and a quick question. Tap to see.', '/#/dms');
    return out({ ok: true, match: r[0].id });
  }
  if (action === 'invite_list') { // incoming and outgoing game invitations
    const u = await need();
    const rows = await sql`select m.id, m.state, m.round, m.invited_by, m.judge, m.thread_id, m.created_at as at, x.id as pid, x.nick, x.avatar, x.frame, x.country, x.birthdate, x.interests, x.last_seen, x.selfie_ok, x.is_admin, x.role, x.reply_n, x.reply_secs
      from matches m join users x on x.id = case when m.a = ${u.id} then m.b else m.a end
      where m.kind = 'invite' and (m.a = ${u.id} or m.b = ${u.id}) and (m.state in ('invited', 'chat') or (m.state = 'friends' and m.created_at > now() - interval '3 days')) order by m.id desc limit 40`;
    return out({ invites: rows.map((r) => ({ id: r.id, state: r.state, round: r.round, mine: r.invited_by === u.id, thread: r.thread_id, at: r.at, peer: cardOf(u, { id: r.pid, nick: r.nick, avatar: r.avatar, frame: r.frame, country: r.country, birthdate: r.birthdate, interests: r.interests, last_seen: r.last_seen, selfie_ok: r.selfie_ok, is_admin: r.is_admin, role: r.role, reply_n: r.reply_n, reply_secs: r.reply_secs }) })) });
  }
  if (action === 'invite_respond') {
    const u = await need(), m = await mine(u, idNum(b.match));
    if (m.kind !== 'invite' || m.state !== 'invited' || m.judge !== u.id) throw bad('Nothing to answer', 409);
    if (b.accept) { await sql`update matches set state = 'chat' where id = ${m.id} and state = 'invited'`; await pushUsers(sql, [m.invited_by], '🎮 ' + (u.nick || 'They') + ' accepted', 'The games can start!', '/#/play/' + m.id); }
    else { await sql`update matches set state = 'ended', ended_at = now() where id = ${m.id} and state = 'invited'`; }
    return out({ ok: true, match: await stateOf(u, await mine(u, m.id)) });
  }
  if (action === 'online_list') { // who is online right now, friends first
    const u = await need();
    if (!u.gender) throw bad('Tell us who you are first', 409);
    const meet = u.meet || 'both', age = ageOf(u.birthdate);
    const rows = await sql`select t.id, t.nick, t.country, t.birthdate, t.interests, t.avatar, t.frame, t.last_seen, t.selfie_ok, t.is_admin, t.role, t.reply_n, t.reply_secs,
        exists (select 1 from dm_threads d where d.status = 'open' and ((d.a = ${u.id} and d.b = t.id) or (d.b = ${u.id} and d.a = t.id))) as friend
      from users t where t.role is distinct from 'team' and t.id <> ${u.id} and t.profile_done and t.nick is not null and not t.blocked and t.last_seen > now() - interval '150 seconds'
        and (${meet} = 'both' or t.gender = ${meet}) and (t.meet is null or t.meet = 'both' or t.meet = ${u.gender})
        and not exists (select 1 from blocks bl where (bl.blocker = ${u.id} and bl.blocked = t.id) or (bl.blocker = t.id and bl.blocked = ${u.id}))
      order by t.last_seen desc limit 60`;
    const ok = rows.filter((t) => shareCircle(age, ageOf(t.birthdate))).sort((x, y) => (y.friend - x.friend));
    return out({ online: ok.map((t) => ({ ...cardOf(u, t), friend: !!t.friend })) });
  }
  return false;
}
module.exports = { handle };
