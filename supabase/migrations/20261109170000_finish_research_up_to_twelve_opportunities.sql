begin;

-- The number of hypotheses a run explores now follows its budget: 5 to 12 (MIN_CANDIDATES / MAX_CANDIDATES in
-- lib/research-budget.ts), where it was always 8. finish_research rejected a report with more than 8 opportunities,
-- so a run whose 9th to 12th hypotheses survived the evidence gate would have failed with EVIDENCE_REQUIRED at the
-- very end, after spending its whole budget.
--
-- Also closes a gap in the same check: a report with no "opportunities" array made jsonb_array_length return null,
-- `null not between …` is null rather than true, and the run could complete with no opportunities. The engine never
-- sends such a report, but the database should not rely on that. The function is otherwise unchanged from
-- 20261104141647_research_engine; `create or replace` keeps its owner and the existing grants (service_role only).
--
-- Apply before deploying the application change that raises the count. Until then a deployed app with this change
-- could size a run above 8 and lose it at this check.

create or replace function public.finish_research(p_run uuid,p_user uuid,p_workflow text,p_report jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r public.research_runs; o jsonb; begin
select * into r from public.research_runs where id=p_run and user_id=p_user for update;
if r.status='completed' then return; end if;
if not found or r.status<>'running' or r.workflow_id is distinct from p_workflow then raise exception 'RUN_NOT_ACTIVE'; end if;
if coalesce(jsonb_array_length(p_report->'opportunities'), 0) not between 1 and 12 or not exists(select 1 from public.research_evidence where run_id=p_run and user_id=p_user) then raise exception 'EVIDENCE_REQUIRED'; end if;
for o in select value from jsonb_array_elements(p_report->'opportunities') loop
insert into public.opportunities(id,user_id,run_id,title,score,payload) values((o->>'id')::uuid,p_user,p_run,o->>'title',(o->>'score')::integer,o) on conflict(id) do nothing;
end loop;
update public.research_runs set report=p_report,summary=p_report->>'summary',status='completed',stage='completed',completed_at=now(),error_code=null where id=p_run and user_id=p_user;
end; $$;

commit;
