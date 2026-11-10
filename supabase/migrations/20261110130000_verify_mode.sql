begin;

-- WP-05 "Verify my idea": a research brief may now check one idea the founder already has (discovery_mode 'verify').
-- The idea (title, buyer, pain, optional offer and price hint) is stored on the project, and travels unchanged inside
-- the run's configuration like the rest of the brief. A project has an idea exactly when it is a verify brief.

alter table public.research_projects add column if not exists idea jsonb;

alter table public.research_projects drop constraint if exists research_projects_discovery_mode_check;
alter table public.research_projects add constraint research_projects_discovery_mode_check
  check (discovery_mode in ('founder', 'market', 'combined', 'verify'));

-- The application validates the idea's fields; the database bounds its shape and size, and keeps mode and idea in step.
alter table public.research_projects drop constraint if exists research_projects_idea_check;
alter table public.research_projects add constraint research_projects_idea_check check (
  (discovery_mode = 'verify') = (idea is not null)
  and (idea is null or (jsonb_typeof(idea) = 'object' and octet_length(idea::text) <= 4000))
);

-- Unchanged from 20261110025844 except that the brief's idea is stored on the project.
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
  insert into public.research_projects (user_id, name, sector, model, sectors, models, geography, context, discovery_mode, idea)
    values (
      p_user, p_brief ->> 'name', p_brief ->> 'sector', p_brief ->> 'model',
      case when jsonb_typeof(p_brief -> 'sectors') = 'array' then array(select jsonb_array_elements_text(p_brief -> 'sectors')) end,
      case when jsonb_typeof(p_brief -> 'models') = 'array' then array(select jsonb_array_elements_text(p_brief -> 'models')) end,
      p_brief ->> 'geography', coalesce(p_brief ->> 'context', ''), coalesce(p_brief ->> 'discovery_mode', 'combined'),
      case when jsonb_typeof(p_brief -> 'idea') = 'object' then p_brief -> 'idea' end)
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

-- Unchanged from 20261110120000 except that 'verify' is a recorded mode, and a verify run also records verify_started.
create or replace function public.record_run_lifecycle_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_mode text := new.configuration -> 'brief' ->> 'discovery_mode';
  v_language text := new.configuration -> 'brief' ->> 'language';
  v_props jsonb;
begin
  if v_mode is null or v_mode not in ('founder', 'market', 'combined', 'verify') then v_mode := null; end if;
  if v_language is null or v_language not in ('en', 'zh-Hans', 'zh-Hant') then v_language := null; end if;
  begin
    if tg_op = 'INSERT' then
      insert into public.product_events (user_id, event, props)
      values (new.user_id, 'run_started', jsonb_strip_nulls(jsonb_build_object('mode', v_mode, 'language', v_language)));
      if v_mode = 'verify' then
        insert into public.product_events (user_id, event, props) values (new.user_id, 'verify_started', '{}'::jsonb);
      end if;
    elsif new.status in ('completed', 'failed') and old.status is distinct from new.status then
      v_props := jsonb_build_object(
        'status', new.status,
        'error_code', case when new.error_code ~ '^[A-Z][A-Z0-9_]{0,39}$' then new.error_code end,
        'opportunities', (select count(*) from public.opportunities o where o.run_id = new.id and o.user_id = new.user_id));
      if v_mode is not null then v_props := v_props || jsonb_build_object('mode', v_mode); end if;
      insert into public.product_events (user_id, event, props) values (new.user_id, 'run_finished', v_props);
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;
revoke all on function public.record_run_lifecycle_event() from public, anon, authenticated;

commit;
