begin;
alter table public.research_projects add column discovery_mode text not null default 'combined' check (discovery_mode in ('founder','market','combined'));
alter table public.research_runs add column configuration jsonb not null default '{}', add column stage text not null default 'queued', add column workflow_id text, add column request_key uuid, add column report jsonb, add column retry_count integer not null default 0 check (retry_count between 0 and 1), add column budget_usd numeric not null default 0.25 check (budget_usd > 0 and budget_usd <= 0.25);
create unique index research_request_unique on public.research_runs(user_id,request_key);
create unique index research_one_active on public.research_runs(user_id) where status in ('pending','running');
create table public.research_dev_access (user_id uuid primary key references auth.users(id) on delete cascade, expires_at timestamptz not null, max_runs integer not null default 3 check (max_runs between 1 and 3));
create table public.research_stages (run_id uuid not null, user_id uuid not null, stage_key text not null, output jsonb not null, created_at timestamptz not null default now(), primary key(run_id,stage_key), foreign key(run_id,user_id) references public.research_runs(id,user_id) on delete cascade);
create table public.research_evidence (id uuid primary key default gen_random_uuid(),run_id uuid not null,user_id uuid not null,source_key text not null,candidate_id text not null,url text not null,title text not null,excerpt text not null,retrieved_at timestamptz not null default now(),published_at text,classification jsonb,unique(run_id,source_key),foreign key(run_id,user_id) references public.research_runs(id,user_id) on delete cascade);
create table public.research_usage (id uuid primary key default gen_random_uuid(),run_id uuid not null,user_id uuid not null,stage_key text not null,provider text not null,model text not null,status text not null default 'reserved' check (status in ('reserved','completed','unknown')),input_tokens integer not null default 0,output_tokens integer not null default 0,search_requests integer not null default 0,estimated_usd numeric, reserved_usd numeric not null check(reserved_usd > 0),pricing jsonb not null,created_at timestamptz not null default now(),foreign key(run_id,user_id) references public.research_runs(id,user_id) on delete cascade);
do $$ declare t text; begin foreach t in array array['research_dev_access','research_stages','research_evidence','research_usage'] loop execute format('alter table public.%I enable row level security',t); execute format('alter table public.%I force row level security',t); execute format('revoke all on public.%I from public,anon,authenticated',t); execute format('grant select on public.%I to authenticated',t); execute format('grant all on public.%I to service_role',t); execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid())=user_id)',t||'_select_own',t); end loop; end $$;
create index research_evidence_owner_run on public.research_evidence(user_id,run_id);
create index research_usage_owner_run on public.research_usage(user_id,run_id);
create index research_stages_owner_run on public.research_stages(user_id,run_id);
create function public.enqueue_research(p_user uuid,p_brief jsonb,p_profile jsonb,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare r uuid; p uuid; a public.research_dev_access; begin
perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
select id into r from public.research_runs where user_id=p_user and request_key=p_request; if found then return r; end if;
select * into a from public.research_dev_access where user_id=p_user and expires_at>now(); if not found then raise exception 'DEV_ACCESS_REQUIRED'; end if;
if (select count(*) from public.research_runs where user_id=p_user)>=a.max_runs then raise exception 'DEV_QUOTA_EXCEEDED'; end if;
if exists(select 1 from public.research_runs where user_id=p_user and status in ('pending','running')) then raise exception 'RUN_ALREADY_ACTIVE'; end if;
insert into public.research_projects(user_id,name,sector,model,geography,context,discovery_mode) values(p_user,p_brief->>'name',p_brief->>'sector',p_brief->>'model',p_brief->>'geography',coalesce(p_brief->>'context',''),coalesce(p_brief->>'discovery_mode','combined')) returning id into p;
insert into public.research_runs(user_id,project_id,request_key,configuration) values(p_user,p,p_request,jsonb_build_object('brief',p_brief,'profile',p_profile,'methodology','evidence-driven-v1','target_opportunities',8)) returning id into r; return r;
end; $$;
create function public.reserve_research_usage(p_run uuid,p_user uuid,p_stage text,p_model text,p_reserved numeric,p_pricing jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.research_runs; u uuid; spent numeric; begin
select * into r from public.research_runs where id=p_run and user_id=p_user for update;
if not found or r.status not in ('pending','running') then raise exception 'RUN_NOT_ACTIVE'; end if;
select coalesce(sum(case when status='completed' then estimated_usd else reserved_usd end),0) into spent from public.research_usage where run_id=p_run;
if p_reserved<=0 or spent+p_reserved>r.budget_usd then raise exception 'BUDGET_EXCEEDED'; end if;
insert into public.research_usage(run_id,user_id,stage_key,provider,model,reserved_usd,pricing) values(p_run,p_user,p_stage,'vercel-ai-gateway',p_model,p_reserved,p_pricing) returning id into u; return u;
end; $$;
create function public.retry_research(p_run uuid,p_user uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare r public.research_runs; begin
perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
select * into r from public.research_runs where id=p_run and user_id=p_user for update;
if not found or r.status<>'failed' or r.retry_count>=1 or r.error_code not in ('TRANSIENT_PROVIDER','WORKFLOW_INTERRUPTED','DISPATCH_FAILED') then return false; end if;
if not exists(select 1 from public.research_dev_access where user_id=p_user and expires_at>now()) then return false; end if;
if exists(select 1 from public.research_runs where user_id=p_user and status in ('pending','running')) then return false; end if;
update public.research_runs set status='pending',stage='queued',workflow_id=null,error_code=null,completed_at=null,retry_count=retry_count+1 where id=p_run and user_id=p_user; return true;
end; $$;
create function public.finish_research(p_run uuid,p_user uuid,p_workflow text,p_report jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r public.research_runs; o jsonb; begin
select * into r from public.research_runs where id=p_run and user_id=p_user for update;
if r.status='completed' then return; end if;
if not found or r.status<>'running' or r.workflow_id is distinct from p_workflow then raise exception 'RUN_NOT_ACTIVE'; end if;
if jsonb_array_length(p_report->'opportunities') not between 1 and 8 or not exists(select 1 from public.research_evidence where run_id=p_run and user_id=p_user) then raise exception 'EVIDENCE_REQUIRED'; end if;
for o in select value from jsonb_array_elements(p_report->'opportunities') loop
insert into public.opportunities(id,user_id,run_id,title,score,payload) values((o->>'id')::uuid,p_user,p_run,o->>'title',(o->>'score')::integer,o) on conflict(id) do nothing;
end loop;
update public.research_runs set report=p_report,summary=p_report->>'summary',status='completed',stage='completed',completed_at=now(),error_code=null where id=p_run and user_id=p_user;
end; $$;
revoke all on function public.enqueue_research(uuid,jsonb,jsonb,uuid),public.reserve_research_usage(uuid,uuid,text,text,numeric,jsonb),public.retry_research(uuid,uuid),public.finish_research(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.enqueue_research(uuid,jsonb,jsonb,uuid),public.reserve_research_usage(uuid,uuid,text,text,numeric,jsonb),public.retry_research(uuid,uuid),public.finish_research(uuid,uuid,text,jsonb) to service_role;
commit;
