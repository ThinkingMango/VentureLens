begin;

-- "No budget": the administrator can start research runs without a per-run spend cap.
--
-- The research policy in app_settings stores `"budgetUsd": null` for this (lib/provider-settings-core.ts). A run started
-- under it records budget_usd = null, and reserve_research_usage then stops it only at a fixed safety ceiling of
-- $25 (NO_BUDGET_CEILING_USD in lib/provider-settings-core.ts; a test keeps the two equal). That ceiling is about five
-- times the most expensive run any model and source policy can be configured for, so it never stops a working run; it
-- exists so that a pipeline bug or a provider billing far above its published price cannot spend without limit.
--
-- Capped runs are unchanged: a numeric budget is still bounded 0.05–5 and enforced exactly as before.

-- 1. A run may have no budget.
alter table public.research_runs alter column budget_usd drop not null;
alter table public.research_runs drop constraint if exists research_runs_budget_usd_check;
alter table public.research_runs add constraint research_runs_budget_usd_check
  check (budget_usd is null or (budget_usd > 0 and budget_usd <= 5));

-- 2. The configured budget, or null when the administrator chose "No budget". A missing key or a missing row still
--    means the 0.25 default, and any number is still clamped to 0.05–5.
create or replace function public.research_budget_usd() returns numeric
language sql stable set search_path = '' as $$
  select case
    when jsonb_typeof(s.value -> 'budgetUsd') = 'null' then null
    else least(5, greatest(0.05, coalesce((s.value ->> 'budgetUsd')::numeric, 0.25)))
  end
  from (select (select value from public.app_settings where key = 'research') as value) s;
$$;
revoke all on function public.research_budget_usd() from public, anon, authenticated;

-- 3. Reservations are checked against the run's budget, or against the safety ceiling for a run with none. Otherwise
--    unchanged from 20261104141647_research_engine; `create or replace` keeps the owner and the service_role grant.
create or replace function public.reserve_research_usage(p_run uuid,p_user uuid,p_stage text,p_model text,p_reserved numeric,p_pricing jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.research_runs; u uuid; spent numeric; begin
select * into r from public.research_runs where id=p_run and user_id=p_user for update;
if not found or r.status not in ('pending','running') then raise exception 'RUN_NOT_ACTIVE'; end if;
select coalesce(sum(case when status='completed' then estimated_usd else reserved_usd end),0) into spent from public.research_usage where run_id=p_run;
if p_reserved<=0 or spent+p_reserved>coalesce(r.budget_usd,25) then raise exception 'BUDGET_EXCEEDED'; end if;
insert into public.research_usage(run_id,user_id,stage_key,provider,model,reserved_usd,pricing) values(p_run,p_user,p_stage,'vercel-ai-gateway',p_model,p_reserved,p_pricing) returning id into u; return u;
end; $$;

commit;
