import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { isAdministrator } from "../lib/admin-access.ts";
import { evidenceGate } from "../lib/research-core.ts";
import {
  candidateDiagnostics, filterRange, parseRunFilters, providerSwitches, runListRow, stageTimeline,
  structuralBudgetBlock, structuralFailure, structuralSetup, usageStage,
} from "../lib/admin-runs-core.ts";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const adminPages = readdirSync(new URL("../app/(admin)/admin", import.meta.url), { recursive: true })
  .filter(file => file.endsWith("page.tsx"))
  .map(file => `app/(admin)/admin/${file}`);

test("every operator page checks the administrator claim before it reads anything", () => {
  assert.deepEqual(adminPages.sort(), ["app/(admin)/admin/page.tsx", "app/(admin)/admin/quality/page.tsx", "app/(admin)/admin/runs/[id]/page.tsx", "app/(admin)/admin/runs/page.tsx"]);
  for (const path of adminPages) {
    const source = read(path);
    const body = source.slice(source.indexOf("export default async function Page"));
    const guard = body.indexOf("await requireAdministrator()");
    assert.ok(guard > 0, `${path} calls requireAdministrator`);
    assert.equal(body.indexOf("await "), guard, `${path}: the guard is the first thing the page awaits`);
    assert.match(source, /export const dynamic = "force-dynamic"/, `${path} is rendered per request`);
    assert.match(source, /robots: \{ index: false, follow: false \}/, `${path} is not indexed`);
  }
  // Signed-out visitors are redirected to sign-in (requireUser); signed-in non-administrators get a 404.
  const guard = read("lib/admin-guard.ts");
  assert.match(guard, /^import "server-only";/);
  assert.match(guard, /const \{ user \} = await requireUser\(\);\s*if \(!isAdministrator\(user\)\) notFound\(\);/);
  assert.match(read("lib/workspace.ts"), /if \(error \|\| !user\) redirect\("\/login"\)/);
  assert.match(read("proxy.ts"), /"\/admin\/:path\*"/, "the proxy also sends signed-out visitors of /admin/* to sign-in");
});

test("the proxy answers signed-in non-administrators on operator pages with a real 404 before anything renders", () => {
  // notFound() inside a streamed page keeps HTTP 200 and the page's title; the proxy check makes the status a true 404.
  const proxy = read("proxy.ts");
  assert.match(proxy, /import \{ isAdministrator \} from "@\/lib\/admin-access";/);
  assert.match(proxy, /if \(user && \/\^\\\/admin\(\\\/\|\$\)\/\.test\(path\) && !isAdministrator\(user\)\) \{/);
  assert.match(proxy, /NextResponse\.rewrite\(new URL\("\/__not-found", request\.url\)\)/, "an unmatched route renders the not-found page with status 404");
  const pattern = /^\/admin(\/|$)/;
  assert.ok(["/admin", "/admin/runs", "/admin/runs/x", "/admin/quality"].every(path => pattern.test(path)));
  assert.ok(!["/api/admin/providers", "/administrator", "/dashboard"].some(path => pattern.test(path)), "the admin API keeps its own 401/403 JSON answers");
});

test("the operator data loaders run on the server only and check the claim again", () => {
  const source = read("lib/admin-runs.ts");
  assert.match(source, /^import "server-only";/);
  for (const loader of ["listRuns", "runInspection", "qualityReport"]) {
    const body = source.slice(source.indexOf(`export async function ${loader}(`));
    assert.match(body, /^export async function \w+\(user: Identity[^)]*\)[^{]*\{\s*assertAdministrator\(user\);/, `${loader} checks the claim first`);
  }
});

test("only a confirmed account with the server-managed admin claim is an administrator", () => {
  const confirmed = "2026-11-01T00:00:00Z";
  assert.equal(isAdministrator({ email_confirmed_at: confirmed, app_metadata: { role: "admin" } }), true);
  assert.equal(isAdministrator({ email_confirmed_at: confirmed, app_metadata: { is_admin: true } }), true, "legacy flag");
  assert.equal(isAdministrator({ email_confirmed_at: null, app_metadata: { role: "admin" } }), false, "unconfirmed");
  assert.equal(isAdministrator({ email_confirmed_at: confirmed, app_metadata: {} }), false);
  assert.equal(isAdministrator({ email_confirmed_at: confirmed, app_metadata: { role: "Admin" } }), false);
  assert.equal(isAdministrator({ email_confirmed_at: confirmed, user_metadata: { role: "admin" } }), false, "user_metadata never grants access");
  assert.equal(isAdministrator(null), false);
});

// Shared fixture: c1 passes (two independent domains, one secondary pain source); c2 is vendor-only; c3's search was
// skipped; c4 was never reached.
const source = (key, candidate, url, excerpt) => ({ source_key: key, candidate_id: candidate, url, title: `PRIVATE TITLE ${key}`, excerpt, retrieved_at: "2026-11-01T00:00:00Z", published_at: null });
const evidence = [
  source("c1-s1", "c1", "https://forum.example-trade.org/t/1", "Owners say invoicing takes them a full day every month."),
  source("c1-s2", "c1", "https://news.example-press.com/a", "A survey found most firms still reconcile invoices by hand."),
  source("c1-s3", "c1", "https://www.example-press.com/b", "Firms report invoice reconciliation is their most hated task."),
  source("c2-s1", "c2", "https://vendor-one.io/blog", "Our tool saves hours on scheduling for every clinic."),
  source("c2-s2", "c2", "https://vendor-two.io/stats", "Clinics lose revenue to no-shows, says our product team."),
];
const classify = (key, reliability, stance, quote, kind = "pain") => ({ source_key: key, relevant: true, kind, reliability, stance, quote, claim: "PRIVATE CLAIM" });
const classifications = [
  classify("c1-s1", "secondary", "supports", "invoicing takes them a full day every month"),
  classify("c1-s2", "secondary", "supports", "most firms still reconcile invoices by hand"),
  classify("c1-s3", "secondary", "contradicts", "invoice reconciliation is their most hated task"),
  classify("c2-s1", "vendor", "supports", "saves hours on scheduling for every clinic"),
  classify("c2-s2", "vendor", "supports", "Clinics lose revenue to no-shows"),
];
const retrieval = { c1: { evidence: [] }, c2: { evidence: [] }, c3: { evidence: [], skipped: "RETRIEVAL_UNAVAILABLE" } };

test("candidate diagnostics take the verdict from the evidence gate and return structure only", () => {
  const diagnostics = candidateDiagnostics({ keys: ["c1", "c2", "c3", "c4"], retrieval, evidence, classifications });
  assert.deepEqual(diagnostics.map(d => [d.key, d.retrieval, d.gate]), [["c1", "searched", "passed"], ["c2", "searched", "failed"], ["c3", "skipped", "failed"], ["c4", "not_reached", "failed"]]);
  for (const d of diagnostics) {
    const gate = evidenceGate(d.key, evidence, classifications);
    assert.equal(d.gate === "passed", gate.sources.length > 0, `${d.key} agrees with evidenceGate`);
    assert.equal(d.supportingDomains, gate.supportingDomains);
  }
  const [c1, c2] = diagnostics;
  assert.deepEqual({ sources: c1.sources, domains: c1.domains, classified: c1.classified, vendorShare: c1.vendorShare, supportingDomains: c1.supportingDomains }, { sources: 3, domains: 2, classified: 3, vendorShare: 0, supportingDomains: 2 });
  assert.deepEqual(c1.rows.map(r => [r.domain, r.stance]), [["example-trade.org", "supports"], ["example-press.com", "supports"], ["example-press.com", "contradicts"]]);
  assert.equal(c2.vendorShare, 1);
  // Owner decision D5: no titles, excerpts, quotes, claims or full URLs leave the server.
  const output = JSON.stringify(diagnostics);
  for (const secret of ["PRIVATE", "invoic", "/blog", "https://", "survey"]) assert.ok(!output.includes(secret), `diagnostics do not contain "${secret}"`);
});

test("before classification the gate is not evaluated, and ungrounded quotes do not count", () => {
  const pending = candidateDiagnostics({ keys: ["c1"], retrieval, evidence, classifications: null });
  assert.equal(pending[0].gate, "not_evaluated");
  assert.equal(pending[0].classified, 0);
  const invented = classifications.map(item => (item.source_key === "c1-s2" ? { ...item, quote: "a sentence that is not in the source at all" } : item));
  const [c1] = candidateDiagnostics({ keys: ["c1"], retrieval, evidence, classifications: invented });
  assert.equal(c1.classified, 2, "the invented quote is dropped, as the gate drops it");
  assert.equal(c1.gate, "failed");
});

test("checkpoint summaries keep structural fields and drop the brief and profile", () => {
  const setup = { brief: { name: "PRIVATE BRIEF", context: "PRIVATE" }, profile: { name: "Jane", skills: "PRIVATE" }, provider: "dashscope-beijing", model: "qwen3.8-flash", active_provider: "google-gemini", search_provider: "google-gemini", fallback_allowed: true, methodology: "evidence-driven-v2", pricing: { input: 1 } };
  assert.deepEqual(structuralSetup(setup), { provider: "dashscope-beijing", model: "qwen3.8-flash", active_provider: "google-gemini", search_provider: "google-gemini", fallback_allowed: true, methodology: "evidence-driven-v2" });
  assert.deepEqual(structuralFailure({ stage: "classification", code: "INVALID_OUTPUT", name: "AI_NoObjectGeneratedError", status: null, at: "2026-11-01T00:00:00Z", message: "PRIVATE" }), { stage: "classification", code: "INVALID_OUTPUT", name: "AI_NoObjectGeneratedError", status: null, at: "2026-11-01T00:00:00Z" });
  assert.deepEqual(structuralBudgetBlock({ stage: "setup", kind: "estimate", provider: "qwen", model: "qwen3.8-max", required_usd: 0.61, extra: { a: 1 } }), { stage: "setup", kind: "estimate", provider: "qwen", model: "qwen3.8-max", required_usd: 0.61 });
  assert.deepEqual(structuralSetup(null), {});
  assert.deepEqual(structuralSetup({ model: { nested: true } }), {}, "only scalar values are kept");
});

test("run list filters, ranges and rows", () => {
  assert.deepEqual(parseRunFilters({ status: "failed", error: "insufficient_evidence", from: "2026-11-01", to: "2026-11-09", page: "2" }), { status: "failed", errorCode: "INSUFFICIENT_EVIDENCE", from: "2026-11-01", to: "2026-11-09", page: 2 });
  assert.deepEqual(parseRunFilters({ status: "deleted", error: "DROP TABLE runs;", from: "yesterday", to: "2026-13-40", page: "-1" }), { status: null, errorCode: null, from: null, to: null, page: 1 });
  assert.deepEqual(parseRunFilters({ status: ["running", "failed"] }).status, "running");
  assert.deepEqual(filterRange({ from: "2026-11-01", to: "2026-11-09" }), { fromIso: "2026-11-01T00:00:00.000Z", beforeIso: "2026-11-10T00:00:00.000Z" });
  assert.deepEqual(filterRange({ from: null, to: null }), { fromIso: null, beforeIso: null });
  const row = runListRow(
    { id: "r1", status: "completed", stage: "completed", error_code: null, mode: "market", language: "en", created_at: "2026-11-01T00:00:00Z", started_at: "2026-11-01T00:00:10Z", completed_at: "2026-11-01T00:05:10Z", retry_count: 0 },
    [{ run_id: "r1", status: "completed", estimated_usd: "0.04", reserved_usd: "0.2" }, { run_id: "r1", status: "reserved", estimated_usd: null, reserved_usd: "0.01" }, { run_id: "r2", status: "completed", estimated_usd: 5, reserved_usd: 5 }],
    3,
  );
  assert.equal(row.durationMs, 300_000);
  assert.ok(Math.abs(row.committedUsd - 0.05) < 1e-9);
  assert.equal(row.opportunities, 3);
});

test("usage stages, provider switches and the stage timeline", () => {
  assert.equal(usageStage("retrieval:c3:google-gemini:wrun_01ABC"), "retrieval:c3");
  assert.equal(usageStage("classification:batch:1:dashscope-beijing:wrun_01ABC"), "classification:batch:1");
  assert.equal(usageStage("discovery"), "discovery");
  const t = s => `2026-11-01T00:00:${String(s).padStart(2, "0")}Z`;
  assert.deepEqual(providerSwitches([
    { stage_key: "retrieval:c2:google-gemini:w", provider: "google-gemini", created_at: t(3) },
    { stage_key: "discovery:dashscope-beijing:w", provider: "dashscope-beijing", created_at: t(1) },
    { stage_key: "retrieval:c1:dashscope-beijing:w", provider: "dashscope-beijing", created_at: t(2) },
    { stage_key: "classification:batch:0:dashscope-beijing:w", provider: "dashscope-beijing", created_at: t(4) },
  ]), [
    { stage: "retrieval:c2", from: "dashscope-beijing", to: "google-gemini", at: t(3) },
    { stage: "classification:batch:0", from: "google-gemini", to: "dashscope-beijing", at: t(4) },
  ]);
  assert.deepEqual(stageTimeline([{ stage_key: "discovery", created_at: t(2), output: { a: "é" } }, { stage_key: "setup", created_at: t(1), output: null }]), [
    { key: "setup", created_at: t(1), bytes: 4 },
    { key: "discovery", created_at: t(2), bytes: 10 },
  ]);
});

test("the inspector tells a timed-out search apart from an empty one, and shows a skipped configured model", () => {
  const retrieval = { c1: { evidence: [] }, c2: { evidence: [], skipped: "RETRIEVAL_UNAVAILABLE" }, c3: { evidence: [], skipped: "TRANSIENT_PROVIDER" } };
  const diagnostics = candidateDiagnostics({ keys: ["c1", "c2", "c3"], retrieval, evidence: [], classifications: null });
  assert.deepEqual(diagnostics.map(d => d.retrieval), ["searched", "skipped", "failed"]);
  const setup = { model: "qwen3.8-flash", fallback_allowed: false, primary_skipped: { provider: "gemini", model: "gemini-3.8-flash", required_usd: 0.5675, budget_usd: 0.55 }, brief: { name: "Private" } };
  assert.deepEqual(structuralSetup(setup), { model: "qwen3.8-flash", fallback_allowed: false, primary_skipped: "gemini-3.8-flash", primary_required_usd: 0.5675 });
});
