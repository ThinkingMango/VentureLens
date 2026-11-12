// Stopping runs and stale-run cleanup: the recovery rule shared by the run page, the pre-start check and the scheduled
// job; the cron secret check; and that a stopped run sends no email.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { interruptionFor, DISPATCH_GRACE_MS, MAX_ACTIVE_MS, researchErrors } from "../lib/research-core.ts";
import { notificationOutcome } from "../lib/notify-core.ts";
import { cronAuthorized } from "../lib/cron-auth.ts";

const now = Date.parse("2026-11-11T12:00:00Z");
const ago = ms => new Date(now - ms).toISOString();
const run = (over = {}) => ({ status: "running", workflow_id: "wrun_1", updated_at: ago(60_000), created_at: ago(60_000), started_at: ago(60_000), ...over });

test("only runs that can no longer finish are ended", () => {
  assert.equal(interruptionFor(run(), "running", now), null, "a live workflow keeps its run");
  assert.equal(interruptionFor(run(), null, now), null, "an unreadable workflow status alone never ends a run");
  for (const status of ["failed", "cancelled", "completed"])
    assert.equal(interruptionFor(run(), status, now), "WORKFLOW_INTERRUPTED", `workflow ${status}`);
  assert.equal(interruptionFor(run({ started_at: ago(MAX_ACTIVE_MS + 1) }), "running", now), "WORKFLOW_INTERRUPTED", "past the age limit");
  assert.equal(interruptionFor(run({ started_at: ago(MAX_ACTIVE_MS + 1) }), null, now), "WORKFLOW_INTERRUPTED", "past the age limit, status unreadable");
  assert.equal(interruptionFor(run({ started_at: null, created_at: ago(MAX_ACTIVE_MS + 1) }), "running", now), "WORKFLOW_INTERRUPTED", "falls back to created_at");
  assert.equal(interruptionFor(run({ status: "pending", workflow_id: null, updated_at: ago(DISPATCH_GRACE_MS - 1) }), null, now), null, "still within the dispatch grace");
  assert.equal(interruptionFor(run({ status: "pending", workflow_id: null, updated_at: ago(DISPATCH_GRACE_MS + 1) }), null, now), "DISPATCH_FAILED");
  for (const status of ["completed", "failed"]) assert.equal(interruptionFor(run({ status, started_at: ago(MAX_ACTIVE_MS * 2) }), "failed", now), null, `a ${status} run is left alone`);
});

test("a stopped run has its own message and sends no email", () => {
  assert.match(researchErrors.CANCELLED, /stopped/);
  assert.equal(notificationOutcome({ status: "failed", error_code: "CANCELLED", quota_released: true, mode: "combined", opportunities: 0 }), null);
  assert.ok(notificationOutcome({ status: "failed", error_code: "INVALID_OUTPUT", quota_released: true, mode: "combined", opportunities: 0 }), "other failures still email");
});

test("the cleanup endpoint accepts only the deployment's cron secret", () => {
  assert.equal(cronAuthorized("Bearer s3cret", "s3cret"), true);
  assert.equal(cronAuthorized("Bearer wrong!", "s3cret"), false);
  assert.equal(cronAuthorized(null, "s3cret"), false);
  assert.equal(cronAuthorized("Bearer ", ""), false, "no secret configured: nothing passes");
  assert.equal(cronAuthorized("Bearer undefined", undefined), false);
  const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const cron = vercel.crons.find(c => c.path === "/api/cron/stale-runs");
  assert.ok(cron, "scheduled in vercel.json");
  assert.match(cron.schedule, /^\d+ \d+ \* \* \*$/, "at most daily, so every Vercel plan accepts it");
});
