# Budget-scaled discovery and the "Start here" recommendation

> **Status:** implemented on `claude/trusting-johnson-6rlvcq` (November 2026).
> **Scope:** how many hypotheses a run explores, how that follows the per-run budget, and how a finished report says
> which opportunity to validate first.

---

## 1. Why this change

Every run used to generate exactly **8** hypotheses. Nothing in the code or docs explained the 8; it was a starting
default that the rest of the pipeline came to depend on (the cost model, the batching, the evidence gate's yield).

Two problems followed:

| Problem | Evidence |
|---|---|
| The count ignored the budget. A higher budget bought no extra hypotheses, and a lower one made runs fail instead of running fewer. | At the $0.25 default, Gemini Flash-Lite could not finish 8 hypotheses, so the admin form refused it outright, although 5 fit. |
| The evidence gate removes most hypotheses, so the starting count sets how often a report is empty. | Production runs kept **5, 2 and 0** of 8 (`docs/GENERATION_PIPELINE_REVIEW.md` §7). |

Reports also gave no recommendation. They listed survivors by score, and the founder had to work out what to do first.

## 2. Review of the proposal ("use the budget to set the count")

**Verdict: sound, with one condition. The count must be sized for the dearest model the run might use.**

### 2.1 What makes it safe

1. **Size for the fallback as well as the primary.** Qwen's web search timed out in both production runs that tried
   it, and searches then moved to Gemini. A count sized for Qwen alone (≈ $0.006 per hypothesis) would let 16 or more
   hypotheses fit $0.40. Once searches moved to Flash-Lite (≈ $0.04 each), the run would hit `BUDGET_EXCEEDED`
   during retrieval: money spent and no report. So the count is the most that **every** provider the run may use can
   finish (`candidatesForBudget`).
2. **Prefer keeping the fallback to running more hypotheses.** If both providers can finish the minimum, the fallback
   is kept and the count is sized for the dearer model. A fallback that cannot finish even 5 is dropped, as before.
   Losing a few hypotheses costs less than a run that dies on a provider timeout.
3. **Clamp to 5–12.**
   - Below 5: with 0–5 survivors out of 8 so far, smaller runs would mostly produce empty reports.
   - Above 12: one discovery call starts repeating itself, every repeat still pays for a search, and retrieval (one
     hypothesis at a time) gets long.
4. **No extra safety margin.** `requiredUsd` is already the peak of the run's *reservations*, which charge every prompt
   byte as a token and add 12k tokens of headroom. Production bears this out: Flash-Lite needs $0.355 for 8 hypotheses,
   and the real run cost $0.297. A further margin would have cut today's $0.40 setting from 8 to 7 for no measured
   benefit.

### 2.2 Hidden limits of 8 that would have broken runs above 8

Each of these would have failed a 9–12 hypothesis run, most of them **after** the money was spent:

| Limit | Where | Failure it would cause |
|---|---|---|
| `jsonb_array_length(opportunities) not between 1 and 8` | `finish_research` (database) | Run fails with `EVIDENCE_REQUIRED` at the very last step |
| `classificationSchema … .max(32)` (8 × 4 sources) | `lib/research-core.ts` | The run-wide classification checkpoint fails to parse at evaluation |
| `evaluationSchema` / `reviewSchema … .max(8)` | `lib/research-core.ts` | The run-wide checkpoints fail to parse at scoring and finalizing |
| `key: /^c[1-8]$/`, `.min(5).max(8)`, `slice(0, 8)` | `lib/research-core.ts` | Discovery rejects `c9` onward |
| "Generate 8 …", "Keys must be c1 through c8", "Exactly 8 candidates." | prompt and draft schema | The model is asked for 8 whatever the budget |

Every limit is now derived from `MIN_CANDIDATES` / `MAX_CANDIDATES` / `SOURCES_PER_CANDIDATE` in
`lib/research-budget.ts`. The database check is raised by migration `20261109170000`.

### 2.3 What the budget buys

From the repository's own cost model (`estimateRunCost`, prices as of 2026-11-09). The current production policy is
**Qwen 3.8 Flash → Gemini 3.5 Flash-Lite**:

| Per-run budget | Hypotheses | Providers | Note |
|---|---|---|---|
| $0.20 | 12 | Qwen only | Flash-Lite cannot finish even 5, so the run has **no fallback** |
| $0.25 | 5 | Qwen → Flash-Lite | was 8 on Qwen with no fallback |
| $0.30 | 6 | Qwen → Flash-Lite | |
| $0.35 | 7 | Qwen → Flash-Lite | |
| **$0.40** | **8** | Qwen → Flash-Lite | **current production setting: unchanged** |
| $0.45 | 10 | Qwen → Flash-Lite | 9 and 10 cost the same: batches of 2 |
| $0.50 | 11 | Qwen → Flash-Lite | |
| $0.55+ | 12 | Qwen → Flash-Lite | maximum |

Expected and required cost per hypothesis count (expected / required):

| Hypotheses | Qwen 3.8 Flash | Gemini 3.5 Flash-Lite | Gemini 3.8 Flash | Qwen 3.8 Max | Gemini 4 Argon |
|---|---|---|---|---|---|
| 5 | $0.032 / $0.040 | $0.221 / $0.244 | $0.345 / $0.385 | $0.328 / $0.419 | $0.987 / $1.092 |
| 8 | $0.046 / $0.053 | $0.332 / $0.355 | $0.504 / $0.543 | $0.466 / $0.557 | $1.361 / $1.466 |
| 12 | $0.068 / $0.075 | $0.496 / $0.518 | $0.750 / $0.789 | $0.692 / $0.784 | $2.010 / $2.115 |

The model choice matters far more than the count: 8 hypotheses cost 30× more on Argon than on Qwen Flash.

### 2.4 Should a report show only the top opportunity?

**No.** It should say which one to test first and keep the rest.

- Scores are model judgements with evidence caps at 70 and 85. Ties at a cap are common, and a gap of a few points
  does not separate two ideas.
- The survivors have already been paid for (search, classification, evaluation, review). Hiding them saves nothing.
- The founder knows things the score does not: interest, access to buyers, the cost of each validation test.

The report now opens with **Start here**:

| Ranking | Shown |
|---|---|
| One survivor | That opportunity, its first validation step and its falsification test |
| Top score leads by **≥ 5 points** (`CLEAR_LEAD_POINTS`) | "Start here" with the leader |
| Top two within 5 points | "Two close candidates": both, side by side, with a test for each |
| None | Nothing. The run failed before a report, as before. |

On a tie, the opportunity with more linked source pages is listed first. The full shortlist and its sort control are
unchanged below.

## 3. Implementation

| Area | File | Change |
|---|---|---|
| Bounds | `lib/research-budget.ts` | `MIN_CANDIDATES = 5`, `MAX_CANDIDATES = 12`, `DEFAULT_CANDIDATES = 8` (runs and estimates that name no count), `SOURCES_PER_CANDIDATE = 4` |
| Cost model | `lib/research-budget.ts` | `estimateRunCost(model, at, candidates)`, `stageCalls(n)` (one search per hypothesis, `ceil(n/2)` batches per structured stage), `candidatesForBudget(models, budget)`. At 8 hypotheses the estimates match the old figures to the cent (tested). |
| Run plan | `lib/provider-settings-core.ts` | `runPlan(settings, budget)` → `{ providers, candidates }` or `null`. Used by the engine at run start **and** by the admin preview, so the two cannot drift. `assertBudgetFits` now requires the primary to finish the smallest run (5), not 8. |
| Engine | `lib/research-engine.ts` | `initializeResearch` stores `candidates` in the `setup` checkpoint. Discovery asks for that many, tells the model not to restate an earlier hypothesis, and normalises to that many. Runs started before the change resume with 8. The report records `candidates`. |
| Schemas | `lib/research-core.ts` | All bounds derived from the constants. Run-wide checkpoints are bounded by the largest run (48 sources, 12 hypotheses). The "fewer than five" report note no longer quotes "5–8". |
| Database | `supabase/migrations/20261109170000_finish_research_up_to_twelve_opportunities.sql` | `finish_research` accepts 1–12 opportunities. It also refuses a report whose `opportunities` array is missing: `jsonb_array_length` returned null, which slipped past the check. |
| Recommendation | `lib/report-presentation.ts`, `components/report-recommendation.tsx`, `components/research-report.tsx` | `recommendation()` (pure, tested) and the "Start here" section. The report summary shows "N hypotheses explored". |
| Admin | `components/admin-providers.tsx` | "Each new run explores N hypotheses…", and when keeping the fallback costs hypotheses: "Sized so that Flash-Lite, the fallback, can also finish… without automatic fallback this budget would allow N." The too-low message names the 5-hypothesis minimum. |
| Copy | `components/landing.tsx`, `research-config.tsx`, `research-run.tsx`, `messages/*.json` | "Up to eight" → "five to twelve, set by the research budget", in English, Simplified and Traditional Chinese. |

## 4. Verification

| Check | Result |
|---|---|
| `pnpm test` (unit, i18n, rendering) | 182 tests: 179 pass, 3 skipped (the database tests, which need `TEST_DATABASE_URL`) |
| `pnpm test:sql` against PostgreSQL 16 with every migration | 3 of 3 pass, including the new `finish-research.sql.test.mjs` |
| The new SQL test **without** the new migration | Fails with `EVIDENCE_REQUIRED` on a 12-opportunity report, as intended |
| `tsc --noEmit` and `next build` | Clean |
| Rendered "Start here" at 1100 px and 390 px with the app's compiled CSS | No horizontal overflow; long titles wrap |

New tests cover:
- the old 8-hypothesis estimate reproduced exactly
- cost never falling as the count rises
- the count being the maximum that fits, clamped and never shrinking as the budget grows
- the production policy at $0.25 / $0.40 / $0.55
- a fallback dropped rather than shrinking the run below 5
- the admin minimum
- every run-wide schema at 12 and at 13
- the migration bound tied to `MAX_CANDIDATES`
- the recommendation rules, and the section rendered in all three languages

`test:sql` now runs its files one at a time. Run in parallel against the same server, the signup-grant test
occasionally failed; that flake existed before this change.

## 5. Rollout

1. **Apply the migration first:** `supabase db push`, or `apply_migration` with the name
   `finish_research_up_to_twelve_opportunities` and the file renamed to the version it is assigned. Then record it in
   `docs/DATABASE_MIGRATIONS.md`. If the app ships first, a run sized above 8 whose 9th+ hypothesis survives would fail
   at the end. At today's $0.40 setting runs stay at 8, so the risk only starts when the budget is raised above $0.40.
2. **Deploy the app.** Runs already in flight have no `candidates` in their setup checkpoint and continue with 8.
3. **Raise the budget only when wanted.** At $0.40 nothing changes. $0.45 gives 10 hypotheses and $0.55 gives 12.
4. **Watch:** after 15–20 completed runs, compare survivors per run against `candidates` in `research_runs.report`.
   If survival stays at 2 or below even at 10–12 hypotheses, the bottleneck is evidence quality, not the count, and
   the next lever is more sources per hypothesis (see §6).

## 6. Known limits and follow-ups

| Limit | Why it is accepted now | Follow-up |
|---|---|---|
| Below about $0.24 the Flash-Lite fallback is dropped and Qwen runs alone. | Same behaviour as before for budgets that cannot pay for the fallback; production runs at $0.40. | Consider refusing to save a budget that leaves the run without a fallback while Qwen search is unreliable. |
| `CLEAR_LEAD_POINTS = 5` is a judgement. | Based on the scale (caps at 70/85, review deducts up to 15). No calibration data yet. | Re-check against real score gaps once there are 20+ reports. |
| The count is set per deployment by the admin budget, not per user. | The budget is a single setting in `app_settings`. | A per-run "deep research" tier would need a per-run budget and pricing. |
| More hypotheses do not fix weak evidence. | Survival so far: 5, 2, 0 of 8. | Spend surplus budget on more sources per hypothesis, or a top-up round when fewer than three survive. |
| `enqueue_research` still writes `target_opportunities: 8` into `configuration`. | Informational only; nothing reads it. | Drop it in the next migration that touches `enqueue_research`. |
