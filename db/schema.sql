-- ADate on Neon (Postgres). Applied once; the API in /api talks to it with a server-side connection string.
create table if not exists invites (
  id text primary key check (id ~ '^[a-z0-9]{6,16}$'),
  token_hash text not null,
  config jsonb not null,
  sender_name text, sender_phone text, to_name text, type text,
  consent boolean not null default false,
  created_at timestamptz not null default now(),
  opens int not null default 0, first_opened_at timestamptz, last_opened_at timestamptz
);
create table if not exists responses (
  id bigint generated always as identity primary key,
  invite_id text not null references invites(id) on delete cascade,
  answer jsonb not null, message text, receiver_phone text,
  created_at timestamptz not null default now()
);
create index if not exists responses_invite_idx on responses(invite_id);
create index if not exists invites_created_idx on invites(created_at desc);

-- Accounts: phone number + password (scrypt hash, never stored in clear) and a security question for resets.
create table if not exists users (
  id bigint generated always as identity primary key,
  phone text unique not null, name text, email text,
  pass_salt text not null, pass_hash text not null,
  question text, answer_salt text, answer_hash text,
  fails int not null default 0, locked_until timestamptz,
  created_at timestamptz not null default now(), last_login_at timestamptz
);
create table if not exists sessions (
  token_hash text primary key,
  user_id bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on sessions(user_id);
alter table invites add column if not exists user_id bigint references users(id) on delete set null;
create index if not exists invites_user_idx on invites(user_id);
alter table responses add column if not exists seen_at timestamptz;

-- Journey: which screen a viewer reached and how many times they pressed "No" (visitor = anonymous random id per browser).
create table if not exists events (
  id bigint generated always as identity primary key,
  invite_id text not null references invites(id) on delete cascade,
  kind text not null, data jsonb, visitor text,
  created_at timestamptz not null default now()
);
create index if not exists events_invite_idx on events(invite_id, created_at);

-- Phone notifications (Web Push): one row per subscribed phone/browser.
create table if not exists push_subs (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  endpoint text unique not null, p256dh text not null, auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on push_subs(user_id);
alter table invites add column if not exists last_notified_at timestamptz;

-- Who the invite is for (their WhatsApp number or @instagram) and what the receiver left at the end.
alter table invites add column if not exists to_contact text;
alter table responses add column if not exists receiver_ig text;

-- Sign in with Google, then a profile (name, number, birthday, interests) before the ADate game.
alter table users alter column phone drop not null;
alter table users alter column pass_salt drop not null;
alter table users alter column pass_hash drop not null;
alter table users add column if not exists google_sub text unique;
alter table users add column if not exists first_name text;
alter table users add column if not exists last_name text;
alter table users add column if not exists birthdate date;
alter table users add column if not exists interests text[];
alter table users add column if not exists profile_done boolean not null default false;

-- Owner tools: block an account, mark it verified. Receivers' typed-but-unsent contacts arrive as events of kind 'contact'.
alter table users add column if not exists blocked boolean not null default false;
alter table users add column if not exists blocked_note text;
alter table users add column if not exists verified boolean not null default false;

-- Owner settings (his WhatsApp for number verification, Whish payment link), second recovery question, verification code.
create table if not exists settings (key text primary key, value text);
alter table users add column if not exists question2 text;
alter table users add column if not exists answer2_salt text;
alter table users add column if not exists answer2_hash text;
alter table users add column if not exists verify_code text;

-- ===== Community: nicknames, rooms, chat, private messages, points, referrals, reports =====
alter table users add column if not exists nick text;
alter table users add column if not exists country text;
alter table users add column if not exists muted_until timestamptz;
alter table users add column if not exists is_admin boolean not null default false;
alter table users add column if not exists ref_code text unique;
alter table users add column if not exists referred_by bigint;
alter table users add column if not exists theme text;
alter table users add column if not exists avatar text;
create table if not exists nicknames (user_id bigint not null references users(id) on delete cascade, country text not null, nick text not null, primary key (user_id, country));
create unique index if not exists nicknames_unique on nicknames (country, lower(nick));
create table if not exists rooms (id bigserial primary key, slug text unique not null, title text not null, emoji text, kind text not null default 'interest', country text, interest text, free boolean not null default false, active boolean not null default true, created_at timestamptz not null default now());
create table if not exists room_members (room_id bigint not null references rooms(id) on delete cascade, user_id bigint not null references users(id) on delete cascade, joined_at timestamptz not null default now(), primary key (room_id, user_id));
create table if not exists messages (id bigserial primary key, room_id bigint not null references rooms(id) on delete cascade, user_id bigint not null references users(id) on delete cascade, nick text not null, body text not null, created_at timestamptz not null default now(), expires_at timestamptz not null default now() + interval '3 days');
create index if not exists messages_room_idx on messages (room_id, id);
create index if not exists messages_exp_idx on messages (expires_at);
create table if not exists dm_threads (id bigserial primary key, a bigint not null references users(id) on delete cascade, b bigint not null references users(id) on delete cascade, started_by bigint not null, status text not null default 'pending', created_at timestamptz not null default now(), unique (a, b));
create table if not exists dm_messages (id bigserial primary key, thread_id bigint not null references dm_threads(id) on delete cascade, from_user bigint not null references users(id) on delete cascade, body text not null, created_at timestamptz not null default now(), expires_at timestamptz not null default now() + interval '3 days');
create index if not exists dm_messages_idx on dm_messages (thread_id, id);
create table if not exists points_ledger (id bigserial primary key, user_id bigint not null references users(id) on delete cascade, delta int not null, reason text not null, ref text, created_at timestamptz not null default now());
create index if not exists points_user_idx on points_ledger (user_id, created_at);
create table if not exists referrals (invited_id bigint primary key references users(id) on delete cascade, inviter_id bigint not null references users(id) on delete cascade, counted boolean not null default false, created_at timestamptz not null default now());
create table if not exists blocks (blocker bigint not null references users(id) on delete cascade, blocked bigint not null references users(id) on delete cascade, created_at timestamptz not null default now(), primary key (blocker, blocked));
create table if not exists reports (id bigserial primary key, reporter bigint not null, target bigint not null, where_kind text, room_id bigint, body text, created_at timestamptz not null default now());
create index if not exists reports_target_idx on reports (target, created_at);
insert into rooms (slug, title, emoji, kind, country, interest, free) values
  ('gaming','Gaming','🎮','interest',NULL,'Gaming',true),
  ('music','Music','🎵','interest',NULL,'Music',true),
  ('books','Books','📚','interest',NULL,'Books',false),
  ('movies','Movies & series','🎬','interest',NULL,'Movies & series',false),
  ('football','Football','⚽','interest',NULL,'Football',false),
  ('gym','Gym & fitness','💪','interest',NULL,'Gym & fitness',false),
  ('travel','Travel','✈️','interest',NULL,'Travel',false),
  ('cooking','Cooking','🍳','interest',NULL,'Cooking',false),
  ('animals','Animals','🐶','interest',NULL,'Animals',false),
  ('art','Art & drawing','🎨','interest',NULL,'Art & drawing',false),
  ('photography','Photography','📷','interest',NULL,'Photography',false),
  ('tech','Tech & coding','💻','interest',NULL,'Tech & coding',false),
  ('fashion','Fashion','👗','interest',NULL,'Fashion',false),
  ('nature','Nature & hiking','🌿','interest',NULL,'Nature & hiking',false),
  ('anime','Anime','🍥','interest',NULL,'Anime',false),
  ('coffee','Coffee spots','☕','interest',NULL,'Coffee spots',false),
  ('singing','Singing','🎤','interest',NULL,'Singing',false),
  ('dancing','Dancing','💃','interest',NULL,'Dancing',false),
  ('psychology','Psychology','🧠','interest',NULL,'Psychology',false),
  ('cars','Cars','🚗','interest',NULL,'Cars',false),
  ('beach','Beach','🏖️','interest',NULL,'Beach',false),
  ('boardgames','Board games','🎲','interest',NULL,'Board games',false),
  ('writing','Writing','✍️','interest',NULL,'Writing',false),
  ('languages','Languages','🗣️','interest',NULL,'Languages',false),
  ('basketball','Basketball','🏀','interest',NULL,NULL,false),
  ('kpop','K-pop','🎧','interest',NULL,NULL,false),
  ('arabic-music','Arabic music','🎶','interest',NULL,NULL,false),
  ('series','Series talk','📺','interest',NULL,NULL,false),
  ('memes','Memes','😂','interest',NULL,NULL,true),
  ('study','Study help','📖','interest',NULL,NULL,true),
  ('startups','Startups & ideas','💡','interest',NULL,NULL,false),
  ('cats','Cats','🐱','interest',NULL,NULL,false),
  ('skincare','Skincare & beauty','💄','interest',NULL,NULL,false),
  ('cycling','Cycling','🚴','interest',NULL,NULL,false),
  ('chess','Chess','♟️','interest',NULL,NULL,false),
  ('poetry','Poetry','🌙','interest',NULL,NULL,false),
  ('podcasts','Podcasts','🎙️','interest',NULL,NULL,false),
  ('make-friends','Make new friends','🤝','interest',NULL,NULL,true),
  ('lebanese-food','Lebanese food','🥙','interest',NULL,NULL,true),
  ('road-trips','Road trips','🛣️','interest',NULL,NULL,false),
  ('beirut','Beirut','📍','region','LB',NULL,true),
  ('tripoli','Tripoli','📍','region','LB',NULL,true),
  ('sidon','Sidon','📍','region','LB',NULL,true),
  ('tyre','Tyre','📍','region','LB',NULL,true),
  ('baalbek','Baalbek','📍','region','LB',NULL,true),
  ('batroun','Batroun','📍','region','LB',NULL,true),
  ('byblos','Byblos (Jbeil)','📍','region','LB',NULL,true),
  ('zahle','Zahle','📍','region','LB',NULL,true),
  ('jounieh','Jounieh','📍','region','LB',NULL,true),
  ('metn','Metn','📍','region','LB',NULL,true),
  ('chouf','Chouf','📍','region','LB',NULL,true),
  ('akkar','Akkar','📍','region','LB',NULL,true),
  ('nabatieh','Nabatieh','📍','region','LB',NULL,true),
  ('bekaa','Bekaa','📍','region','LB',NULL,true),
  ('south-lebanon','South Lebanon','📍','region','LB',NULL,true),
  ('north-lebanon','North Lebanon','📍','region','LB',NULL,true),
  ('uae','UAE','📍','region','AE',NULL,true),
  ('saudi','Saudi Arabia','📍','region','SA',NULL,true),
  ('qatar','Qatar','📍','region','QA',NULL,true),
  ('kuwait','Kuwait','📍','region','KW',NULL,true),
  ('france','France','📍','region','FR',NULL,true),
  ('usa','USA','📍','region','US',NULL,true),
  ('canada','Canada','📍','region','CA',NULL,true),
  ('australia','Australia','📍','region','AU',NULL,true),
  ('germany','Germany','📍','region','DE',NULL,true),
  ('uk','United Kingdom','📍','region','GB',NULL,true),
  ('africa','Africa','📍','region','AF',NULL,true),
  ('egypt','Egypt','📍','region','EG',NULL,true),
  ('halloween-2026','Halloween night 2026','🎃','season',NULL,NULL,true)
on conflict (slug) do nothing;

-- ===== Truth or Dare: question bank, 24-hour unlocks paid in points =====
create table if not exists tod_questions (id serial primary key, level int not null, kind text not null, text text not null, active boolean not null default true);
create index if not exists tod_questions_level_idx on tod_questions (level, kind);
create table if not exists tod_unlocks (user_id bigint not null references users(id) on delete cascade, level int not null, until timestamptz not null, primary key (user_id, level));
insert into tod_questions (level, kind, text) select v.level, v.kind, v.text from (values
  (1,'truth','What is the funniest thing that ever happened to you at school?'),
  (1,'truth','Which song do you secretly love but never admit?'),
  (1,'truth','What is your most useless talent?'),
  (1,'truth','What was your favorite cartoon as a kid?'),
  (1,'truth','If you could have any superpower for one day, what would it be?'),
  (1,'truth','What is the silliest thing you are afraid of?'),
  (1,'truth','Which food could you eat every single day?'),
  (1,'truth','What is the best gift you ever received?'),
  (1,'truth','Who is the friend you can always count on, and why?'),
  (1,'truth','What is one thing you want to learn this year?'),
  (1,'truth','What is your go-to karaoke song?'),
  (1,'truth','What is the weirdest dream you remember?'),
  (1,'dare','Sing the chorus of your favorite song out loud.'),
  (1,'dare','Do ten jumping jacks and tell everyone how you feel.'),
  (1,'dare','Talk in a funny accent for the next three minutes.'),
  (1,'dare','Make up a two-line poem about the person next to you.'),
  (1,'dare','Say the alphabet backwards as fast as you can.'),
  (1,'dare','Describe your whole day using only emojis.'),
  (1,'dare','Invent a new handshake and teach it to someone.'),
  (1,'dare','Tell a joke and keep going until someone laughs.'),
  (1,'dare','Act like a news reporter describing what you are doing right now.'),
  (1,'dare','Walk like a penguin to the other side of the room.'),
  (1,'dare','Make the silliest face you can and hold it for ten seconds.'),
  (1,'dare','Say a tongue twister three times fast.'),
  (2,'truth','What is something you are proud of but rarely talk about?'),
  (2,'truth','What is a mistake that taught you something important?'),
  (2,'truth','What is the nicest thing someone ever did for you?'),
  (2,'truth','What do you do when you feel really sad?'),
  (2,'truth','What is a habit you want to quit?'),
  (2,'truth','Which friend would you trust with a big secret?'),
  (2,'truth','What is the most embarrassing photo on your phone? Describe it.'),
  (2,'truth','What is a lie you told that you still remember?'),
  (2,'truth','What is something you wish your parents understood about you?'),
  (2,'truth','If you could change one thing about yourself, what would it be?'),
  (2,'truth','What is the bravest thing you have ever done?'),
  (2,'truth','What is your biggest dream for the next five years?'),
  (2,'dare','Let the group choose a nickname for you for the whole day.'),
  (2,'dare','Text someone you have not talked to in a long time and say hi.'),
  (2,'dare','Give a sincere compliment to everyone around you.'),
  (2,'dare','Do your best impression of a friend and let others guess who.'),
  (2,'dare','Share your most played song and defend it.'),
  (2,'dare','Tell the group the first thing you did when you woke up today.'),
  (2,'dare','Let someone else write your next status.'),
  (2,'dare','Speak only in questions for the next five minutes.'),
  (2,'dare','Do your best dance move for ten seconds.'),
  (2,'dare','Say something kind about yourself, out loud, three times.'),
  (2,'dare','Tell the group your most unusual talent and show it.'),
  (2,'dare','Keep eye contact with someone for fifteen seconds without laughing.'),
  (3,'truth','What is your idea of a perfect first date?'),
  (3,'truth','What makes someone attractive to you besides looks?'),
  (3,'truth','What is the sweetest message you ever received?'),
  (3,'truth','What is your biggest turn-off?'),
  (3,'truth','Describe your ideal partner in three words.'),
  (3,'truth','What is the most romantic thing you have done or want to do?'),
  (3,'truth','Have you ever had a crush you never told anyone about?'),
  (3,'truth','What is a love song that describes how you feel right now?'),
  (3,'truth','What is the most thoughtful gesture someone could make for you?'),
  (3,'truth','What would your dream weekend with someone special look like?'),
  (3,'dare','Give the person on your right a genuine compliment.'),
  (3,'dare','Write a cheesy pickup line and rate it out of ten.'),
  (3,'dare','Describe your dream date in exactly one sentence.'),
  (3,'dare','Tell the group what you would cook for a romantic dinner.'),
  (3,'dare','Send a heart to someone you appreciate and tell us who.'),
  (3,'dare','Read the last sweet thing you wrote to someone, without names.'),
  (3,'dare','Make up a love poem about pizza in thirty seconds.'),
  (3,'dare','Pick a movie for a perfect date night and explain why.'),
  (4,'truth','What is the most flirty thing you have ever said?'),
  (4,'truth','What makes you notice someone the moment they walk in?'),
  (4,'truth','Have you ever sent a message and regretted how flirty it was?'),
  (4,'truth','What is the most daring thing you did to impress a crush?'),
  (4,'truth','What compliment makes you blush the most?'),
  (4,'truth','What is your favorite way to flirt: words, looks, or humor?'),
  (4,'truth','Who was your most memorable crush and why?'),
  (4,'truth','What is your secret talent for making someone smile?'),
  (4,'dare','Say your best flirty line out loud, with a straight face.'),
  (4,'dare','Write the cheesiest love text you can and read it dramatically.'),
  (4,'dare','Tell the group the one compliment that would make you blush.'),
  (4,'dare','Give your most charming smile and hold it for five seconds.'),
  (4,'dare','Describe your perfect romantic evening in three sentences.'),
  (4,'dare','Whisper something sweet to the next person who speaks.'),
  (4,'dare','Tell us what your first message to a crush would be.'),
  (4,'dare','Rate your flirting skills out of ten and justify it.'),
  (5,'truth','What do you find irresistible in a partner?'),
  (5,'truth','What is the most romantic risk you ever took?'),
  (5,'truth','Have you ever been drawn to someone you probably should not have been?'),
  (5,'truth','What is your love language and how do you show desire?'),
  (5,'truth','What do you want more of in your love life?'),
  (5,'truth','What was the boldest thing you ever did on a date?'),
  (5,'truth','What is something about attraction you only learned with experience?'),
  (5,'truth','When did you last feel truly swept off your feet?'),
  (5,'dare','Describe your most attractive quality as confidently as you can.'),
  (5,'dare','Tell the group about the best kiss you remember, in one sentence.'),
  (5,'dare','Send your best miss-you message to someone and share their reaction.'),
  (5,'dare','Describe the perfect slow dance: the song, the place, the person.'),
  (5,'dare','Tell us what a perfect night in with someone special looks like.'),
  (5,'dare','Give a dramatic reading of your favorite love scene from a movie.'),
  (5,'dare','Say what you would want your partner to notice about you first.'),
  (5,'dare','Tell the group your most unforgettable date in three sentences.')
) as v(level, kind, text) where not exists (select 1 from tod_questions);

-- ===== Buying points with Whish: the owner approves each claim =====
create table if not exists orders (id bigserial primary key, user_id bigint not null references users(id) on delete cascade, kind text not null, cents int not null, status text not null default 'pending', note text, created_at timestamptz not null default now(), decided_at timestamptz);
create index if not exists orders_status_idx on orders (status, id);

-- ===== Real photo (25 points), seasonal frames (5 points) =====
alter table users add column if not exists photo text;
alter table users add column if not exists photo_ok boolean not null default false;
alter table users add column if not exists frames text[];
alter table users add column if not exists frame text;

-- ===== Real photo is a monthly pass (25 points / 30 days) =====
alter table users add column if not exists photo_until timestamptz;
update users set photo_until = now() + interval '30 days' where photo_ok and photo_until is null;

-- ===== Random matching (text only) =====
alter table users add column if not exists gender text;
alter table users add column if not exists meet text;
alter table users add column if not exists langs text[];
create table if not exists match_queue (user_id bigint primary key references users(id) on delete cascade, since timestamptz not null default now());
create table if not exists matches (id bigserial primary key, a bigint not null references users(id) on delete cascade, b bigint not null references users(id) on delete cascade, state text not null default 'chat', round int not null default 0, thread_id bigint, seen_by bigint[] not null default '{}', created_at timestamptz not null default now(), ended_at timestamptz);
create index if not exists matches_a_idx on matches (a, state);
create index if not exists matches_b_idx on matches (b, state);
create table if not exists match_msgs (id bigserial primary key, match_id bigint not null references matches(id) on delete cascade, from_user bigint not null references users(id) on delete cascade, body text not null, kind text not null default 'text', created_at timestamptz not null default now());
create index if not exists match_msgs_idx on match_msgs (match_id, id);
create table if not exists match_votes (match_id bigint not null references matches(id) on delete cascade, user_id bigint not null references users(id) on delete cascade, round int not null, yes boolean not null, primary key (match_id, user_id, round));

create table if not exists swipes (from_user bigint not null references users(id) on delete cascade, to_user bigint not null references users(id) on delete cascade, act text not null, created_at timestamptz not null default now(), primary key (from_user, to_user));

create table if not exists match_games (match_id bigint not null references matches(id) on delete cascade, round int not null, type text not null, state jsonb not null, primary key (match_id, round));

-- ===== Messages from the ADate team (with optional gift points) =====
create table if not exists notices (id bigserial primary key, user_id bigint not null references users(id) on delete cascade, body text not null, points int not null default 0, read boolean not null default false, created_at timestamptz not null default now());
create index if not exists notices_user_idx on notices (user_id, read, id);

-- ===== Verified by selfie (the picture is deleted as soon as the owner decides) =====
alter table users add column if not exists selfie text;
alter table users add column if not exists selfie_state text not null default 'none';
alter table users add column if not exists selfie_code int;
alter table users add column if not exists selfie_ok boolean not null default false;
alter table users add column if not exists selfie_at timestamptz;

-- ===== Account roles shown as a badge: mod, agent (the owner is is_admin) =====
alter table users add column if not exists role text;

-- ===== Online and last seen =====
alter table users add column if not exists last_seen timestamptz;

-- ===== Games between friends, and paid unlocks of chats =====
create table if not exists fgames (id bigserial primary key, thread_id bigint not null references dm_threads(id) on delete cascade, type text not null, state jsonb not null, status text not null default 'invited', started_by bigint not null references users(id) on delete cascade, created_at timestamptz not null default now());
create index if not exists fgames_thread_idx on fgames (thread_id, status);
alter table dm_threads add column if not exists source text;
alter table dm_threads add column if not exists unlock_until timestamptz;
alter table dm_threads add column if not exists unlocked boolean not null default false;

-- ===== Game invitations (3 games, the invited person decides), boosted messages =====
alter table dm_threads add column if not exists boosted boolean not null default false;
alter table matches add column if not exists kind text not null default 'random';
alter table matches add column if not exists invited_by bigint;
alter table matches add column if not exists judge bigint;

-- ===== Schools in the north, social accounts (18+ only) =====
insert into rooms (slug, title, emoji, kind, country, interest, free) values
  ('schools-tripoli','Schools: Tripoli','🏫','school','LB',NULL,true),
  ('schools-koura','Schools: Koura','🏫','school','LB',NULL,true),
  ('schools-zgharta','Schools: Zgharta','🏫','school','LB',NULL,true),
  ('schools-batroun','Schools: Batroun','🏫','school','LB',NULL,true),
  ('schools-akkar','Schools: Akkar','🏫','school','LB',NULL,true),
  ('schools-minieh','Schools: Minieh-Danniyeh','🏫','school','LB',NULL,true),
  ('schools-bcharre','Schools: Bcharre','🏫','school','LB',NULL,true),
  ('unis-north','Universities: the North','🎓','school','LB',NULL,true)
on conflict (slug) do nothing;
alter table users add column if not exists socials jsonb;
create table if not exists social_unlocks (viewer bigint not null references users(id) on delete cascade, target bigint not null references users(id) on delete cascade, created_at timestamptz not null default now(), primary key (viewer, target));

-- ===== Streaks between friends, fast replies, who viewed my profile =====
alter table dm_threads add column if not exists streak int not null default 0;
alter table dm_threads add column if not exists streak_day date;
alter table dm_threads add column if not exists a_day date;
alter table dm_threads add column if not exists b_day date;
alter table users add column if not exists reply_n int not null default 0;
alter table users add column if not exists reply_secs bigint not null default 0;
create table if not exists profile_views (id bigserial primary key, viewer bigint not null references users(id) on delete cascade, target bigint not null references users(id) on delete cascade, notified boolean not null default false, created_at timestamptz not null default now());
create index if not exists profile_views_target_idx on profile_views (target, id desc);

alter table users add column if not exists nudge_off boolean not null default false;
alter table users add column if not exists nudged_at timestamptz;
create table if not exists notif_mutes (user_id bigint not null references users(id) on delete cascade, kind text not null, ref bigint not null, primary key (user_id, kind, ref));
update users set nick = 'Bot' where phone = 'bot-engy';

-- ===== Schools map =====
create table if not exists places (id bigserial primary key, name text not null, kind text not null default 'school', lat double precision not null, lng double precision not null, active boolean not null default true, created_at timestamptz not null default now());
alter table users add column if not exists place_id bigint references places(id) on delete set null;
insert into places (name, kind, lat, lng) select v.n, v.k, v.a, v.b from (values
  ('Schools of Tripoli','area',34.4367,35.8497), ('Schools of Koura','area',34.3036,35.8030), ('Schools of Zgharta','area',34.3975,35.8944),
  ('Schools of Batroun','area',34.2553,35.6586), ('Schools of Akkar','area',34.5481,36.0783), ('Schools of Minieh-Danniyeh','area',34.4592,35.9433),
  ('Schools of Bcharre','area',34.2500,36.0097), ('Universities of the North','area',34.3667,35.7333)) as v(n,k,a,b)
  where not exists (select 1 from places p where p.name = v.n);

-- ===== Check-ins, reviews and place suggestions =====
alter table places add column if not exists suggested_by bigint references users(id) on delete set null;
create table if not exists place_checkins (id bigserial primary key, user_id bigint not null references users(id) on delete cascade, place_id bigint not null references places(id) on delete cascade, created_at timestamptz not null default now());
create index if not exists place_checkins_idx on place_checkins (place_id, user_id, created_at desc);
create table if not exists place_reviews (place_id bigint not null references places(id) on delete cascade, user_id bigint not null references users(id) on delete cascade, rating int not null check (rating between 1 and 5), body text not null default '', created_at timestamptz not null default now(), primary key (place_id, user_id));

-- friends can see which place I am at (place only, never exact position), off unless I switch it on
alter table users add column if not exists share_place boolean not null default false;

alter table places add column if not exists osm_id text;
create unique index if not exists places_osm_idx on places (osm_id) where osm_id is not null;
