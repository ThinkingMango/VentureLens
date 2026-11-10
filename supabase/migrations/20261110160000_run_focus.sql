begin;

-- WP-03 run focus: a brief may carry up to six "angles" (quick constraints for one run, such as "No paid ads to start")
-- and an "explore something new" switch. Existing briefs read as no angles and the switch off. As with the other brief
-- columns, the application validates the allowed angles; the database bounds their number and size.
alter table public.research_projects
  add column if not exists angles text[] not null default '{}' check (
    cardinality(angles) <= 6
    and array_position(angles, null) is null
    and char_length(array_to_string(angles, '')) <= 300
  ),
  add column if not exists explore_new boolean not null default false;

-- Unchanged from 20261110130000 except that the brief's angles and explore_new are stored on the project.
-- (The run's configuration already keeps the whole brief JSON as given, so the run sees them either way.)
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
  insert into public.research_projects (user_id, name, sector, model, sectors, models, geography, context, discovery_mode, idea, angles, explore_new)
    values (
      p_user, p_brief ->> 'name', p_brief ->> 'sector', p_brief ->> 'model',
      case when jsonb_typeof(p_brief -> 'sectors') = 'array' then array(select jsonb_array_elements_text(p_brief -> 'sectors')) end,
      case when jsonb_typeof(p_brief -> 'models') = 'array' then array(select jsonb_array_elements_text(p_brief -> 'models')) end,
      p_brief ->> 'geography', coalesce(p_brief ->> 'context', ''), coalesce(p_brief ->> 'discovery_mode', 'combined'),
      case when jsonb_typeof(p_brief -> 'idea') = 'object' then p_brief -> 'idea' end,
      case when jsonb_typeof(p_brief -> 'angles') = 'array' then array(select jsonb_array_elements_text(p_brief -> 'angles')) else '{}' end,
      coalesce((p_brief ->> 'explore_new')::boolean, false))
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
