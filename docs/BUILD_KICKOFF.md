# Kickoff prompt for a VentureLens Claude Code session

Paste everything below the line into a new Claude Code session that has the `ThinkingMango/VentureLens` repository attached with push access. The build specification is already in the repository at `docs/PRODUCT_SPEC_V1.md`.

---

You are continuing development of VentureLens in this repository. The build specification is `docs/PRODUCT_SPEC_V1.md`.

**Read first, in this order:** `AGENTS.md` (the Next.js version here is newer than your training data; read `node_modules/next/dist/docs/` before writing Next.js code), `README.md`, `docs/PRODUCT_SPEC_V1.md` (all of it), `plan.md`, `docs/DATABASE_MIGRATIONS.md`, `docs/REVIEW.md`, `docs/GENERATION_PIPELINE_REVIEW.md`.

**Then do WP-00 only:**
1. Install, typecheck, test and build. Report the exact results.
2. Add the CI workflow described in WP-00.
3. Create `docs/IMPLEMENTATION_STATUS.md` with one row per work package.
4. Open a draft pull request.

**After WP-00, wait for my go-ahead.** Then work through the packages in the order of spec §4, **one branch and one draft PR per work package**.

**Rules that apply throughout:**
- Pricing, payments and Stripe are out of scope. Do not add billing logic.
- Follow the spec's guardrails (§3):
  - new migration files only, never edit applied ones;
  - row-level security enabled **and** forced, composite `(id, user_id)` foreign keys, explicit grants;
  - every model call budgeted through `providerCall`/`structured`;
  - lenient model schemas plus server-side normalisers;
  - all UI text through `copy()` with entries in all three catalogues;
  - new test files added to `package.json → scripts.test`;
  - demo kept on fixed data;
  - old reports must keep rendering.
- Where the spec says **VERIFY**, check the code first. If the code differs from the spec, follow the code and explain the difference in the PR.
- **Ask me before:**
  - applying any migration to the production Supabase project;
  - running `pnpm test:research:e2e` or the quality evaluation script (they cost money);
  - sending real email;
  - deciding any item in spec §8 (Owner decisions).
- Report honestly in each PR using the checklist in spec §9.2. Use the status words in §9.3, and separate what you **ran** from what you only **reviewed**.

Start now with WP-00.
