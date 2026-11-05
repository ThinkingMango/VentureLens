begin;

-- Server-managed application settings. Only the service role may read or write.
create table if not exists public.app_settings (
  key text primary key check (char_length(key) between 1 and 100),
  value jsonb not null check (jsonb_typeof(value) = 'object'),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
alter table public.app_settings force row level security;
revoke all on public.app_settings from public, anon, authenticated;
grant all on public.app_settings to service_role;

-- Seed the research policy from the legacy copy on the owner's app_metadata, then fall back to defaults.
insert into public.app_settings (key, value, updated_by)
select 'research', u.raw_app_meta_data -> 'research_provider_settings', u.id
from auth.users u
where u.raw_app_meta_data ? 'research_provider_settings'
  and jsonb_typeof(u.raw_app_meta_data -> 'research_provider_settings') = 'object'
order by u.created_at
limit 1
on conflict (key) do nothing;
insert into public.app_settings (key, value)
values ('research', jsonb_build_object(
  'primary', 'qwen', 'autoFallback', true, 'budgetUsd', 0.25,
  'updatedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))
on conflict (key) do nothing;
update public.app_settings
  set value = value || jsonb_build_object('budgetUsd', 0.25)
  where key = 'research' and not (value ? 'budgetUsd');

-- One source of truth: drop the legacy copy from auth metadata.
update auth.users
  set raw_app_meta_data = raw_app_meta_data - 'research_provider_settings'
  where raw_app_meta_data ? 'research_provider_settings';

-- Administrators are identified by a server-managed role claim, never by email address.
-- Grant the role to the account that held the hard-coded administrator email.
update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
  where lower(email) = 'ventures@smartmango.ai' and email_confirmed_at is not null;

-- The per-run budget is a business parameter read from app_settings, bounded here as a safety net.
create or replace function public.research_budget_usd() returns numeric
language sql stable set search_path = '' as $$
  select least(5, greatest(0.05, coalesce(
    (select (value ->> 'budgetUsd')::numeric from public.app_settings where key = 'research'),
    0.25)));
$$;
revoke all on function public.research_budget_usd() from public, anon, authenticated;
alter table public.research_runs drop constraint if exists research_runs_budget_usd_check;
alter table public.research_runs add constraint research_runs_budget_usd_check check (budget_usd > 0 and budget_usd <= 5);
alter table public.research_runs alter column budget_usd set default 0.25;

create or replace function public.enqueue_research(p_user uuid, p_brief jsonb, p_profile jsonb, p_request uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r uuid; p uuid; a public.research_dev_access; begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select id into r from public.research_runs where user_id = p_user and request_key = p_request;
  if found then return r; end if;
  select * into a from public.research_dev_access where user_id = p_user and expires_at > now() for update;
  if not found then raise exception 'DEV_ACCESS_REQUIRED'; end if;
  if a.runs_used >= a.max_runs then raise exception 'DEV_QUOTA_EXCEEDED'; end if;
  if exists (select 1 from public.research_runs where user_id = p_user and status in ('pending', 'running')) then raise exception 'RUN_ALREADY_ACTIVE'; end if;
  insert into public.research_projects (user_id, name, sector, model, geography, context, discovery_mode)
    values (p_user, p_brief ->> 'name', p_brief ->> 'sector', p_brief ->> 'model', p_brief ->> 'geography', coalesce(p_brief ->> 'context', ''), coalesce(p_brief ->> 'discovery_mode', 'combined'))
    returning id into p;
  insert into public.research_runs (user_id, project_id, request_key, configuration, budget_usd)
    values (p_user, p, p_request, jsonb_build_object('brief', p_brief, 'profile', p_profile, 'methodology', 'evidence-driven-v1', 'target_opportunities', 8), public.research_budget_usd())
    returning id into r;
  update public.research_dev_access set runs_used = runs_used + 1 where user_id = p_user;
  return r;
end;
$$;
revoke all on function public.enqueue_research(uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.enqueue_research(uuid, jsonb, jsonb, uuid) to service_role;

commit;
