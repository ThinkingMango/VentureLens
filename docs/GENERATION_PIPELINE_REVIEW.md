# Research generation pipeline: end-to-end failure review (November 2026)

> **Question:** why does report generation always fail, across every model?
> **Method:** the production database (`research_runs`, `research_stages`, `research_usage`, `app_settings`) and Vercel runtime errors were read alongside the full source. SDK behaviour was checked in the installed `ai@7.0.163`, `@ai-sdk/google@4.0.112`, `@ai-sdk/openai-compatible@3.0.85` and `workflow@5.3.0`. Provider behaviour was checked against current Alibaba Model Studio and Gemini API documentation.
> **Not executed:** no live provider request was sent from this review. The Qwen path has **never run in production** (the usage ledger has no Qwen rows), so its live behaviour is still unproven. See §5.

---

## 1. Verdict

No research run has ever completed. The four runs in production failed for **four separate reasons**. Any one of them would have been enough to stop every run:

| # | Root cause | Evidence | Effect |
|---|---|---|---|
| **R1** | **Dispatch regression.** PR #11 added `start(workflow, args, { hook })`. On Vercel, `@workflow/core` refuses a start hook unless `WORKFLOW_VERCEL_EXPERIMENTAL_START_HOOK=1`, throws `WORLD_CONTRACT_ERROR` and creates no run. | Run `a1f60025` (created after PR #11 merged): `DISPATCH_FAILED`, no stages, no usage. SDK: `@workflow/core/dist/runtime/start.js` line 442. | **Every run since PR #11 fails before the workflow starts.** |
| **R2** | **The budget cannot pay for the configured models.** Google Search grounding costs $0.014 per query and each search issues 1–2 queries, so eight searches alone cost ≈ $0.21 of the $0.25 run budget. | Run `11436d76` (Gemini Flash-Lite): 7 searches cost **$0.190**, and the 8th could not reserve $0.076. | Gemini runs stop during retrieval, every time. |
| **R3** | **Reservations far larger than real usage.** A Gemini search reserved 64k context tokens (observed: ≈120), and a Qwen Flash search reserved 1,000,000 (≈$0.17). Gemini 4 Argon's search reservation was **$0.204**. | Run `8740abe9` (Argon): discovery spent $0.051, then the first search's $0.204 reservation was refused. No search was ever sent. | Expensive models fail at the first search; one uncertain call can starve the rest of a run. |
| **R4** | **Thinking consumed the search's output budget, and the failure was then mislabelled.** Gemini counts thinking tokens against `maxOutputTokens`. Argon searched at `high` thinking with a 2,048-token cap. The response came back without grounding, the parser threw without reporting the billed usage, the $0.204 stayed reserved as "unknown", and the fallback could no longer reserve. | Run `ae402dc2` (Argon): retrieval row `status=unknown`, 0 tokens; final error `BUDGET_EXCEEDED`. Vercel runtime error shows `BUDGET_EXCEEDED` from the `stage` step. | The true cause (no grounding) was hidden behind a budget error. |

Two further defects would have failed the **Qwen** path the first time it ran:

| # | Defect | Evidence |
|---|---|---|
| **R5** | Every Qwen 3.8 Max structured call sent `enable_thinking: true` together with `response_format: json_schema`. | Alibaba docs, *Structured output*: "Models labeled 'non-thinking mode' support structured output only in non-thinking mode." Qwen Max is the configured fallback. |
| **R6** | Any bound the model missed failed the whole run as `INVALID_OUTPUT`, with no retry. Examples: an English rationale over 800 characters, a score of `72.5`, a skipped or repeated `source_key`/`candidate_id`, or `C1` instead of `c1`. | `requireExactIds` and strict Zod bounds on every stage. Since PR #13, reports are written in English, which makes the 800-character fields much tighter than they were in Chinese. |

The live research policy on 2026-11-05 was **Gemini 4 Argon primary, Qwen 3.8 Max fallback, $0.25 per run**. The estimates below show **neither model can finish a run at that budget under any code**.

---

## 2. Production evidence

```
run       model                  stage reached           error             what the ledger shows
11436d76  gemini-3.5-flash-lite  retrieval c1–c7 done    BUDGET_EXCEEDED   7 searches = $0.190; c8 needed $0.0765
8740abe9  gemini-4-argon         discovery done          BUDGET_EXCEEDED   discovery $0.051 + search reservation $0.204 > $0.25
ae402dc2  gemini-4-argon         retrieval c1 sent       BUDGET_EXCEEDED   search row "unknown", $0.204 still held
a1f60025  —                      never started           DISPATCH_FAILED   no stages, no usage (first run after PR #11)
```

`docs/REVIEW.md` finding **B7** had already predicted R3 ("one unknown retrieval ... next reservation fails with BUDGET_EXCEEDED"), but it was not fixed.

---

## 3. Cost reality per model

From `lib/research-budget.ts` (`estimateRunCost`), calibrated against the ledger above. *Expected* is the typical total spend of a complete run. *Required* is the smallest per-run budget at which every reservation in that run succeeds.

| Model | Expected per run | Required budget | Fits $0.25? |
|---|---|---|---|
| Qwen 3.8 Flash | ≈ $0.05 | ≈ $0.05 | ✅ |
| Gemini 3.5 Flash-Lite | ≈ $0.33 | ≈ $0.36 | ❌ |
| Gemini 3.8 Flash | ≈ $0.50 | ≈ $0.54 | ❌ |
| Qwen 3.8 Max | ≈ $0.47 | ≈ $0.56 | ❌ |
| Gemini 4 Argon | ≈ $1.36 | ≈ $1.47 (≈ $2.71 from 2026-12-01) | ❌ |

What drives the numbers: about two-thirds of a Gemini run is Search grounding ($0.014/query). Google's first 5,000 grounded requests each month are free, so real spend at beta volume may be close to zero, but the ledger deliberately charges list price. Reasoning models are expensive because thinking tokens bill as output.

The Qwen figures assume ≈8k context tokens per DashScope search. That is unverified until Qwen has run in production.

---

## 4. What changed

| Area | Change | Fixes |
|---|---|---|
| `lib/research-service.ts` | Try `start({ hook })` first. If the World reports `WORLD_CONTRACT_ERROR` or `START_HOOK_ADMISSION_DISABLED`, start without a hook. The conditional claim in `initializeResearch` already guarantees only one workflow executes a run. | R1 |
| `lib/research-budget.ts` (new) | One `reservationFor()` formula, shared by the engine and the estimate so they cannot drift, plus `estimateRunCost()`. | R2, R3 |
| `lib/research-models.ts` | Search context allowances right-sized (Gemini 64k → 16k, Qwen Flash 1M → 64k). A separate `searchThinking` level per model (Argon searches at `low`). Qwen structured calls are always non-thinking. | R3, R4, R5 |
| `lib/research-engine.ts` · `initializeResearch` | Pre-flight budget check. A provider that cannot finish within the run's budget is skipped. If none can, the run stops **before any provider request**, recording `budget_block.kind = "estimate"`, and the free-run slot is returned by the existing trigger. A fallback that cannot finish is disabled for the run. | R2 |
| `lib/qwen-core.ts`, `lib/research-fallback-core.ts` | A billed search response with no sources or grounding now throws with its real `usage`, so the ledger records actual cost instead of holding the whole reservation as "unknown". | R4 |
| `lib/research-engine.ts` · `providerCall` | Removed the post-hoc `BUDGET_EXCEEDED` that discarded an already-paid search when it used more queries than reserved; the real count is recorded and logged. An empty search (`RETRIEVAL_UNAVAILABLE`) no longer moves the rest of the run to the fallback provider. | R3, R4 |
| `lib/research-core.ts` | Models answer against lenient *draft* schemas. Server-side normalisers assign candidate keys by position, trim prose at sentence boundaries, clamp and round scores, cap lists, and drop unknown or duplicate ids. A trimmed quote is still a verbatim substring, so the evidence gate is unchanged. | R6 |
| `lib/research-engine.ts` · `structured` | A response that does not parse at all (`NoObjectGeneratedError`, typically output cut off at the token limit) is retried once as a separately reserved and metered request. | R6 |
| `lib/research-engine.ts` · retrieval | A hypothesis whose search finds nothing, or whose pages cannot be read, is skipped instead of failing the run. The run still fails if *no* hypothesis produced evidence. | robustness |
| `workflows/research.ts` | Failures are logged with provider, model, HTTP status, finish reason and message, and a `failure` checkpoint (stage, code, status) is stored so a failed run can be diagnosed after runtime logs expire (1 day on Pro). Engine errors are thrown as `FatalError`; a stage step gets one retry only for platform crashes or timeouts and resumes from the last saved batch. | observability |
| `/admin` | Shows the estimated cost of a complete run and the minimum budget. Saving a primary model the budget cannot pay for is refused (`BUDGET_TOO_LOW`, HTTP 409). An unaffordable fallback is flagged. | stops R2 recurring |
| Run page | A pre-flight budget stop explains the estimate and confirms that nothing was sent or charged. | UX |

Tests: 100 unit tests pass (84 before this change). New coverage includes ledger-calibrated estimates, normalisers, metered parse failures, retry-once, skip-on-empty-search, the pre-flight budget stop, dispatch without hooks, and admin refusal. `pnpm typecheck` and `pnpm build` pass.

---

## 5. Required operator actions

These change production configuration, so they were **not** done automatically.

1. **Change the research policy at `/admin`.** The saved policy (Argon / Qwen Max / $0.25) cannot finish a run. After this deploy, runs on that policy stop at setup without charge, and the admin page will refuse to re-save it. Recommended:
   - **Primary Qwen 3.8 Flash, fallback Gemini 3.5 Flash-Lite, budget $0.40.** Qwen runs for ≈ $0.05, and the fallback can still finish a whole run if DashScope is down.
   - Cheapest option: Qwen 3.8 Flash at $0.25. The Gemini fallback is then automatically disabled for the run.
   - Gemini-only: Flash-Lite at **≥ $0.40**.
2. **Prove the Qwen path once.** It has never executed in production. Run `pnpm test:research:e2e` with real keys, or one live run after step 1, and confirm the following against the response:
   - `GET /compatible-mode/v1/models` lists the model;
   - `/responses` accepts `tool_choice: "required"`;
   - `web_search_call.action.sources` is populated;
   - DashScope keys are **Beijing-region** keys (keys differ by region).
3. *(Optional)* Set `WORKFLOW_VERCEL_EXPERIMENTAL_START_HOOK=1` in Vercel to restore idempotent dispatch through start hooks. Dispatch works without it.

---

## 6. Remaining risks (not fixed here)

| Risk | Why it matters | Suggested next step |
|---|---|---|
| Classification, evaluation and review run up to 4 model calls inside **one** workflow step. With slow reasoning models (Argon, Max) that can exceed the function's max duration. | The new single step retry resumes from saved batches, but each retry pays for the interrupted call again. | Make each batch its own workflow step. |
| Gemini 4 Argon structured stages think at `high` within a 10k output cap. | Truncated JSON → one retry → `INVALID_OUTPUT`. | Use `low` for evaluation and review, or raise the cap. Either way Argon needs ≥ $1.50 per run. |
| A reservation for a call that times out stays held. | That cost is real but unknown. | Reconcile "unknown" rows from provider usage APIs. |
| Pricing is hard-coded with date switches (`researchModelPricing`). | Prices go stale silently. | Move pricing into `app_settings`, keep a `checked_at`, and fail closed when it is stale. |
| Cost estimates are calibrated on only three runs. | Estimates may be off. | Re-calibrate `typicalRun` from `research_usage` after 10–20 completed runs. |

---

## 7. Production validation (2026-11-06)

After PR #16 was deployed with the research policy **Qwen 3.8 Flash → Gemini 3.5 Flash-Lite, $0.40**, run `7005616b` was the **first research run to complete in production**: 8 candidates, 32 classified sources, **5 opportunities**, 4 min 45 s, $0.297 committed.

| What the run showed | Follow-up |
|---|---|
| Dispatch without start hooks works (`start hooks unavailable … starting without one`). | None. |
| Qwen structured output (discovery) works in non-thinking mode: 346 in / 1,068 out tokens. | None. |
| The first Qwen web search **timed out after 90 s**; the run switched to Gemini for the rest, which is why it cost $0.30 rather than ≈ $0.05. | Open: confirm whether DashScope search latency from Vercel to cn-beijing routinely exceeds 90 s before raising the timeout (the step must also fit the fallback search and page fetches). |
| The browser showed **"Load failed"** although the server created and started the run: Safari's raw `fetch` error after the response was lost. | Fixed: `lib/api-client.ts` re-sends the idempotent start with the same request key, never shows raw browser text, and parses HTML/empty bodies safely. Retry is not re-sent; the run's status decides. |
| **Advantage was 0 for every opportunity in a combined run**: Flash-Lite applied "In market mode advantage=0" regardless of mode, costing up to 15 points each. | Fixed: the instruction is now mode-specific and market mode is enforced server-side. |
| **Most evidence came from AI vendors' own sites**, classified as "secondary". | Fixed in the prompts: search prefers independent sources (forums, associations, surveys, news, government, job postings), and any page from a company selling in the space is classified "vendor". This makes the evidence gate stricter, so expect fewer but better-supported opportunities. |
