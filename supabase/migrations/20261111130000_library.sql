-- Library (spec WP-12): archive opportunities, and delete a whole research run.
--
-- Founders still have no write rights on opportunities or research_runs: both changes go through security-definer
-- functions that act only on the caller's own rows.
--
-- Decision D6 (2026-11-11): when a run is deleted, its usage rows are kept for cost accounting, detached from the run
-- and the founder (run_id and user_id cleared, detached_at set), so nothing in them identifies who ran it.

alter table public.opportunities add column archived_at timestamptz;

-- Usage rows can outlive their run. delete_research_run clears run_id and user_id before it deletes the run, so the
-- foreign key's cascade no longer reaches them; a row is attached to a run and its owner or to neither. Deleting an
-- account still deletes its usage rows through the same cascade, as the privacy notice says. Founders read usage through
-- a policy on user_id, so detached rows are invisible to them; the service role still counts them.
alter table public.research_usage
  alter column run_id drop not null,
  alter column user_id drop not null,
  add column detached_at timestamptz,
  add constraint research_usage_attached check ((run_id is null) = (user_id is null));
create index research_usage_detached_idx on public.research_usage (detached_at) where run_id is null;

create function public.mark_usage_detached() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.run_id is null and old.run_id is not null then
    new.detached_at := coalesce(new.detached_at, now());
  end if;
  return new;
end;
$$;
revoke all on function public.mark_usage_detached() from public, anon, authenticated;
create trigger research_usage_detached before update of run_id on public.research_usage
  for each row execute function public.mark_usage_detached();

-- Archive or restore one of the caller's opportunities. Archiving twice keeps the first time. Returns archived_at.
create function public.set_opportunity_archived(p_id uuid, p_archived boolean) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  result timestamptz;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  update public.opportunities
    set archived_at = case when p_archived then coalesce(archived_at, now()) else null end
    where id = p_id and user_id = uid
    returning archived_at into result;
  if not found then
    raise exception 'OPPORTUNITY_NOT_FOUND' using errcode = 'P0002';
  end if;
  return result;
end;
$$;
revoke all on function public.set_opportunity_archived(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_opportunity_archived(uuid, boolean) to authenticated;

-- Delete one of the caller's finished runs with everything made from it: opportunities, saves, evidence, stages,
-- feedback and validation sprints go by their cascades; usage rows are detached first (D6). The run's brief record goes too
-- unless another run still uses it. A pending or running run is refused, so a workflow never loses its run mid-way.
create function public.delete_research_run(p_run uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  run_status text;
  project uuid;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  select status, project_id into run_status, project
    from public.research_runs where id = p_run and user_id = uid for update;
  if not found then
    raise exception 'RUN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if run_status in ('pending', 'running') then
    raise exception 'RUN_ACTIVE' using errcode = '55006';
  end if;
  -- D6: keep the run's usage for cost accounting, with nothing linking it to the run or the founder.
  update public.research_usage set run_id = null, user_id = null where run_id = p_run and user_id = uid;
  delete from public.research_runs where id = p_run and user_id = uid;
  delete from public.research_projects p
    where p.id = project and p.user_id = uid
      and not exists (select 1 from public.research_runs r where r.project_id = p.id);
end;
$$;
revoke all on function public.delete_research_run(uuid) from public, anon, authenticated;
grant execute on function public.delete_research_run(uuid) to authenticated;
