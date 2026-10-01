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
