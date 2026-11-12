begin;

-- Self-serve account deletion (enhancement plan WP-25, spec backlog #40). The account itself is deleted through the
-- Supabase admin API (app/api/account/route.ts), which removes the auth user; every founder table goes with it through
-- its `on delete cascade` foreign keys, and product_events keep their rows without the user (on delete set null).
-- Before that, prepare_account_deletion() runs as the founder and does what the cascade cannot.

-- A record of deleted accounts that received the sign-up grant, so deleting an account and signing up again with the
-- same address does not grant ten more free runs. It holds only a SHA-256 hash of the normalised address (the form
-- grant_signup_research_run compares) and the deletion time, and is kept for 12 months. Service role only.
create table public.deleted_signup_grants (
  email_hash text primary key check (email_hash ~ '^[0-9a-f]{64}$'),
  deleted_at timestamptz not null default now()
);
alter table public.deleted_signup_grants enable row level security;
alter table public.deleted_signup_grants force row level security;
revoke all on public.deleted_signup_grants from public, anon, authenticated;
grant select, insert, update, delete on public.deleted_signup_grants to service_role;

/** The hash stored for an address: hex SHA-256 of normalized_email(). */
create function public.signup_email_hash(p_email text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(public.normalized_email(p_email), 'UTF8')), 'hex');
$$;
revoke all on function public.signup_email_hash(text) from public, anon, authenticated;

/**
 * Runs as the founder just before their account is deleted. Refuses while a research run is still pending or running
 * (stop it first), so no workflow writes into an account that is being removed. Then:
 * - detaches the founder's usage rows (decision D6, as for a deleted run): cost accounting keeps them with no run or
 *   founder, and nothing in them identifies the founder;
 * - records the hashed address if the account had the sign-up grant, and forgets records older than 12 months.
 * Deleting the auth user afterwards removes everything else.
 */
create function public.prepare_account_deletion() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_email text;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if exists (select 1 from public.research_runs r where r.user_id = v_user and r.status in ('pending', 'running')) then
    raise exception 'RUN_ACTIVE' using errcode = '55000';
  end if;
  update public.research_usage set run_id = null, user_id = null where user_id = v_user;
  delete from public.deleted_signup_grants where deleted_at < now() - interval '12 months';
  if exists (select 1 from public.research_dev_access a where a.user_id = v_user and a.source = 'signup') then
    select u.email into v_email from auth.users u where u.id = v_user;
    if v_email is not null then
      insert into public.deleted_signup_grants (email_hash) values (public.signup_email_hash(v_email))
      on conflict (email_hash) do update set deleted_at = now();
    end if;
  end if;
end;
$$;
revoke all on function public.prepare_account_deletion() from public, anon, authenticated;
grant execute on function public.prepare_account_deletion() to authenticated;

-- The sign-up grant, unchanged from 20261111140000_signup_grant_ten_runs.sql except one check: no grant for an address
-- whose account had the sign-up grant and was deleted in the last 12 months.
create or replace function public.grant_signup_research_run() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or new.email_confirmed_at is null then return new; end if;
  if lower(split_part(new.email, '@', 2)) = 'smartmango.ai' then return new; end if;
  if exists (select 1 from public.research_dev_access a where a.user_id = new.id) then return new; end if;
  if exists (
    select 1 from public.research_dev_access a
    join auth.users u on u.id = a.user_id
    where a.source = 'signup' and u.id <> new.id
      and public.normalized_email(u.email) = public.normalized_email(new.email)
  ) then return new; end if;
  if exists (
    select 1 from public.deleted_signup_grants d
    where d.email_hash = public.signup_email_hash(new.email) and d.deleted_at > now() - interval '12 months'
  ) then return new; end if;
  insert into public.research_dev_access (user_id, expires_at, max_runs, source)
  values (new.id, now() + interval '90 days', 10, 'signup')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

commit;
