// Quality evaluation: runs the fixed briefs in tests/fixtures/eval-briefs.json through a deployment's normal research API
// and writes the WP-01 quality metrics per brief and overall to docs/eval/<date>-<git sha>.{json,md}.
//
// THIS SPENDS REAL MONEY on model and search providers. Run it only against a deployment connected to a DEVELOPMENT
// Supabase project (owner decision D4: never production; at most $5 per session unless the owner approves more).
//
//   node --experimental-strip-types scripts/research-eval.mjs \
//     --confirm-cost --max-usd 5 \
//     --base-url https://<development deployment> \
//     --cookie-file ~/.venturelens-eval-cookie [--brief b01 --brief b09] [--limit 5]
//
// --cookie-file holds the Cookie header of a signed-in session for a dedicated evaluation account on that deployment
// (copy it from the browser's developer tools). The account needs enough run slots; see the README.
//
// Spend control: runs go one at a time, each capped by its own per-run budget. A run starts only when the spend so far
// plus the largest per-run budget seen (or --per-run-usd before the first run reports one) still fits within --max-usd,
// so the session cannot exceed the cap even if every run spends its whole budget.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { qualityMetrics, median, durationMs, opportunitySupportingDomains } from "../lib/quality-metrics.ts";
import { researchRequestSchema, profileSchema } from "../lib/workspace-schema.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
export const usage = "Usage: node --experimental-strip-types scripts/research-eval.mjs --confirm-cost --max-usd <dollars> --base-url <url> --cookie-file <path> [--brief <id>]... [--limit <n>] [--per-run-usd <dollars>] [--out-dir <dir>] [--fixture <path>]";
/** Hard ceiling on --max-usd; a larger session needs an explicit change here, reviewed like any other code. */
export const MAX_SESSION_USD = 50;

/** Parses arguments. Returns { error } until --confirm-cost and a valid --max-usd (and the rest) are given. */
export function parseArgs(argv) {
  const options = { confirmCost: false, maxUsd: null, baseUrl: null, cookieFile: null, briefs: [], limit: null, perRunUsd: 0.25, outDir: join(root, "docs/eval"), fixture: join(root, "tests/fixtures/eval-briefs.json"), pollSeconds: 10, timeoutMinutes: 20 };
  const numeric = { "--max-usd": "maxUsd", "--limit": "limit", "--per-run-usd": "perRunUsd", "--poll-seconds": "pollSeconds", "--timeout-minutes": "timeoutMinutes" };
  const text = { "--base-url": "baseUrl", "--cookie-file": "cookieFile", "--out-dir": "outDir", "--fixture": "fixture" };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--confirm-cost") { options.confirmCost = true; continue; }
    const value = argv[i + 1];
    if (!(flag in numeric || flag in text || flag === "--brief")) return { error: `Unknown option ${flag}.` };
    if (value === undefined || value.startsWith("--")) return { error: `${flag} needs a value.` };
    i++;
    if (flag === "--brief") options.briefs.push(value);
    else if (flag in text) options[text[flag]] = value;
    else {
      const number = Number(value);
      if (!Number.isFinite(number) || number <= 0) return { error: `${flag} must be a positive number.` };
      options[numeric[flag]] = number;
    }
  }
  if (!options.confirmCost) return { error: "Refusing to run: this evaluation spends real provider money. Pass --confirm-cost to confirm." };
  if (options.maxUsd === null) return { error: "Refusing to run: pass --max-usd <dollars> to cap the session's spend." };
  if (options.maxUsd > MAX_SESSION_USD) return { error: `Refusing to run: --max-usd above $${MAX_SESSION_USD} needs a reviewed change to this script.` };
  if (options.perRunUsd > options.maxUsd) return { error: "--per-run-usd cannot exceed --max-usd." };
  if (!options.baseUrl) return { error: "Pass --base-url with the development deployment's address." };
  try {
    const url = new URL(options.baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    options.baseUrl = url.origin;
  } catch { return { error: "--base-url must be an http(s) URL." }; }
  if (!options.cookieFile) return { error: "Pass --cookie-file with the signed-in evaluation account's Cookie header." };
  if (options.limit !== null && !Number.isInteger(options.limit)) return { error: "--limit must be a whole number." };
  return { options };
}

/** Whether another run may start: worst case, it spends its whole budget, and the session must stay within the cap. */
export function canStartNext(spentUsd, perRunUsd, maxUsd) {
  return spentUsd + perRunUsd <= maxUsd + 1e-9;
}

/** The fixture's briefs, validated against the same schemas the API uses, filtered by --brief and --limit. */
export function loadFixture(path, ids = [], limit = null) {
  const fixture = JSON.parse(readFileSync(path, "utf8"));
  const profile = profileSchema.parse(fixture.profile);
  let briefs = fixture.briefs.map(entry => ({ id: entry.id, brief: researchRequestSchema.parse(entry.brief) }));
  if (ids.length) {
    const unknown = ids.filter(id => !briefs.some(entry => entry.id === id));
    if (unknown.length) throw new Error(`Unknown brief id: ${unknown.join(", ")}`);
    briefs = briefs.filter(entry => ids.includes(entry.id));
  }
  return { profile, briefs: limit ? briefs.slice(0, limit) : briefs };
}

/**
 * Runs the briefs one after another and returns the per-brief results. `request(method, path, body)` performs an
 * authenticated same-origin API call and resolves to { status, body }; `sleep(ms)` waits; both are injected for tests.
 */
export async function evaluate({ briefs, profile, maxUsd, perRunUsd, pollMs, timeoutMs, request, sleep, now = () => Date.now(), log = () => {} }) {
  const results = [];
  let spent = 0;
  let reserve = perRunUsd;
  let stoppedBy = null;
  const saved = await request("POST", "/api/workspace", { action: "profile", profile });
  if (saved.status !== 200) return { results, spentUsd: 0, stoppedBy: `profile: ${saved.body?.code ?? saved.status}` };
  for (const { id, brief } of briefs) {
    if (!canStartNext(spent, reserve, maxUsd)) { stoppedBy = "max-usd"; break; }
    const started = await request("POST", "/api/research", { action: "start", brief, requestKey: randomUUID() });
    if (started.status !== 202) {
      results.push({ id, mode: brief.discovery_mode ?? "combined", language: brief.language ?? null, status: "not_started", error_code: started.body?.code ?? String(started.status) });
      stoppedBy = `start: ${started.body?.code ?? started.status}`;
      break;
    }
    log(`${id}: started run ${started.body.id}`);
    const deadline = now() + timeoutMs;
    let detail = null;
    for (;;) {
      const polled = await request("GET", `/api/research/${started.body.id}`);
      if (polled.status === 200) detail = polled.body;
      if (detail && ["completed", "failed"].includes(detail.status)) break;
      if (now() >= deadline) break;
      await sleep(pollMs);
    }
    const finished = detail && ["completed", "failed"].includes(detail.status);
    const budget = Number(detail?.usage?.budget_usd ?? reserve);
    reserve = Math.max(reserve, budget);
    // An unfinished run may still spend up to its whole budget: count it at that, and stop, since it blocks the next run.
    const committed = finished ? Number(detail.usage?.committed_usd ?? 0) : budget;
    spent += committed;
    const opportunities = detail?.report?.opportunities ?? [];
    results.push({
      id, run_id: started.body.id, mode: brief.discovery_mode ?? "combined", language: brief.language ?? null,
      status: finished ? detail.status : "timeout", error_code: detail?.error_code ?? null,
      created_at: detail?.created_at ?? null, completed_at: detail?.completed_at ?? null,
      committed_usd: committed, budget_usd: budget, opportunities: opportunities.length,
      supporting_domains: opportunities.map(o => opportunitySupportingDomains(o.evidence)),
      evidence: opportunities.map(o => o.evidence ?? []),
    });
    log(`${id}: ${finished ? detail.status : "timed out"}${detail?.error_code ? ` (${detail.error_code})` : ""}, $${committed.toFixed(4)}; session $${spent.toFixed(4)} of $${maxUsd}`);
    if (!finished) { stoppedBy = "timeout"; break; }
  }
  return { results, spentUsd: spent, stoppedBy };
}

/** Overall metrics (the same definitions as /admin/quality) and per-brief rows. Duration runs from submission. */
export function summarize(results) {
  const ran = results.filter(r => r.run_id);
  const metrics = qualityMetrics({
    runs: ran.map(r => ({ id: r.run_id, status: r.status, error_code: r.error_code, started_at: r.created_at, completed_at: r.completed_at })),
    usage: ran.map(r => ({ run_id: r.run_id, status: "completed", estimated_usd: r.committed_usd, reserved_usd: r.committed_usd })),
    // Source classifications are not exposed by the research API, so vendor share is read on /admin/quality instead.
    sources: [],
    opportunities: ran.flatMap(r => r.evidence.map(evidence => ({ run_id: r.run_id, evidence }))),
  });
  const briefs = results.map(r => ({
    id: r.id, mode: r.mode, language: r.language, status: r.status, error_code: r.error_code, opportunities: r.opportunities ?? 0,
    supporting_domains_median: median(r.supporting_domains ?? []), duration_ms: r.created_at ? durationMs({ started_at: r.created_at, completed_at: r.completed_at }) : null,
    committed_usd: r.committed_usd ?? 0,
  }));
  return { metrics, briefs };
}

const fmt = (value, digits = 2) => (value === null || value === undefined ? "—" : Number(value).toFixed(digits));
const pct = value => (value === null ? "—" : `${Math.round(value * 100)}%`);
const minutes = ms => (ms === null ? "—" : `${(ms / 60000).toFixed(1)} min`);
export function renderMarkdown({ date, sha, baseUrl, maxUsd, spentUsd, stoppedBy, summary }) {
  const m = summary.metrics;
  return [
    `# Research quality evaluation — ${date} (${sha})`,
    "",
    `Deployment: ${baseUrl} · cap $${fmt(maxUsd)} · spent $${fmt(spentUsd, 4)} · ${stoppedBy ? `stopped early: ${stoppedBy}` : "all selected briefs ran"}`,
    "",
    "## Overall",
    "",
    "| Metric | Value |",
    "|---|---|",
    `| Runs | ${m.runs.total} (${m.runs.completed} completed, ${m.runs.failed} failed) |`,
    `| Completion rate | ${pct(m.completionRate)} |`,
    `| Insufficient-evidence rate | ${pct(m.insufficientEvidenceRate)} |`,
    `| Opportunities per completed run | ${fmt(m.opportunitiesPerCompletedRun.mean)} |`,
    `| Independent supporting domains (median per opportunity) | ${fmt(m.supportingDomainsMedian, 1)} |`,
    "| Vendor share of sources | see /admin/quality (not exposed by the research API) |",
    `| Duration from submission (median / p95) | ${minutes(m.duration.medianMs)} / ${minutes(m.duration.p95Ms)} |`,
    `| Cost per completed run (mean) | $${fmt(m.cost.meanCompletedRunUsd, 4)} |`,
    `| Spend per completed run (failures included) | $${fmt(m.cost.spendPerCompletedRunUsd, 4)} |`,
    `| Spend per surviving opportunity | $${fmt(m.cost.spendPerOpportunityUsd, 4)} |`,
    "",
    "## Per brief",
    "",
    "| Brief | Mode | Language | Status | Error | Opportunities | Domains (median) | Duration | Cost |",
    "|---|---|---|---|---|---|---|---|---|",
    ...summary.briefs.map(b => `| ${b.id} | ${b.mode} | ${b.language ?? "—"} | ${b.status} | ${b.error_code ?? "—"} | ${b.opportunities} | ${fmt(b.supporting_domains_median, 1)} | ${minutes(b.duration_ms)} | $${fmt(b.committed_usd, 4)} |`),
    "",
  ].join("\n");
}

function gitSha() {
  try { return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); } catch { return "unknown"; }
}

export async function main(argv = process.argv.slice(2), env = { fetch: globalThis.fetch, sleep: ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const { error, options } = parseArgs(argv);
  if (error) {
    console.error(`${error}\n${usage}`);
    return 1;
  }
  const cookie = readFileSync(options.cookieFile, "utf8").trim().replace(/^cookie:\s*/i, "");
  const { profile, briefs } = loadFixture(options.fixture, options.briefs, options.limit);
  const request = async (method, path, body) => {
    const response = await env.fetch(`${options.baseUrl}${path}`, {
      method,
      headers: { cookie, origin: options.baseUrl, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    let parsed = null;
    try { parsed = await response.json(); } catch { /* non-JSON answers (a sign-in redirect) keep a null body */ }
    return { status: response.status, body: parsed };
  };
  console.log(`Evaluating ${briefs.length} briefs against ${options.baseUrl}, capped at $${options.maxUsd}.`);
  const outcome = await evaluate({ briefs, profile, maxUsd: options.maxUsd, perRunUsd: options.perRunUsd, pollMs: options.pollSeconds * 1000, timeoutMs: options.timeoutMinutes * 60_000, request, sleep: env.sleep, log: line => console.log(line) });
  const summary = summarize(outcome.results);
  const date = new Date().toISOString().slice(0, 10);
  const sha = gitSha();
  mkdirSync(options.outDir, { recursive: true });
  const base = join(options.outDir, `${date}-${sha}`);
  const record = { date, sha, baseUrl: options.baseUrl, maxUsd: options.maxUsd, spentUsd: outcome.spentUsd, stoppedBy: outcome.stoppedBy, summary, results: outcome.results.map(({ evidence, ...rest }) => rest) };
  writeFileSync(`${base}.json`, `${JSON.stringify(record, null, 2)}\n`);
  writeFileSync(`${base}.md`, renderMarkdown({ ...record, summary }));
  console.log(`Spent $${outcome.spentUsd.toFixed(4)}. Wrote ${base}.json and ${base}.md`);
  return outcome.stoppedBy && outcome.stoppedBy !== "max-usd" ? 2 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(code => { process.exitCode = code; }, error => { console.error(error); process.exitCode = 1; });
}
