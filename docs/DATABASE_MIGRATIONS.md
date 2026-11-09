# Database migrations

Supabase project: **VentureLens** (`ndrxywlouwigawhgrtrj`, ap-southeast-1).

## Applied history (as of 2026-11-06)

Read from `supabase_migrations.schema_migrations` on the live project:

| Version | Name | Repository file | Content check |
| --- | --- | --- | --- |
| `20261104125434` | `venturelens_workspace` | `supabase/migrations/20261104125434_venturelens_workspace.sql` | identical ignoring whitespace |
| `20261104141647` | `research_engine` | `supabase/migrations/20261104141647_research_engine.sql` | identical |
| `20261104142513` | `research_quota_ledger` | `supabase/migrations/20261104142513_research_quota_ledger.sql` | identical |
| `20261105131043` | `smartmango_research_development_access` | `supabase/migrations/20261105131043_smartmango_research_development_access.sql` | identical (file recovered from the live history) |
| `20261105155412` | `signup_free_run_and_quota_release` | `supabase/migrations/20261105155412_signup_free_run_and_quota_release.sql` | identical (applied with `apply_migration`, file renamed to the assigned version) |
| `20261105161832` | `app_settings_and_role_admin` | `supabase/migrations/20261105161832_app_settings_and_role_admin.sql` | identical (applied with `apply_migration`, file renamed to the assigned version) |
| `20261106141806` | `research_dev_access_max_runs_limit` | `supabase/migrations/20261106141806_research_dev_access_max_runs_limit.sql` | identical (applied with `apply_migration`, file renamed to the assigned version) |

"Identical" means the MD5 of the SQL with all whitespace removed matches between the repository file and the `statements` column of the applied migration.

## Pending (in the repository, not yet applied to the live project)

| Version | Name | Notes |
| --- | --- | --- |
| `20261109150000` | `cap_failed_run_refunds` | Adds `research_dev_access.runs_refunded` and `max_refunds` (default 3, bounded 0–100) and replaces `release_failed_research_run()`. Failures on our side (`DISPATCH_FAILED`, `WORKFLOW_INTERRUPTED`, `TRANSIENT_PROVIDER`, `PROVIDER_CONFIGURATION`, `PROVIDER_CREDITS_REQUIRED`) and runs with no recorded spend are always returned; other failed runs are returned only while `runs_refunded < max_refunds`. Existing accounts start at `runs_refunded = 0`. Tested on PostgreSQL 16 with `pnpm test:sql` on top of the full migration history. |

Apply it with `supabase db push`, or with `apply_migration` using the name `cap_failed_run_refunds` and then rename the file to the version it assigns (rule 1 below). Move the row into the applied table once done.

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
5. **Business parameters live in `public.app_settings`, not in check constraints.** The per-run budget is read by `public.research_budget_usd()` from the `research` row (bounded 0.05–5 USD). `research_dev_access.max_runs` is bounded 1–100 by a check constraint (raised from 3 on 2026-11-06); the grant size itself is set per account by an operator until the entitlement ledger exists.

## Notes on `20261106141806_research_dev_access_max_runs_limit`

- Replaces `research_dev_access_max_runs_check` (`max_runs between 1 and 3`) with `between 1 and 100`. No grant is changed by the migration.
- Applied for an operator grant on 2026-11-06: `ventures@smartmango.ai` was set to `max_runs = 20`, and `runs_used` was reset to its completed and active runs (0), because its three earlier runs all failed before failed runs released their slot. This was a data change made directly, not part of the migration.

## Notes on `20261105161832_app_settings_and_role_admin`

- Creates `public.app_settings (key, value jsonb, updated_by, updated_at)`; RLS enabled and forced, no grants to `anon`/`authenticated`, full access for `service_role`.
- Seeds the `research` row from the legacy `app_metadata.research_provider_settings` on the owner account (then removes that legacy key), adds `budgetUsd` (0.25) if missing.
- Grants `app_metadata.role = "admin"` to the account that held the hard-coded administrator email; `isAdministrator` now checks only that claim.
- `public.research_budget_usd()` returns the configured cap; `enqueue_research` writes it to `research_runs.budget_usd`; the check constraint is loosened to `<= 5`.

## Notes on `20261105155412_signup_free_run_and_quota_release`

- Adds `research_dev_access.source` (`manual` / `smartmango` / `signup`) and `research_runs.quota_released`.
- `zz_grant_signup_research_run` (after insert/update of `email_confirmed_at` on `auth.users`) grants one 30-day run to every confirmed account, one per normalised email (lower-cased, `+tag` stripped). It is named to fire after the smartmango trigger and skips accounts that already hold a grant.
- `release_failed_research_run` (before update of `status` on `research_runs`) returns the slot the first time a run becomes `failed`; `retry_research` takes it again and now also accepts `INVALID_OUTPUT` and `RETRIEVAL_UNAVAILABLE`.
- Verified on the live project inside rolled-back transactions on 2026-11-05: grant on confirmation, no grant for aliases or unconfirmed accounts, release once, re-consume on retry, second retry refused.

## Notes on `20261105131043_smartmango_research_development_access`

This migration grants a 7-day, 3-run `research_dev_access` row to any confirmed `@smartmango.ai` account via a trigger on `auth.users`, and revokes it (by expiring the row) if such an account changes its email away from the domain. It is the mechanism behind "authorized development accounts" in the product copy. It should be replaced by the entitlement ledger described in `plan.md` M3 before any paid access is sold.
