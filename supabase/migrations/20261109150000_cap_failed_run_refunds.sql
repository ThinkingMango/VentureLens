begin;

-- Since 20261105155412 every failed run hands its slot back. A run that fails after spending (for example a vague
-- brief whose hypotheses never pass the evidence gate) therefore cost the user nothing, so one account could start
-- paid runs without limit, one at a time. Refunds now follow who caused the failure and whether it cost anything:
--   * failures on our side, and runs that spent nothing, are always returned;
--   * any other failed run is returned only while the grant's refund allowance lasts (max_refunds, default 3).
-- A failed run that is not returned keeps its slot, so retrying that same run (retry_research) stays free.

alter table public.research_dev_access
  add column if not exists runs_refunded integer not null default 0 check (runs_refunded >= 0),
  add column if not exists max_refunds integer not null default 3 check (max_refunds between 0 and 100);

create or replace function public.release_failed_research_run() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  operator_fault boolean;
  spent numeric;
begin
  if new.status = 'failed' and old.status is distinct from 'failed' and not new.quota_released then
    -- Provider outages, configuration, credits and platform interruptions are never the founder's doing.
    operator_fault := coalesce(new.error_code, '') in
      ('DISPATCH_FAILED', 'WORKFLOW_INTERRUPTED', 'TRANSIENT_PROVIDER', 'PROVIDER_CONFIGURATION', 'PROVIDER_CREDITS_REQUIRED');
    -- Same accounting as reserve_research_usage: settled cost, or the full reservation while a call's cost is unknown.
    select coalesce(sum(case when u.status = 'completed' then u.estimated_usd else u.reserved_usd end), 0)
      into spent
      from public.research_usage u
      where u.run_id = new.id;
    if operator_fault or spent = 0 then
      update public.research_dev_access set runs_used = greatest(runs_used - 1, 0) where user_id = new.user_id;
      new.quota_released := true;
    else
      update public.research_dev_access
        set runs_used = greatest(runs_used - 1, 0), runs_refunded = runs_refunded + 1
        where user_id = new.user_id and runs_refunded < max_refunds;
      new.quota_released := found;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.release_failed_research_run() from public, anon, authenticated;

commit;
