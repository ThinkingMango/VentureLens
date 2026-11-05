begin;

-- Where a research grant came from. 'signup' grants are limited to one per normalised email.
alter table public.research_dev_access
  add column if not exists source text not null default 'manual' check (source in ('manual', 'smartmango', 'signup'));

-- Set once a failed run has handed its slot back, so a run is never released twice.
alter table public.research_runs
  add column if not exists quota_released boolean not null default false;

-- Lower-case the address and drop a "+tag" from the local part so aliases cannot farm free runs.
create or replace function public.normalized_email(p_email text) returns text
language sql immutable set search_path = '' as $$
  select lower(regexp_replace(split_part(p_email, '@', 1), '\+.*$', '')) || '@' || lower(split_part(p_email, '@', 2));
$$;
revoke all on function public.normalized_email(text) from public, anon, authenticated;

-- Every confirmed account receives one free research run for 30 days.
-- smartmango.ai accounts are handled by sync_smartmango_research_access, which fires first.
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
  insert into public.research_dev_access (user_id, expires_at, max_runs, source)
  values (new.id, now() + interval '30 days', 1, 'signup')
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.grant_signup_research_run() from public, anon, authenticated;
drop trigger if exists zz_grant_signup_research_run on auth.users;
create trigger zz_grant_signup_research_run
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.grant_signup_research_run();

-- Backfill accounts that confirmed before this migration and hold no grant.
insert into public.research_dev_access (user_id, expires_at, max_runs, source)
select u.id, now() + interval '30 days', 1, 'signup'
from auth.users u
where u.email_confirmed_at is not null
  and lower(split_part(u.email, '@', 2)) <> 'smartmango.ai'
  and not exists (select 1 from public.research_dev_access a where a.user_id = u.id)
on conflict (user_id) do nothing;

-- A run only consumes its slot if it completes. The first transition into 'failed' hands the slot back.
create or replace function public.release_failed_research_run() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'failed' and old.status is distinct from 'failed' and not new.quota_released then
    update public.research_dev_access set runs_used = greatest(runs_used - 1, 0) where user_id = new.user_id;
    new.quota_released := true;
  end if;
  return new;
end;
$$;
revoke all on function public.release_failed_research_run() from public, anon, authenticated;
drop trigger if exists release_failed_research_run on public.research_runs;
create trigger release_failed_research_run
  before update of status on public.research_runs
  for each row execute function public.release_failed_research_run();

-- A manual retry takes the slot again (if one is free) and may also retry model-output and retrieval failures.
create or replace function public.retry_research(p_run uuid, p_user uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare r public.research_runs; a public.research_dev_access; begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select * into r from public.research_runs where id = p_run and user_id = p_user for update;
  if not found or r.status <> 'failed' or r.retry_count >= 1
     or r.error_code not in ('TRANSIENT_PROVIDER', 'WORKFLOW_INTERRUPTED', 'DISPATCH_FAILED', 'INVALID_OUTPUT', 'RETRIEVAL_UNAVAILABLE') then
    return false;
  end if;
  select * into a from public.research_dev_access where user_id = p_user and expires_at > now() for update;
  if not found then return false; end if;
  if exists (select 1 from public.research_runs where user_id = p_user and status in ('pending', 'running')) then return false; end if;
  if r.quota_released then
    if a.runs_used >= a.max_runs then return false; end if;
    update public.research_dev_access set runs_used = runs_used + 1 where user_id = p_user;
  end if;
  update public.research_runs
    set status = 'pending', stage = 'queued', workflow_id = null, error_code = null, completed_at = null,
        retry_count = retry_count + 1, quota_released = false
    where id = p_run and user_id = p_user;
  return true;
end;
$$;
revoke all on function public.retry_research(uuid, uuid) from public, anon, authenticated;
grant execute on function public.retry_research(uuid, uuid) to service_role;

commit;
