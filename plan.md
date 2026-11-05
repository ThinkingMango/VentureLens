# VentureLens AI — Repository-Grounded Product and Delivery Plan

> **Status:** Planning document — not a claim of production readiness  
> **Version:** 2.0 | **Prepared:** 2026-11-05  
> **Repository:** [ThinkingMango/VentureLens](https://github.com/ThinkingMango/VentureLens)  
> **Baseline reviewed:** `main` at `ebf76f26e79cbc3faea6bfbbc261928d73f78d58`  
> **Delivery approach:** **v0-first** for product UX and incremental full-stack features; **Codex** for migrations, complex transactional logic, reliability, tests, and security; **GitHub** as source of truth.

## 1. Purpose and product outcome

VentureLens AI is a multilingual, evidence-driven business-opportunity research SaaS for aspiring founders, solo entrepreneurs, and professionals exploring GenAI-enabled recurring-revenue businesses. It should help a user:

1. Describe experience, constraints, business goals, available capital, and target markets.
2. Discover narrow, concrete customer problems via founder-advantage, market-first, or combined research.
3. Examine real source evidence, competitors, existing spending signals, and counterarguments.
4. Compare opportunities using **explainable scores and distinct evidence-confidence ratings**.
5. Model conservative, base, and upside revenue economics with transparent assumptions.
6. Validate an opportunity through customer interviews, offers, paid pilots, and go/no-go criteria.
7. Purchase research credits once or through a subscription, without conflating payments with AI costs.

**Product principle:** Make stronger, testable commercial decisions—not just generate plausible startup ideas. Do not advertise verified demand, revenue probabilities, or citations without evidence.

### Scope and delivery guardrails

- **Extend the existing project. Do not regenerate the app or replace working modules.**
- Keep the established Next.js routes, UI design, three-language support, passwordless email authentication, Supabase persistence, synthetic demo, and staged research workflow.
- Implement against the **actual repository and connected development environment**, not an old greenfield specification.
- Every change must preserve customer data, authorization boundaries, and backwards compatibility with saved research.
- No destructive database operations, unapproved production changes, live Stripe activation, or expensive unrestricted model testing.

## 2. Current-state inventory (source review, not runtime certification)

The repository has a full-stack foundation, not merely a UI prototype. The following reflects **source code inspected** at the baseline commit; live integrations and complete tests still require verification.

| Area | Current implementation | State / gap |
| --- | --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui-style components | Implemented; visual/responsive QA not independently executed |
| Marketing | `/`, `/pricing` | Implemented; pricing deliberately illustrative |
| Accounts | Supabase SSR, email OTP and magic-link confirmation, login/signup, onboarding | Implemented; actual email delivery and production callback settings need live verification |
| Workspace | Profile, briefs, runs, saved opportunities and tasks; SWR-backed views | Implemented with Supabase persistence; extend existing data structures |
| Isolation | Supabase RLS on workspace/research tables | Policy definitions/tests exist; verify with separate real test users |
| Research | Discovery → retrieval → classification → evaluation → scoring → adversarial review → final report | Implemented with Vercel Workflow and usage logging; production reliability not proven here |
| Retrieval | Vercel AI Gateway `parallelSearch` with source excerpts | Implemented; retrieval quality/accuracy need evaluation |
| Research model | `alibaba/qwen3.8-flash` set in `lib/research-core.ts` | Fixed model; add configurable server-side selection |
| Reports | Original sources, score, assumptions, falsification steps, limitations | Implemented; improve claim-level provenance |
| Languages | English, Simplified Chinese, Traditional Chinese via `next-intl` | UI implemented; research policy currently forces Chinese output |
| Demo | Isolated synthetic `/demo/...` workspace | Implemented; preserve separation from live customer records |
| Research access | `research_dev_access` with limited per-user development quotas | **Not commercial credits**; migrate entitlements carefully |
| Billing | Pricing and billing components show illustrative packages/no live checkout | Stripe not implemented |
| Financial model | No dedicated working scenario simulator | Planned |
| Full validation workspace | Basic saved-opportunity task completion | More complete plan, interview and pilot tracking planned |
| Operations | Admin/usage dashboard, CI, owner docs | Incomplete |
| Tests | Unit tests, Supabase integration test, research E2E test exist | Existence does **not** mean all tests passed |
| Deployment | GitHub/Vercel integration; GitHub reports successful Vercel commit status | Build status **does not verify** user journeys or provider credentials |

### Preserve the established routes

Existing real routes: `/`, `/pricing`, `/login`, `/signup`, `/auth/callback`, `/auth/confirm`, `/onboarding`, `/dashboard`, `/research`, `/research/new`, `/research/[id]`, `/research/results`, `/opportunities/[id]`, `/saved`, `/profile`, `/billing`, and `/demo/...`.

The Next.js `(workspace)` route group **does not add a URL segment**. Do **not** introduce a parallel `/dashboard/research/...` hierarchy merely to match older prompts. Add truly missing routes incrementally.

### Key implementation references

- `app/api/research/route.ts`, `app/api/research/[id]/route.ts`
- `lib/research-engine.ts`, `lib/research-core.ts`, `lib/research-service.ts`, `workflows/research.ts`
- `app/api/workspace/route.ts`, `lib/workspace.ts`, `lib/workspace-schema.ts`
- `components/demo-provider.tsx`, `components/research-run.tsx`, `components/opportunity-evidence.tsx`
- `lib/email-auth.ts`, `app/auth/confirm/actions.ts`, `proxy.ts`
- `supabase/migrations/`, `tests/`, `i18n/`, `messages/`

## 3. Blocking findings and risk register

| Priority | Observed issue | Consequence | Required verification/remediation |
| --- | --- | --- | --- |
| **P0** | `20261104000000_venturelens_workspace.sql` and `202611040001_venturelens_workspace.sql` overlap in initial schema creation | Fresh migrations may collide; deployed history could differ | Check actual migration history, reproduce clean setup, reconcile safely without rewriting applied migrations |
| **P0** | Real end-to-end research success not established by this review | Customers could pay for incomplete research | Execute existing `test:research:e2e` in a development environment; inspect failures, completion, source persistence, retries |
| **P0** | Per-run development budget defaults to **$0.25**; retrieval reservations can be conservative (allowance for up to 32 searches) | Budget exhaustion, uncertain charges, or incomplete jobs possible | Instrument reservation-versus-actual usage; test full 8-candidate workflow and interruption scenarios |
| **P1** | Research system instructions force human-readable conclusions to Chinese | English UI users may receive Chinese reports | Persist selected report language; preserve original quotes; localize output and error messages |
| **P1** | Model `alibaba/qwen3.8-flash` is fixed | Difficult to compare quality/cost and use OpenAI models | Configurable, server-controlled model profiles with per-run model/version records |
| **P1** | Implemented five-dimension score weights differ from agreed eight-dimension commercial scorecard | Missing explicit distribution, retention and timing emphasis | Add versioned scorecards and migrate forward **without rewriting old report scores** |
| **P1** | Pricing page offers are samples; no Stripe backend or durable commercial credits | Cannot sell paid research | Add test-mode Checkout, signed webhooks, commercial entitlements, transactional ledger |
| **P1** | Founder profile and geography enums are narrow | Overlooks constraints and China/HK opportunities | Extend fields and accepted geographies with schema and migration compatibility |
| **P2** | Matching excerpts and independent domains are useful but not full fact verification | Overconfidence in evidence and third-party claims | Claim-level references, contradictory evidence, timestamps, source status, transparent confidence |
| **P2** | No persistent scenario model or full validation workspace | Lower retention and perceived value | Build on existing opportunities/saved tasks |
| **P2** | `README.md` is minimal; no complete owner/runbook documentation | Difficult to operate/support safely | Create setup, architecture, migrations, test, deployment and incident docs |

### Immediate architecture notes

- `lib/research-core.ts` implements **five** scored dimensions with mode-dependent weights, 70/85 score caps, and review deductions. Treat those results as versioned historical output.
- `lib/research-engine.ts` stores evidence excerpts and requires independent-domain / non-vendor pain signals. This is meaningful grounding, but a search-result excerpt is **not** itself verified willingness to pay.
- `app/api/research/route.ts` restricts live research to authorized development accounts via `enqueue_research`. No paid entitlement is attached yet.
- `components/pricing.tsx` currently proposes **Opportunity Sprint ($29 once, 5 credits)**, **Explorer ($39/month, 10 monthly credits)** and **Builder ($79/month, 30 monthly credits)**. These are the **existing UI baseline**, not approved live offers or validated prices.
- The repository is currently **public**. Keep secrets, customer records, pricing-provider credentials, and private operational documents out of Git.

## 4. Updated milestone roadmap

Milestones are dependencies, not calendar guarantees. **M0 and M1 are the immediate priority; Stripe should follow proof that real research works and its costs are understood.**

### M0 — Stabilize database, authentication, research and verification (**P0**)

**Goal:** Establish that the current implementation can be reproduced and actually works before adding features.

Tasks:
- [ ] Pin current development baseline; inspect existing Supabase project/migration history.
- [ ] Compare both workspace migration files and the subsequent research/quota migrations.
- [ ] Reproduce migrations on a **new disposable development database** and document a safe reconciliation; never blindly delete an already-applied migration.
- [ ] Run `pnpm typecheck`, `pnpm test`, and `pnpm build` in the intended environment.
- [ ] Run `pnpm test:integration` with restricted development credentials and temporary users.
- [ ] Verify real email code delivery, magic-link confirmation, session persistence, onboarding, logout, and authorization.
- [ ] Run `pnpm test:research:e2e` only in an approved development environment with a strict provider budget.
- [ ] Confirm a research job completes all stages; persists source evidence, checkpoints, usage, and final report; and can be reopened.
- [ ] Test duplicate request keys, safe retries, interrupted workflow recovery, and failed-job behavior.
- [ ] Document which checks ran, which failed, and what is only code-reviewed.

**Acceptance:** Clean migration path; account isolation verified; at least one real completed research report with independently retrievable source records; reconciled provider usage; relevant checks pass or outstanding blockers are explicitly recorded.

**Do not:** Rewrite passwordless auth; remove duplicate migrations without checking history; modify production DB; claim success from test-file existence alone.

### M1 — Improve research quality, multilingual output and cost control (**P0/P1**)

**Goal:** Trustworthy, consistently completed reports in the user's chosen language.

Tasks:
- [ ] Keep the Vercel Workflow stages and checkpoints. Add safe restart/cancel/recovery behavior as needed.
- [ ] Set research/report language independently from the UI; default to the user's UI preference; support `en`, `zh-Hans`, and `zh-Hant`.
- [ ] Keep source quotations untranslated and preserve original URLs/timestamps.
- [ ] Replace hardcoded model identifier with server-configured provider/model profiles, keeping Qwen supported.
- [ ] Evaluate an appropriate OpenAI model option using matched prompts, valid samples, completion rates, groundedness, and per-report cost; do not switch blindly.
- [ ] Instrument reserved, known, estimated and unknown usage separately; analyze the $0.25 cap versus actual full-run costs.
- [ ] Test budget stops, search failures, retries, idempotency, model errors, and incomplete evidence.
- [ ] Improve claim-to-source mapping, negative evidence display, primary-versus-vendor classification, freshness, and explicit unknowns.
- [ ] Introduce a **versioned 8-criterion commercial scorecard**: willingness to pay 20%, customer reachability 20%, recurring demand/retention 15%, unit economics 15%, time to first revenue 10%, GenAI competitive advantage 10%, solo-founder feasibility 5%, risk/liability 5%.
- [ ] Preserve `evidence confidence` separately from `attractiveness score`; scores are **not probabilities**.
- [ ] Preserve earlier reports with their original methodology/version and score meaning.

**Acceptance:** New reports are in selected language, reproducibly persisted, evidence-linked, correctly scored, candid about unknowns, and bounded by validated usage budgets. Older reports still render correctly.

### M2 — Expand founder profile and relevant markets (**P1**)

**Goal:** Make recommendations meaningfully fit a founder's actual constraints.

Tasks:
- [ ] Extend `founder_profiles` and existing `profileSchema` with MRR target, capital, weekly availability, skills, technical/sales capability, access to distribution, preferred buyers and languages, exclusions, risk tolerance.
- [ ] Expand research geographies beyond current US/UK/EU/global English options, including **Hong Kong** and **Mainland China**.
- [ ] Replace overly narrow hardcoded industry/geography enum choices with validated extensible options while retaining old values.
- [ ] Feed only user-provided/legitimate founder attributes into research; do not infer access to employer-confidential data or customer lists.
- [ ] Make edited profiles affect **new runs**; do not silently rewrite existing research snapshots.
- [ ] Evaluate market-specific law, payments and model/provider constraints rather than assuming translation is market support.

**Acceptance:** A founder can save and revise detailed constraints; new searches use them; old profiles/projects remain readable; UI is accessible in all three languages.

### M3 — Stripe Checkout, subscriptions and commercial credits (**P1; test mode first**)

**Goal:** Allow secure one-time and recurring paid research on the existing workspace.

**Existing UI baseline to evaluate, not silently replace:**
- Opportunity Sprint: $29 once / 5 credits.
- Explorer: $39 monthly / 10 credits.
- Builder: $79 monthly / 30 credits.

Tasks:
- [ ] Measure cost per *successful* report and research support burden before confirming packages and credit prices.
- [ ] Implement server-side product catalog mapping internal package IDs to Stripe Price IDs; no browser-controlled prices.
- [ ] Use Stripe-hosted Checkout: `payment` for packs, `subscription` for recurring plans.
- [ ] Add a customer-verified Stripe Customer Portal flow.
- [ ] Implement raw-body signature verification, idempotent webhook ingestion, out-of-order event recovery and reconciliation.
- [ ] Create billing tables for Stripe customer linkage, products/prices, subscriptions, purchases, processed events, credit grants and immutable ledger entries.
- [ ] Keep **research usage/cost records** separate from **customer credit entitlements**.
- [ ] Grant credits only after verified qualifying payment status/paid billing periods. Never grant from success-page navigation.
- [ ] Track free/promo, subscription-period and independently purchased credits separately; document rollover/expiry/refund policy.
- [ ] Implement **atomic reserve → consume/release** for paid jobs, race-safe balance checks and unique idempotency keys.
- [ ] Handle renewals, failed invoices, cancellations, plan transitions, refunds, disputes and webhooks processed twice.
- [ ] Retain restricted `research_dev_access` for internal tests only; do not allow it to bypass production entitlements.
- [ ] Implement `/checkout/success` and `/checkout/cancel` without misrepresenting payment as completed before backend confirmation.
- [ ] Test one-time purchase, renewals, duplicate events, concurrent research requests, error refunds/credit releases, and paid access isolation.

**Acceptance:** In Stripe **test mode**, a real authenticated test user buys a pack or subscribes, receives exactly the intended credits, completes a research job, sees accurate balances/history and can manage the subscription. No live charges until owner approval.

### M4 — Financial models, comparison and deep-dive analysis (**P2**)

**Goal:** Turn one-off research into repeat decision-making.

- [ ] Add `/financial-model` with deterministic 12-month customer, MRR, churn, CAC, costs, gross profit, operating profit and cashflow calculations.
- [ ] Support saved assumptions and conservative/base/upside scenarios in Supabase with RLS.
- [ ] Add `/compare` for 2–5 opportunities using comparable evidence, acquisition difficulty, recurring pain, economic assumptions and risks.
- [ ] Add `/opportunities/[id]/deep-dive` for competition, pricing, sales process, AI workflow, stress tests and falsification.
- [ ] Link each derived report/model to its source opportunity and research run; distinguish customer estimates from verified observations.
- [ ] Test calculation accuracy, save/load, route authorization, and upgrades without breaking existing result pages.

**Acceptance:** Logged-in users can model, compare and reopen their own scenarios without fabricated forecast certainty.

### M5 — Full commercial validation workspace (**P2**)

**Goal:** Help users test demand rather than only consume AI output.

- [ ] Evolve current saved-opportunity checklists into `/validation` and `/validation/[id]`.
- [ ] Store 30-day plans, interviews, outreach, objections, offers, paid pilots, spending signals and go/no-go criteria.
- [ ] Clearly separate observed buyer behavior and actual payments from AI recommendations and hypothetical interest.
- [ ] Add user-private notes, progress state, task completion, dates and evidence links with RLS.
- [ ] Preserve existing `saved_opportunities.completed_tasks` records; migrate data safely if restructuring.

**Acceptance:** Users can create/revisit validation projects and record genuine commercial evidence across sessions.

### M6 — Marketing, administration and operator tooling (**P2**)

**Goal:** Run and explain a paid product responsibly.

- [ ] Improve existing `/` and `/pricing`, keeping the current visual system and honest demonstration claims.
- [ ] Add `/features`, `/how-it-works`, `/contact`, `/privacy`, `/terms`, and `/refund-policy`.
- [ ] Have the owner review legal and credit terms; do not claim legal compliance certifications without proof.
- [ ] Add secure `/admin/...` screens with **server-managed admin roles**, never client-editable metadata.
- [ ] Show verified recurring MRR separately from one-time sales, refund figures, AI job costs, failure/retry rates, and credit reconciliation.
- [ ] Build user support and recovery workflows without exposing private data or secrets.
- [ ] Monitor research cost, completion rate, time to result and repeat use.

**Acceptance:** Operator can reconcile payments and AI usage, identify failures, and support customers without direct database edits.

### M7 — Production release readiness (**P0 before live billing**)

**Goal:** Verify production safety and deploy only approved changes.

- [ ] Add GitHub CI for typecheck, build, unit tests, migration validation and policy tests.
- [ ] Run integration and research E2E tests in staging with controlled credentials/budgets.
- [ ] Run Stripe sandbox E2E tests including asynchronous fulfillment, renewals, refunds, retries and duplicate/out-of-order events.
- [ ] Test cross-user RLS, customer-to-admin escalation, rate limiting, secret exposure and prompt-injection boundaries.
- [ ] Validate separate development/preview/production Supabase and Stripe configuration.
- [ ] Review auth redirect URLs, email templates, domain/HTTPS, monitoring, backups and incident runbook.
- [ ] Verify responsive accessibility and core journey: register → profile → purchase → research → evidence → save → return → manage billing.
- [ ] Stage Vercel deployment; review migration strategy, rollback, error monitoring and final acceptance.
- [ ] Approve actual pricing, credit/refund/legal policies, production release and live payments **explicitly**.

**Acceptance:** All critical flows demonstrably work in a controlled production-like environment, with no open critical security/billing defects and documented owner signoff.

## 5. Engineering and data principles

### Reuse the current application structure

- Keep `app/(workspace)` route group and current URL paths.
- Keep `WorkspaceProvider`, Supabase clients, `/api/workspace` and existing workspace models; incrementally evolve them.
- Maintain a **strict separation** between `/demo` synthetic data and authenticated real data.
- Keep Vercel Workflow; do not run long research through unawaited serverless promises.
- Prefer constrained Zod schemas, deterministic scoring and financial calculations, explicit model versions and auditability.
- Preserve the 3 translation catalogs and canonical persisted enums when extending UI copy.

### Migrations and security

- First inspect actual Supabase migration history; do not assume all files were run or that a clean database can replay them.
- New schema changes must be idempotent when appropriate, migration-tracked, tested on a disposable database and reviewed for RLS/permissions.
- Keep privileged Supabase credentials **server-only**; validate authenticated user identity for every privileged API operation.
- Apply `USING` and `WITH CHECK` RLS policies for user-owned mutations; test cross-account read/write attempts.
- Use database transactions/unique constraints for credits, purchases, invoice grants and webhook processing.
- Store Stripe IDs and numeric minor currency units; avoid floating-point money arithmetic.

### Research integrity and unit economics

- Every reported important claim must identify source, retrieval date, evidence level, or explicit lack of verification.
- Do not treat vendor marketing, a URL existing, or an excerpt match as proof of recurring willingness to pay.
- Keep contradictory evidence and strongest failure assumptions visible.
- Track cost per **successful** report, incomplete reports, retries and human support—rather than only token unit prices.
- Configured credits should price meaningful user outcomes with an adequate margin, not assume unlimited expensive generation.
- Make onboarding, research language and model selection compatible with saved historical report interpretation.

## 6. Test plan and operating commands

From the repository root, in an approved development environment:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
# Only with explicit safe development credentials and a test database:
pnpm test:integration
# This invokes actual research services, may incur cost and requires a running app:
pnpm test:research:e2e
```

Existing scripts are declared in `package.json`; verify environment prerequisites before execution. **Do not run provider-using E2E tests against production**, and do not claim they passed unless run and observed.

Additional required tests:
- A completely fresh Supabase migration application.
- Passwordless email code and magic-link delivery using a controlled mailbox.
- Authenticated vs. anonymous workspace/API access.
- Cross-user RLS for profile, projects, runs, opportunities, notes, billing and credits.
- Research idempotency, retry, timeout, budget exhaustion and source-verification failures.
- Locale switching with preserved original source excerpts and historical report contents.
- Stripe webhook signing, delayed/asynchronous fulfillment and duplicate/out-of-order events.
- Atomic credit spending under simultaneous research calls.
- Refunds/disputes, subscription-period resets, payment failures and cancellation.
- Deterministic financial model calculations.
- Responsive accessibility and Vercel preview smoke tests.

## 7. Deliverables and documentation

Create/maintain as each milestone is implemented:

- `README.md` — product overview and verified local setup.
- `docs/PRODUCT_REQUIREMENTS.md` — product and commercial scope.
- `docs/ARCHITECTURE.md` — actual app/data/research/payment architecture.
- `docs/RESEARCH_METHODOLOGY.md` — evidence gates and versioned scorecards.
- `docs/IMPLEMENTATION_STATUS.md` — completed/verified/blocked/not-started by milestone.
- `docs/DATABASE_MIGRATIONS.md` — migration history and reconciliation choices.
- `docs/OWNER_SETUP.md` — v0, Vercel, Supabase, Stripe, AI providers and domain setup without secrets.
- `docs/TEST_RESULTS.md` — commands, environments, dates, pass/fail and blockers.
- `docs/DEPLOYMENT.md` — preview, production, migrations, release gates and rollback.
- `docs/ARCHITECTURE_DECISIONS.md` — ADR-style notable tradeoffs.

### Milestone reporting template

At completion of each milestone, record:

1. Files/components reviewed and changed.
2. Functionality added and existing functionality preserved.
3. Database changes and migration status.
4. Tests **actually executed**, with results.
5. API/provider credentials or environment blockers.
6. Open security/reliability findings.
7. Changed AI usage cost or product entitlements.
8. Acceptance criteria met/unmet.
9. Owner action needed before proceeding.

Use **Implemented and tested**, **Implemented but not verified**, **Blocked**, and **Not started**; avoid vague claims such as "done" based only on UI rendering.

## 8. Metrics and go/no-go signals

Initially measure:
- Account signup → onboarding completion → first successful research.
- Median/p95 time to usable report, completion rate and error causes.
- Evidence traceability and frequency of unsupported/retracted claims.
- Per-run AI/search/workflow cost, cost per successful result and gross margin after human support.
- Share of users saving/comparing ideas, returning to reports and progressing to validation.
- Free-to-paid conversion, one-time repeat purchase, subscription renewal and churn.
- Stripe fulfillment exceptions and credit ledger reconciliation issues.

Do not invent benchmark pass rates. Establish launch thresholds from observed staging performance and a handful of real user trials. Commercial confidence rises with real payment and renewal behavior, not model confidence scores.

## 9. Immediate next action (the first v0/Codex task)

**Start with M0 only**. In the **existing** v0 project/repository, request:

> Inspect `main` and the actual connected development environment. Do not initialize a new app, recreate authentication or UI, or add Stripe. Investigate overlapping `supabase/migrations/20261104000000_venturelens_workspace.sql` and `202611040001_venturelens_workspace.sql` against actual migration history and a disposable clean database. Run available typecheck, build and unit tests; safely run Supabase integration and research E2E tests only with proper development credentials and cost limits. Verify passwordless email flows, cross-user RLS, one complete real evidence-driven research job, source persistence, usage reservations and retry/recovery behavior. Apply only safe non-destructive fixes; document execution results and blockers in `docs/IMPLEMENTATION_STATUS.md`, `docs/DATABASE_MIGRATIONS.md`, and `docs/TEST_RESULTS.md`. Preserve three-language UI, synthetic demo isolation, Vercel Workflow and existing routes. Finish with an explicit M0 acceptance checklist and list of work that remains unverified.

**After M0 passes:** proceed to M1 (research quality/reliability), M2 (founder constraints), and **only then** M3 (Stripe test-mode monetization).

---

**This plan is intentionally repository-specific.** It supersedes the earlier greenfield v0/Codex build prompts wherever those would duplicate existing code or contradict the current app architecture. It is a roadmap, **not a record of successful execution**.
