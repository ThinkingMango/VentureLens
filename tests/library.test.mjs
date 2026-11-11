import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { activeFilterCount, canDeleteRun, defaultFilters, deleteConfirmed, filterOpportunities, isArchived, runInfo, runOptions, scoreRange, unarchived } from "../lib/library-core.ts";
import { scoreBand } from "../lib/report-presentation.ts";
import { qualityMetrics } from "../lib/quality-metrics.ts";

// Library (WP-12): the filter helpers behind the results and saved lists, the delete-run guards, and the admin spend
// that keeps counting deleted runs' usage (decision D6).

const op = (id, extra = {}) => ({ id, title: `Idea ${id}`, category: "Healthcare", description: "", buyer: "Clinic owners", pain: "", score: 55, confidence: "limited", revenue: "", cost: "", risk: "", scores: [1, 2, 3, 4, 5], icon: "workflow", run_id: "r1", archived_at: null, ...extra });
const runs = runInfo(
  [{ id: "r1", project_id: "p1", created_at: "2026-11-01T00:00:00Z" }, { id: "r2", project_id: "p2", created_at: "2026-11-05T00:00:00Z" }, { id: "r3", project_id: "gone", created_at: "2026-11-06T00:00:00Z" }],
  [{ id: "p1", name: "Clinic scan", discovery_mode: "market" }, { id: "p2", name: "My idea", discovery_mode: "verify" }],
);
const items = [
  op("a", { score: 70, confidence: "moderate" }),
  op("b", { score: 64 }),
  op("c", { score: 50, archived_at: "2026-11-10T00:00:00Z" }),
  op("d", { score: 34, run_id: "r2", title: "Dental reminders", buyer: "Dentists" }),
  op("e", { score: 49, run_id: undefined }),
];
const ids = (list) => list.map((item) => item.id).join("");
const filter = (changes = {}, context = {}) => ids(filterOpportunities(items, { ...defaultFilters, ...changes }, { saved: [], savedOnly: false, runs, ...context }));

test("archived opportunities are hidden by default and come back with Show archived", () => {
  assert.equal(filter(), "abde");
  assert.equal(filter({ showArchived: true }), "abcde");
  assert.equal(ids(unarchived(items)), "abde", "the dashboard never lists archived ones");
  assert.equal(items.filter(isArchived).length, 1);
});

test("filters combine: search, confidence, score range, mode and run", () => {
  assert.equal(filter({ query: "  DENTISTS " }), "d", "search matches buyer, case-insensitively");
  assert.equal(filter({ query: "healthcare" }), "abde", "and category");
  assert.equal(filter({ confidence: "moderate" }), "a");
  assert.equal(filter({ confidence: "limited" }), "bde");
  assert.equal(filter({ score: "strong" }), "a");
  assert.equal(filter({ score: "promising" }), "b", "64 is promising; 50 is archived");
  assert.equal(filter({ score: "promising", showArchived: true }), "bc", "50 is the bottom of promising");
  assert.equal(filter({ score: "mixed" }), "e", "49 is mixed");
  assert.equal(filter({ score: "weak" }), "d", "34 is weak");
  assert.equal(filter({ mode: "market" }), "ab", "mode comes from the run's brief");
  assert.equal(filter({ mode: "verify" }), "d");
  assert.equal(filter({ mode: "combined" }), "", "an opportunity without a known run matches no mode");
  assert.equal(filter({ run: "r2" }), "d");
  assert.equal(filter({ run: "r1", score: "strong", confidence: "moderate" }), "a");
  assert.equal(filter({}, { savedOnly: true, saved: ["b", "c", "zz"] }), "b", "saved only, still without archived");
});

test("score ranges match the score bands at every boundary", () => {
  for (let score = 0; score <= 100; score++) {
    const key = scoreBand(score).key;
    const range = scoreRange(key);
    assert.ok(score >= range.min && score <= range.max, `${score} lies in ${key}`);
  }
  assert.deepEqual([scoreRange("strong"), scoreRange("weak")], [{ min: 65, max: 100 }, { min: 0, max: 34 }]);
});

test("run options list the runs behind the opportunities, newest first; filters count what differs", () => {
  assert.deepEqual(runOptions(items, runs).map((run) => `${run.id}:${run.name}:${run.mode}`), ["r2:My idea:verify", "r1:Clinic scan:market"]);
  assert.equal(runs.get("r3").mode, "combined", "a run whose brief is gone reads as combined");
  assert.equal(activeFilterCount(defaultFilters), 0);
  assert.equal(activeFilterCount({ ...defaultFilters, query: "x" }), 0, "search is not a filter");
  assert.equal(activeFilterCount({ ...defaultFilters, showArchived: true, run: "r1", score: "weak" }), 3);
});

test("deleting needs the typed word and a finished run", () => {
  assert.ok(deleteConfirmed("DELETE") && deleteConfirmed(" delete ") && !deleteConfirmed("DELET") && !deleteConfirmed(""));
  assert.deepEqual(["pending", "running", "completed", "failed"].map(canDeleteRun), [false, false, true, true]);
  const route = readFileSync(new URL("../app/api/research/[id]/route.ts", import.meta.url), "utf8");
  assert.match(route, /confirm !== "DELETE"/, "the API also requires the confirmation word");
  assert.match(route, /delete_research_run/, "and deletes only through the guarded function");
});

test("admin spend still counts deleted runs' usage, without crediting it to any run", () => {
  const runs = [{ id: "r1", status: "completed", error_code: null, started_at: "2026-11-01T00:00:00Z", completed_at: "2026-11-01T00:05:00Z", preflight_blocked: false }];
  const usage = [{ run_id: "r1", status: "completed", estimated_usd: 0.1, reserved_usd: 0.2 }];
  const detachedUsage = [{ run_id: null, status: "completed", estimated_usd: 0.05, reserved_usd: 0.1 }, { run_id: null, status: "reserved", estimated_usd: null, reserved_usd: 0.02 }];
  const base = qualityMetrics({ runs, usage, sources: [], opportunities: [] });
  const withDeleted = qualityMetrics({ runs, usage, sources: [], opportunities: [], detachedUsage });
  assert.equal(base.cost.deletedRunsUsd, 0);
  assert.equal(Number(withDeleted.cost.totalUsd.toFixed(4)), 0.17, "total includes deleted runs' spend");
  assert.equal(Number(withDeleted.cost.deletedRunsUsd.toFixed(4)), 0.07);
  assert.equal(withDeleted.cost.meanCompletedRunUsd, base.cost.meanCompletedRunUsd, "a run's own cost is unchanged");
  assert.equal(withDeleted.cost.uncertainCalls, 1);
});
