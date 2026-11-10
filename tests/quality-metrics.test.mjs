import test from "node:test";
import assert from "node:assert/strict";
import { qualityMetrics, committedUsd, median, percentile, durationMs, opportunitySupportingDomains, parseMetricWindow } from "../lib/quality-metrics.ts";

const at = minutes => new Date(Date.UTC(2026, 10, 1, 0, minutes)).toISOString();
// A fixed sample: 3 completed, 3 failed (one stopped by the pre-flight budget check), 1 still running.
const runs = [
  { id: "r1", status: "completed", error_code: null, started_at: at(0), completed_at: at(4) },
  { id: "r2", status: "completed", error_code: null, started_at: at(0), completed_at: at(6) },
  { id: "r3", status: "completed", error_code: null, started_at: at(0), completed_at: at(10) },
  { id: "r4", status: "failed", error_code: "INSUFFICIENT_EVIDENCE", started_at: at(0), completed_at: at(5) },
  { id: "r5", status: "failed", error_code: "BUDGET_EXCEEDED", started_at: at(0), completed_at: at(0), preflight_blocked: true },
  { id: "r6", status: "failed", error_code: "WORKFLOW_INTERRUPTED", started_at: at(0), completed_at: null },
  { id: "r7", status: "running", error_code: null, started_at: at(0), completed_at: null },
];
const usage = [
  { run_id: "r1", status: "completed", estimated_usd: "0.10", reserved_usd: "0.20" },
  { run_id: "r2", status: "completed", estimated_usd: 0.05, reserved_usd: 0.2 },
  { run_id: "r3", status: "unknown", estimated_usd: null, reserved_usd: 0.03 }, // cost unknown: the reservation counts
  { run_id: "r4", status: "completed", estimated_usd: 0.12, reserved_usd: 0.2 },
  { run_id: "elsewhere", status: "completed", estimated_usd: 9, reserved_usd: 9 }, // a run outside the window
];
const support = host => ({ url: `https://${host}/page`, stance: "supports" });
const opportunities = [
  { run_id: "r1", evidence: [support("a.org"), support("news.a.org"), support("b.com"), { url: "https://c.net/x", stance: "contradicts" }] }, // 2
  { run_id: "r1", evidence: [support("a.org"), support("b.com"), support("c.net")] }, // 3
  { run_id: "r2", evidence: [{ url: "https://old.example.co.uk/1" }, { url: "https://other.org/2" }] }, // v1 payload: 2
  { run_id: "r7", evidence: [support("x.org"), support("y.org")] }, // run not completed: not counted
];
const sources = [{ reliability: "vendor" }, { reliability: "secondary" }, { reliability: "primary" }, { reliability: "vendor" }, { reliability: null }];

test("each quality metric follows its definition on a fixed sample", () => {
  const m = qualityMetrics({ runs, usage, sources, opportunities });
  assert.deepEqual(m.runs, { total: 7, completed: 3, failed: 3, active: 1, preflightBlocked: 1 });
  assert.equal(m.completionRate, 3 / 5, "pre-flight stops are left out of completion");
  assert.equal(m.insufficientEvidenceRate, 1 / 6, "share of all finished runs");
  assert.deepEqual(m.errorCodes, { INSUFFICIENT_EVIDENCE: 1, BUDGET_EXCEEDED: 1, WORKFLOW_INTERRUPTED: 1 });
  assert.deepEqual(m.opportunitiesPerCompletedRun, { mean: 1, distribution: { 0: 1, 1: 1, 2: 1 } });
  assert.equal(m.supportingDomainsMedian, 2, "median of 2, 3, 2");
  assert.equal(m.vendorShare, 2 / 4, "unclassified sources are left out");
  assert.deepEqual(m.duration, { medianMs: 5 * 60_000, p95Ms: 10 * 60_000, runs: 5 });
  assert.ok(Math.abs(m.cost.totalUsd - 0.30) < 1e-9, "window runs only");
  assert.ok(Math.abs(m.cost.meanCompletedRunUsd - 0.18 / 3) < 1e-9);
  assert.ok(Math.abs(m.cost.spendPerCompletedRunUsd - 0.30 / 3) < 1e-9, "failed runs' spend is included");
  assert.ok(Math.abs(m.cost.spendPerOpportunityUsd - 0.30 / 3) < 1e-9);
  assert.equal(m.cost.uncertainCalls, 1);
});

test("an empty window has no rates rather than zeros", () => {
  const m = qualityMetrics({ runs: [], usage: [], sources: [], opportunities: [] });
  assert.equal(m.completionRate, null);
  assert.equal(m.insufficientEvidenceRate, null);
  assert.equal(m.opportunitiesPerCompletedRun.mean, null);
  assert.equal(m.supportingDomainsMedian, null);
  assert.equal(m.vendorShare, null);
  assert.deepEqual(m.duration, { medianMs: null, p95Ms: null, runs: 0 });
  assert.equal(m.cost.spendPerCompletedRunUsd, null);
});

test("helpers: committed cost, median, nearest-rank percentile, duration, window", () => {
  assert.ok(Math.abs(committedUsd(usage.slice(0, 3)) - 0.18) < 1e-9);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
  const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(hundred, 95), 95);
  assert.equal(percentile([7], 95), 7);
  assert.equal(percentile([1, 2], 50), 1);
  assert.equal(durationMs({ started_at: at(5), completed_at: at(1) }), null, "out of order");
  assert.equal(durationMs({ started_at: null, completed_at: at(1) }), null);
  assert.equal(parseMetricWindow("7"), 7);
  assert.equal(parseMetricWindow(["90"]), 90);
  assert.equal(parseMetricWindow("365"), 30);
  assert.equal(parseMetricWindow(undefined), 30);
});

test("supporting domains count registrable domains of supporting sources only, as the evidence gate does", () => {
  assert.equal(opportunitySupportingDomains([support("blog.a.org"), support("www.a.org"), support("a.org.")]), 1, "subdomains and trailing dots count once");
  assert.equal(opportunitySupportingDomains([{ url: "https://a.org", stance: "neutral" }, { url: "https://b.org", stance: "contradicts" }]), 0);
  assert.equal(opportunitySupportingDomains([{ url: "javascript:alert(1)" }, { url: "http://localhost/x" }, null, 3]), 0, "unsafe and malformed sources are ignored");
  assert.equal(opportunitySupportingDomains(undefined), 0);
});
