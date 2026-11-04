begin;
alter table public.research_dev_access add column runs_used integer not null default 0 check (runs_used >= 0);
update public.research_dev_access a set runs_used = (select count(*) from public.research_runs r where r.user_id=a.user_id);
create or replace function public.enqueue_research(p_user uuid,p_brief jsonb,p_profile jsonb,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare r uuid; p uuid; a public.research_dev_access; begin
perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
select id into r from public.research_runs where user_id=p_user and request_key=p_request; if found then return r; end if;
select * into a from public.research_dev_access where user_id=p_user and expires_at>now() for update; if not found then raise exception 'DEV_ACCESS_REQUIRED'; end if;
if a.runs_used>=a.max_runs then raise exception 'DEV_QUOTA_EXCEEDED'; end if;
if exists(select 1 from public.research_runs where user_id=p_user and status in ('pending','running')) then raise exception 'RUN_ALREADY_ACTIVE'; end if;
insert into public.research_projects(user_id,name,sector,model,geography,context,discovery_mode) values(p_user,p_brief->>'name',p_brief->>'sector',p_brief->>'model',p_brief->>'geography',coalesce(p_brief->>'context',''),coalesce(p_brief->>'discovery_mode','combined')) returning id into p;
insert into public.research_runs(user_id,project_id,request_key,configuration) values(p_user,p,p_request,jsonb_build_object('brief',p_brief,'profile',p_profile,'methodology','evidence-driven-v1','target_opportunities',8)) returning id into r;
update public.research_dev_access set runs_used=runs_used+1 where user_id=p_user;
return r;
end; $$;
revoke all on function public.enqueue_research(uuid,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.enqueue_research(uuid,jsonb,jsonb,uuid) to service_role;
commit;
