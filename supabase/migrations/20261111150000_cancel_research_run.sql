begin;

-- A founder can stop their own research while it is pending or running. The run ends as failed with error_code
-- CANCELLED, so every existing rule for a finished run applies unchanged: the one-active-run index frees the slot, the
-- run can be deleted, a running workflow is refused its next paid request (reserve_research_usage) and its report
-- (finish_research), and record_run_lifecycle_event writes run_finished once.
-- The refund follows release_failed_research_run: a run cancelled before it spent anything always gets its slot back;
-- one that already spent counts against the account's refund allowance like any other failure the founder caused.
-- CANCELLED is not retryable (retry_research accepts only operator-side failures): the founder starts a new run.
-- Returns the run's workflow id (null before dispatch) so the caller can also cancel the durable workflow.
create function public.cancel_research_run(p_run uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  run_status text;
  workflow text;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  select status, workflow_id into run_status, workflow
    from public.research_runs where id = p_run and user_id = uid for update;
  if not found then
    raise exception 'RUN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if run_status not in ('pending', 'running') then
    raise exception 'RUN_NOT_ACTIVE' using errcode = '55000';
  end if;
  update public.research_runs
    set status = 'failed', error_code = 'CANCELLED', completed_at = now()
    where id = p_run and user_id = uid;
  return workflow;
end;
$$;
revoke all on function public.cancel_research_run(uuid) from public, anon, authenticated;
grant execute on function public.cancel_research_run(uuid) to authenticated;

commit;
