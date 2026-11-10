-- A research brief may now name up to three industries and any number of acceptable business models.
-- The selections live in `sectors` and `models`. The single `sector` and `model` columns stay, always holding the first
-- selected value, so existing readers keep working; a trigger keeps both in step, so a writer that sends only the
-- legacy single value (an older deployment during a rollout or rollback) still produces a valid row.
begin;

alter table public.research_projects
  add column if not exists sectors text[],
  add column if not exists models text[];

update public.research_projects set sectors = array[sector] where sectors is null or cardinality(sectors) = 0;
update public.research_projects set models = array[model] where models is null or cardinality(models) = 0;

create or replace function public.sync_research_project_choices() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.sectors is null or cardinality(new.sectors) = 0 then new.sectors := array[new.sector]; end if;
  if new.models is null or cardinality(new.models) = 0 then new.models := array[new.model]; end if;
  new.sector := new.sectors[1];
  new.model := new.models[1];
  return new;
end;
$$;
revoke all on function public.sync_research_project_choices() from public, anon, authenticated;

drop trigger if exists sync_research_project_choices on public.research_projects;
create trigger sync_research_project_choices
  before insert or update of sector, model, sectors, models on public.research_projects
  for each row execute function public.sync_research_project_choices();

alter table public.research_projects
  alter column sectors set not null,
  alter column models set not null;

-- The application validates every value against its option lists; the database bounds shape and size, as it does
-- for the single-value columns. Up to 3 industries and 10 named models (the "open" option stands alone).
alter table public.research_projects drop constraint if exists research_projects_sectors_check;
alter table public.research_projects add constraint research_projects_sectors_check check (
  cardinality(sectors) between 1 and 3
  and array_position(sectors, null) is null
  and char_length(array_to_string(sectors, '')) <= 300
);
alter table public.research_projects drop constraint if exists research_projects_models_check;
alter table public.research_projects add constraint research_projects_models_check check (
  cardinality(models) between 1 and 10
  and array_position(models, null) is null
  and char_length(array_to_string(models, '')) <= 1000
);

-- Unchanged from 20261105161832 except that the brief's selections are stored. A brief without them (the legacy
-- single-value shape) is still accepted: the trigger derives the selections from `sector` and `model`.
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
  insert into public.research_projects (user_id, name, sector, model, sectors, models, geography, context, discovery_mode)
    values (
      p_user, p_brief ->> 'name', p_brief ->> 'sector', p_brief ->> 'model',
      case when jsonb_typeof(p_brief -> 'sectors') = 'array' then array(select jsonb_array_elements_text(p_brief -> 'sectors')) end,
      case when jsonb_typeof(p_brief -> 'models') = 'array' then array(select jsonb_array_elements_text(p_brief -> 'models')) end,
      p_brief ->> 'geography', coalesce(p_brief ->> 'context', ''), coalesce(p_brief ->> 'discovery_mode', 'combined'))
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
