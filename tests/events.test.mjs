import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { eventProps, eventSchemas, EVENT_PROPS_MAX_BYTES } from "../lib/events-core.ts";

test("every event the spec names has a schema, and valid props pass unchanged", () => {
  const valid = {
    run_started: { mode: "combined", language: "en" },
    run_finished: { status: "failed", error_code: "INSUFFICIENT_EVIDENCE", opportunities: 0, mode: "founder" },
    verify_started: {},
    outcome_viewed: { reasonCounts: { VENDOR_ONLY: 3, SINGLE_DOMAIN: 2 } },
    report_exported: { format: "markdown" },
    sprint_created: { length: 14 },
    task_completed: {},
    sprint_decided: { decision: "park" },
    claim_flagged: { reason: "outdated" },
    report_rated: { rating: 5 },
    starter_profile_used: { id: "consultant-leaving-corporate" },
  };
  assert.deepEqual(Object.keys(eventSchemas).sort(), Object.keys(valid).sort());
  for (const [event, props] of Object.entries(valid)) assert.deepEqual(eventProps(event, props), props, event);
  assert.deepEqual(eventProps("task_completed", undefined), {}, "events without props accept none");
});

test("events never carry free text or personal data: unknown events and extra or malformed props are dropped", () => {
  assert.equal(eventProps("page_viewed", {}), null, "unknown event");
  assert.equal(eventProps("toString", {}), null, "inherited property names are not events");
  assert.equal(eventProps("run_started", { mode: "combined", language: "en", email: "a@b.co" }), null, "extra field");
  assert.equal(eventProps("report_rated", { rating: 4, comment: "Loved it" }), null, "comments stay out of events");
  assert.equal(eventProps("run_started", { mode: "combined", language: "fr" }), null, "unsupported language");
  assert.equal(eventProps("run_finished", { status: "failed", error_code: "the provider said: rate limited", opportunities: 0 }), null, "error codes, not messages");
  assert.equal(eventProps("report_rated", { rating: 6 }), null);
  assert.equal(eventProps("sprint_created", { length: 10 }), null);
  assert.equal(eventProps("starter_profile_used", { id: "Jane Doe" }), null, "template ids only");
  assert.equal(eventProps("outcome_viewed", { reasonCounts: { "a reason": 1 } }), null, "reason keys are codes");
});

test("props are capped at 8 KB, matching the database check", () => {
  const reasonCounts = Object.fromEntries(Array.from({ length: 600 }, (_, i) => [`REASON_${i}`, 1]));
  assert.ok(Buffer.byteLength(JSON.stringify({ reasonCounts })) > EVENT_PROPS_MAX_BYTES);
  assert.equal(eventProps("outcome_viewed", { reasonCounts }), null);
  const migration = readFileSync(new URL("../supabase/migrations/20261110120000_product_events.sql", import.meta.url), "utf8");
  assert.match(migration, new RegExp(`octet_length\\(props::text\\) <= ${EVENT_PROPS_MAX_BYTES}`));
});

test("the server helper never throws and validates before writing", () => {
  const source = readFileSync(new URL("../lib/events.ts", import.meta.url), "utf8");
  assert.match(source, /^import "server-only";/);
  const body = source.slice(source.indexOf("export async function track"));
  assert.match(body, /^\s*try \{/m, "the whole body is guarded");
  assert.ok(body.indexOf("eventProps(") < body.indexOf(".insert("), "validation runs before the insert");
  assert.doesNotMatch(body, /\bthrow\b/);
});
