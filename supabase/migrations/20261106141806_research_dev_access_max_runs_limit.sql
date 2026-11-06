begin;

-- research_dev_access.max_runs was capped at 3 by a check constraint, so no account could be granted more
-- development runs. The grant size is an operator decision; keep only a sane upper bound as a safety net.
alter table public.research_dev_access drop constraint if exists research_dev_access_max_runs_check;
alter table public.research_dev_access add constraint research_dev_access_max_runs_check check (max_runs between 1 and 100);

commit;
