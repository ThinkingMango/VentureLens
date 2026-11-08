begin;

-- A saved_opportunities row now holds two independent things: whether the founder saved the opportunity
-- (saved) and their validation-checklist progress (completed_tasks). Before this, the row's existence meant
-- "saved", so ticking a checklist step silently saved the opportunity, and unsaving deleted the progress.
--
-- Every existing row was shown as saved, so existing rows keep saved = true. The default also stays true so
-- that application code deployed before this migration (which only ever inserts a row to save) keeps its
-- meaning during the rollout, whichever is deployed first. The API sets saved = false explicitly when a
-- checklist tick creates the row, and unsaving clears the flag instead of deleting the row.
alter table public.saved_opportunities
  add column if not exists saved boolean not null default true;

-- The Saved list reads only saved rows.
create index if not exists saved_opportunities_owner_saved_idx
  on public.saved_opportunities (user_id, created_at desc) where saved;

commit;
