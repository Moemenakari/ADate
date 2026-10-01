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
