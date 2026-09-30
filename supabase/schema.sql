-- ADate backend (Supabase free tier). No user accounts: each invite has a secret owner token.
-- Tables are locked (RLS on, no policies); the site only talks to them through these functions.

create table if not exists public.adate_invites (
  id          text primary key check (id ~ '^[a-z0-9]{6,16}$'),
  token_hash  text not null,
  config      jsonb not null,
  created_at  timestamptz not null default now(),
  opens       int not null default 0,
  first_opened_at timestamptz,
  last_opened_at  timestamptz
);
create table if not exists public.adate_responses (
  id         bigint generated always as identity primary key,
  invite_id  text not null references public.adate_invites(id) on delete cascade,
  answer     jsonb not null,
  message    text,
  created_at timestamptz not null default now()
);
alter table public.adate_invites  enable row level security;
alter table public.adate_responses enable row level security;
revoke all on public.adate_invites, public.adate_responses from anon, authenticated;

create or replace function public.adate_hash(t text) returns text
language sql immutable as $$ select encode(sha256(convert_to(t, 'utf8')), 'hex') $$;

create or replace function public.adate_create_invite(p_id text, p_token text, p_config jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(p_token) < 16 then raise exception 'weak token'; end if;
  if pg_column_size(p_config) > 900000 then raise exception 'invite too large'; end if;
  insert into adate_invites(id, token_hash, config) values (p_id, adate_hash(p_token), p_config);
end $$;

create or replace function public.adate_update_invite(p_id text, p_token text, p_config jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if pg_column_size(p_config) > 900000 then raise exception 'invite too large'; end if;
  update adate_invites set config = p_config where id = p_id and token_hash = adate_hash(p_token);
  if not found then raise exception 'not allowed'; end if;
end $$;

-- Opening an invite counts as a view, so the sender can see "she opened it".
create or replace function public.adate_open_invite(p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb;
begin
  update adate_invites set opens = opens + 1,
         first_opened_at = coalesce(first_opened_at, now()), last_opened_at = now()
   where id = p_id returning config into c;
  return c;
end $$;

create or replace function public.adate_submit_response(p_id text, p_answer jsonb, p_message text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if pg_column_size(p_answer) > 8000 or length(coalesce(p_message, '')) > 1500 then raise exception 'too large'; end if;
  if not exists (select 1 from adate_invites where id = p_id) then raise exception 'unknown invite'; end if;
  if (select count(*) from adate_responses where invite_id = p_id) >= 20 then raise exception 'too many answers'; end if;
  insert into adate_responses(invite_id, answer, message) values (p_id, p_answer, p_message);
end $$;

create or replace function public.adate_get_status(p_id text, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare i adate_invites;
begin
  select * into i from adate_invites where id = p_id and token_hash = adate_hash(p_token);
  if not found then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'created_at', i.created_at, 'opens', i.opens, 'first_opened_at', i.first_opened_at, 'last_opened_at', i.last_opened_at,
    'config', i.config,
    'responses', coalesce((select jsonb_agg(jsonb_build_object('at', r.created_at, 'answer', r.answer, 'message', r.message) order by r.created_at desc)
                             from adate_responses r where r.invite_id = p_id), '[]'::jsonb));
end $$;

create or replace function public.adate_delete_invite(p_id text, p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from adate_invites where id = p_id and token_hash = adate_hash(p_token);
end $$;

revoke all on function public.adate_hash(text) from public, anon, authenticated;
grant execute on function
  public.adate_create_invite(text, text, jsonb), public.adate_update_invite(text, text, jsonb),
  public.adate_open_invite(text), public.adate_submit_response(text, jsonb, text),
  public.adate_get_status(text, text), public.adate_delete_invite(text, text)
to anon, authenticated;
