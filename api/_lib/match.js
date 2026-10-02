// Random matching, text only. Two people who are online at the same time and fit each other's choices
// (age circle, who they want to meet, shared interests) are put in a short chat that is erased afterwards.
// They play up to 3 rounds of Truth or Dare questions; after each round each says Yes or No.
// If both say Yes at least 2 times out of 3 they become friends (a normal private chat opens). Otherwise they part.
const { ageOf, shareCircle, circlesOf, bandOf, screenText, reportTarget, pushUsers } = require('./community');

const ROUNDS = 3, NEED_YES = 2, WAIT_SECONDS = 120, COOLDOWN_HOURS = 24;
const GENDERS = ['m', 'f'], MEETS = ['m', 'f', 'both'];

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
    const p = (await sql`select id, nick, country, birthdate, interests, avatar, frame, langs from users where id = ${pid}`)[0];
    const mi = new Set(u.interests || []);
    return { id: p.id, nick: p.nick, country: p.country, age_band: bandOf(ageOf(p.birthdate)), avatar: p.avatar || '', frame: p.frame || '', langs: p.langs || [], shared: (p.interests || []).filter((x) => mi.has(x)) };
  };
  const stateOf = async (u, m) => {
    const pid = m.a === u.id ? m.b : m.a;
    const votes = await sql`select user_id, round, yes from match_votes where match_id = ${m.id}`;
    const mineV = votes.filter((v) => v.user_id === u.id), theirs = votes.filter((v) => v.user_id === pid);
    const round = m.round, myVote = mineV.find((v) => v.round === round), theirVote = theirs.find((v) => v.round === round);
    return { id: m.id, state: m.state, round, rounds: ROUNDS, need_yes: NEED_YES, voted: !!myVote, their_voted: !!theirVote, my_yes: mineV.filter((v) => v.yes).length, thread: m.thread_id || null };
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
  if (action === 'match_game') { // starts the next round: a Friendly question for both of them
    const u = await need(), m = await mine(u, idNum(b.match));
    if (m.state !== 'chat') throw bad('This chat is over', 409);
    if (m.round >= ROUNDS) throw bad('That was the last round. Say Yes or No.', 409);
    if (m.round > 0) { const v = await sql`select count(*)::int as n from match_votes where match_id = ${m.id} and round = ${m.round}`; if (v[0].n < 2) throw bad('Wait until you both answer Yes or No', 409); }
    const up = await sql`update matches set round = round + 1 where id = ${m.id} and round = ${m.round} returning round`;
    if (!up.length) return out({ ok: true });
    const q = await sql`select text from tod_questions where level = 1 and active order by random() limit 1`;
    await sql`insert into match_msgs (match_id, from_user, body, kind) values (${m.id}, ${u.id}, ${(q[0] && q[0].text) || 'Tell me something about you.'}, 'game')`;
    return out({ ok: true, round: up[0].round });
  }
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
  return false;
}
module.exports = { handle };
