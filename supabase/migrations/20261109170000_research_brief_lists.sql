begin;

-- A research brief can name up to two industries and up to three business models. The lists are stored in new
-- columns; `sector` and `model` keep the first choice, so anything that reads one value still works.
--
-- The trigger keeps both forms in step, which makes this migration safe to apply before or after the application
-- code that writes the lists: an insert that sets only `sector` and `model` (the earlier code, or the earlier
-- enqueue_research) gets lists of one, and an insert that sets the lists gets the first choice in the single columns.
alter table public.research_projects
  add column sectors text[],
  add column models text[];

update public.research_projects set sectors = array[sector], models = array[model];

create or replace function public.sync_research_project_lists() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    -- An update that changes only a single value replaces that list.
    if new.sectors is not distinct from old.sectors and new.sector is distinct from old.sector then new.sectors := array[new.sector]; end if;
    if new.models is not distinct from old.models and new.model is distinct from old.model then new.models := array[new.model]; end if;
  end if;
  if new.sectors is null or cardinality(new.sectors) = 0 then new.sectors := array[new.sector]; end if;
  if new.models is null or cardinality(new.models) = 0 then new.models := array[new.model]; end if;
  new.sector := new.sectors[1];
  new.model := new.models[1];
  return new;
end;
$$;
revoke all on function public.sync_research_project_lists() from public, anon, authenticated;

create trigger sync_research_project_lists
  before insert or update on public.research_projects
  for each row execute function public.sync_research_project_lists();

-- Values are validated by the application against the option lists; these checks bound the shape.
alter table public.research_projects
  alter column sectors set not null,
  alter column models set not null,
  add constraint research_projects_sectors_check check (
    cardinality(sectors) between 1 and 2 and array_position(sectors, null) is null
    and sectors[1] = sector and char_length(array_to_string(sectors, ',')) <= 201
  ),
  add constraint research_projects_models_check check (
    cardinality(models) between 1 and 3 and array_position(models, null) is null
    and models[1] = model and char_length(array_to_string(models, ',')) <= 302
  );

-- Unchanged from 20261105161832 except that the project row also receives the lists. A brief without lists (sent
-- by the earlier application code) still works: the trigger fills them from the single values.
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
      p_user, p_brief ->> 'name',
      coalesce(p_brief -> 'sectors' ->> 0, p_brief ->> 'sector'), coalesce(p_brief -> 'models' ->> 0, p_brief ->> 'model'),
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
