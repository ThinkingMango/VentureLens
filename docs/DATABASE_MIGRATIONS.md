# Database migrations

Supabase project: **VentureLens** (`ndrxywlouwigawhgrtrj`, ap-southeast-1).

## Applied history (as of 2026-11-05)

Read from `supabase_migrations.schema_migrations` on the live project:

| Version | Name | Repository file | Content check |
| --- | --- | --- | --- |
| `20261104125434` | `venturelens_workspace` | `supabase/migrations/20261104125434_venturelens_workspace.sql` | identical ignoring whitespace |
| `20261104141647` | `research_engine` | `supabase/migrations/20261104141647_research_engine.sql` | identical |
| `20261104142513` | `research_quota_ledger` | `supabase/migrations/20261104142513_research_quota_ledger.sql` | identical |
| `20261105131043` | `smartmango_research_development_access` | `supabase/migrations/20261105131043_smartmango_research_development_access.sql` | identical (file recovered from the live history) |

"Identical" means the MD5 of the SQL with all whitespace removed matches between the repository file and the `statements` column of the applied migration.

## Reconciliation performed on 2026-11-05

The repository previously carried four files whose version prefixes did **not** match the applied history, plus one duplicate:

| Old file | Status | Action |
| --- | --- | --- |
| `20261104000000_venturelens_workspace.sql` | applied (as `20261104125434`) | renamed to the applied version |
| `202611040001_venturelens_workspace.sql` | **never applied**; same schema as the file above with different formatting | deleted |
| `20261104020000_research_engine.sql` | applied (as `20261104141647`) | renamed |
| `20261104021000_research_quota_ledger.sql` | applied (as `20261104142513`) | renamed |
| *(missing)* | `20261105131043_smartmango_research_development_access` was applied directly to the project and never committed | added from the live history |

Root cause: the migrations were applied through the Supabase MCP `apply_migration` tool, which assigns its own timestamp versions, while the files in Git were hand-named. A fresh `supabase db reset` or `supabase db push` would have tried to run the two workspace files back to back and failed on the second `create table`.

After this change `supabase migration list` shows local and remote in sync, and a fresh database can be built with `supabase db reset`.

## Rules going forward

1. **One source of truth.** Write the SQL file in `supabase/migrations/` first, then apply it with the Supabase CLI (`supabase db push`) or with `apply_migration` using the *same* `name`. If `apply_migration` is used, copy the version it assigned into the file name before committing.
2. **Never edit an applied file.** Write a new migration instead. If a file must be renamed to match history, keep its content byte-identical.
3. **Verify before merging.** Compare `md5(regexp_replace(array_to_string(statements, E'\n'), '\s+', '', 'g'))` on the project against the local file.
4. **Keep RLS invariants.** New tables use `enable` + `force row level security`, composite `(id, user_id)` foreign keys, `revoke all … from anon, authenticated`, and explicit `grant` statements, as in the existing files.
5. **Business parameters do not belong in check constraints.** `research_runs.budget_usd <= 0.25` and `research_dev_access.max_runs <= 3` are known hard-coded limits (see `docs/REVIEW.md` B8); loosen them in a new migration when the entitlement ledger lands.

## Notes on `20261105131043_smartmango_research_development_access`

This migration grants a 7-day, 3-run `research_dev_access` row to any confirmed `@smartmango.ai` account via a trigger on `auth.users`, and revokes it (by expiring the row) if such an account changes its email away from the domain. It is the mechanism behind "authorized development accounts" in the product copy. It should be replaced by the entitlement ledger described in `plan.md` M3 before any paid access is sold.
