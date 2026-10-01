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
