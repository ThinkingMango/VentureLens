create or replace function public.sync_smartmango_research_access()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null and lower(split_part(new.email, '@', 2)) = 'smartmango.ai' then
    insert into public.research_dev_access (user_id, expires_at, max_runs)
    values (new.id, now() + interval '7 days', 3)
    on conflict (user_id) do nothing;
  elsif TG_OP = 'UPDATE' then
    if lower(split_part(old.email, '@', 2)) = 'smartmango.ai' then
      update public.research_dev_access set expires_at = least(expires_at, now()) where user_id = new.id;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_smartmango_research_access() from public, anon, authenticated;
create trigger sync_smartmango_research_access
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.sync_smartmango_research_access();
insert into public.research_dev_access (user_id, expires_at, max_runs)
select id, now() + interval '7 days', 3 from auth.users
where email_confirmed_at is not null and lower(split_part(email, '@', 2)) = 'smartmango.ai'
on conflict (user_id) do update set expires_at = greatest(public.research_dev_access.expires_at, excluded.expires_at);
