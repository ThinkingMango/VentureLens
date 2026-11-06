# VentureLens AI

Evidence-first opportunity research for founders exploring GenAI-enabled, recurring-revenue businesses.

A founder describes their experience, constraints and goals; VentureLens discovers narrow opportunity hypotheses, retrieves real web evidence for each one, classifies and scores it, runs an adversarial review, and saves a private report with linked sources and a validation plan. Candidates without independent evidence are dropped rather than dressed up.

- **Live app routes:** `/`, `/pricing`, `/login`, `/signup`, `/onboarding`, `/dashboard`, `/research`, `/research/new`, `/research/[id]`, `/research/results`, `/opportunities/[id]`, `/saved`, `/profile`, `/billing`, `/admin`
- **Synthetic demo:** everything under `/demo/*` runs on fixed fixtures with no account and no AI calls.
- **Languages:** English, Simplified Chinese, Traditional Chinese (interface). Source excerpts are kept in their original language.
- **Status:** beta. Every confirmed account receives one free research run (`research_dev_access`, granted by a database trigger); failed runs are returned automatically; payments are not connected. See [`plan.md`](./plan.md) for the roadmap and [`docs/REVIEW.md`](./docs/REVIEW.md) for the current holistic review.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn-style primitives |
| Data & auth | Supabase (Postgres, RLS, passwordless email OTP / magic link) |
| Research job | Vercel Workflow (`workflows/research.ts`) with checkpointed stages |
| Models | Qwen via DashScope (primary) and Gemini (fallback) through the Vercel AI SDK; native web search on both |
| i18n | `next-intl`; messages keyed by a hash of the English source string (`i18n/config.ts` → `messageKey`) |
| Tests | `node:test` unit tests, a Supabase integration test, and a research E2E test |

## Local setup

Prerequisites: Node 22, pnpm 10, a Supabase project (or the Supabase CLI), and optionally DashScope / Google AI keys.

```bash
pnpm install --frozen-lockfile
```

Create `.env.development.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_SECRET_KEY=<service role / secret key>      # server only
# Live research (optional; the demo works without these)
DASHSCOPE_API_KEY=<key>
DASHSCOPE_WORKSPACE_ID=<beijing workspace id>
GOOGLE_GENERATIVE_AI_API_KEY=<key>
# Optional: idempotent workflow dispatch through start hooks (dispatch works without it)
WORKFLOW_VERCEL_EXPERIMENTAL_START_HOOK=1
```

Apply the migrations in `supabase/migrations/` to your project, then:

```bash
pnpm dev
```

Migration versions match the live project's history; see [`docs/DATABASE_MIGRATIONS.md`](./docs/DATABASE_MIGRATIONS.md) before adding one.

Email templates for the passwordless flow live in `supabase/templates/` with setup notes in that folder's README.

Every confirmed account receives one free research run automatically. To give an account more during the beta, raise its grant:

```sql
update public.research_dev_access set max_runs = 3, expires_at = now() + interval '30 days'
where user_id = '<auth.users.id>';
```

## Administrators and settings

Administrator access is granted only by a server-managed claim, `app_metadata.role = "admin"`, set with the service role or in the Supabase dashboard; no email address is special. Administrators manage the research policy (primary provider, fallback, models, per-run budget cap) at `/admin`, which is stored in the service-role-only `public.app_settings` table under the key `research`. The page shows what a complete run is expected to cost and refuses a primary model that the per-run budget cannot pay for. At the $0.25 default only Qwen 3.8 Flash can finish a run; Gemini Flash-Lite needs about $0.40 because Google Search grounding is billed per query. See [`docs/GENERATION_PIPELINE_REVIEW.md`](./docs/GENERATION_PIPELINE_REVIEW.md).

```sql
update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'
where id = '<auth.users.id>';
```

## Scripts

```bash
pnpm dev                 # Next.js dev server
pnpm typecheck           # tsc --noEmit
pnpm test                # unit tests (no network)
pnpm build               # production build
pnpm test:integration    # Supabase RLS/integration test — needs credentials and a test project
pnpm test:research:e2e   # runs a real research job — incurs provider cost
```

## Repository layout

```
app/              routes (public, (workspace) group, /demo, /api, /auth)
components/       screens and UI primitives (components/ui)
lib/              research engine, providers, workspace data, schemas, Supabase clients
workflows/        Vercel Workflow definition for a research run
supabase/         migrations and auth email templates
i18n/, messages/  locale negotiation, copy helpers, catalogues (en, zh-Hans, zh-Hant)
tests/            node:test suites
docs/             reviews and operating documentation
```

## How a research run works

1. `POST /api/research` validates the brief, checks the profile and access grant, and calls `enqueue_research` (idempotent on `requestKey`).
2. `dispatchResearch` starts the workflow; `initializeResearch` claims the run and verifies the provider.
3. Stages run in order with a checkpoint after each: `discovery` → `retrieval:cN` (one per candidate) → `classification` → `evaluation` → `scoring` → `review` → `finalizing`.
4. Before the first request, `initializeResearch` checks that the configured models can finish a run within its budget (`lib/research-budget.ts`); if none can, the run stops uncharged. Every model or search call then reserves budget through `reserve_research_usage`; the run stops with `BUDGET_EXCEEDED` if a reservation does not fit.
   Models answer against lenient draft schemas that the server normalises (`lib/research-core.ts`), so a length overrun or a skipped id no longer fails a run; a hypothesis whose search finds nothing is skipped.
5. `finish_research` writes the report and `opportunities` rows only when at least one candidate survives the evidence gate (two independent domains, one non-vendor supporting source) and the review.

The report is written in the language recorded on the run (`configuration.brief.language`, defaulting to the interface language at submission). Source excerpts are always kept verbatim in their original language.

Scoring rules live in `lib/research-core.ts` and are unit-tested in `tests/research.test.mjs`.

## Adding UI copy

Call `copy("English source text")` in components. Then add the string to all three catalogues with `node scripts/i18n-merge.mjs entries.json`, where `entries.json` lists `{ "en", "hans", "hant" }` objects; the key is produced by `messageKey()`. `pnpm test` fails if a literal `copy()` call has no entry in any locale. Strings passed through variables (arrays of titles, etc.) are not checked by the test, so add them too.

## Contributing

- Keep `/demo` fixtures separate from real data; never write demo content into Supabase.
- New tables need RLS with `force row level security`, composite `(id, user_id)` foreign keys, and tests.
- Do not add payment or billing logic until the entitlement ledger described in `plan.md` M3 exists.
