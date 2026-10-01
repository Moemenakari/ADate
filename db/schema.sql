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
