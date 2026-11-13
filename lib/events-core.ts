import { z } from "zod";
import { signupSources } from "./signup-source.ts";

// Product events (spec WP-01 §4). Every event has a strict schema, so a caller cannot attach free text, names, emails,
// brief or profile content by accident: only codes, counts and fixed choices are accepted. An event that does not match
// its schema is dropped, never stored in part.

/** Largest props object stored, in bytes of JSON; the database enforces the same bound. */
export const EVENT_PROPS_MAX_BYTES = 8192;

const mode = z.enum(["founder", "market", "combined", "verify"]);
const language = z.enum(["en", "zh-Hans", "zh-Hant"]);
const errorCode = z.string().regex(/^[A-Z][A-Z0-9_]{0,39}$/);
const count = z.number().int().min(0).max(1000);

export const eventSchemas = {
  run_started: z.strictObject({ mode, language }),
  run_finished: z.strictObject({ status: z.enum(["completed", "failed"]), error_code: errorCode.nullable(), opportunities: count, mode: mode.optional() }),
  verify_started: z.strictObject({}),
  outcome_viewed: z.strictObject({ reasonCounts: z.record(z.string().regex(/^[A-Z][A-Z_]{0,39}$/), count) }),
  report_exported: z.strictObject({ format: z.enum(["markdown", "pdf"]) }),
  sprint_created: z.strictObject({ length: z.union([z.literal(7), z.literal(14), z.literal(30)]) }),
  // Where the tick happened (WP-15): a sprint task, or one of an opportunity's fixed first steps outside a sprint.
  // Events recorded before WP-15 carry no origin; they were all sprint tasks.
  task_completed: z.strictObject({ origin: z.enum(["sprint", "checklist"]).optional() }),
  sprint_decided: z.strictObject({ decision: z.enum(["keep", "park", "kill"]) }),
  // Source flags (WP-13) are recorded under the same event, with the target that was flagged.
  claim_flagged: z.strictObject({ reason: z.enum(["wrong", "outdated", "irrelevant", "broken_link", "other"]), target: z.enum(["claim", "source"]).optional() }),
  report_rated: z.strictObject({ rating: z.number().int().min(1).max(5) }),
  starter_profile_used: z.strictObject({ id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/) }),
  // Validation funnel (WP-15). A founder opened one of their opportunities; recorded at most once per founder per UTC
  // day (trackDaily in lib/events.ts), so it carries no opportunity id.
  opportunity_viewed: z.strictObject({}),
  // Recorded from WP-20 (first-hand evidence) and WP-18 (kits); the schemas exist now so the funnel can count them.
  evidence_logged: z.strictObject({ kind: z.enum(["interview", "signup", "loi", "deposit", "payment", "pilot", "rejection"]) }),
  kit_generated: z.strictObject({ kind: z.enum(["buyers", "interview", "offer"]) }),
  // WP-17: a weekly progress email was sent (or logged, in a dry run, which records nothing).
  weekly_email_sent: z.strictObject({}),
  // WP-26: a founder made or turned off a read-only link to a report. Views of shared pages are not recorded.
  // `target` since single-opportunity links; earlier events have none and were all whole-report links.
  report_shared: z.strictObject({ target: z.enum(["report", "opportunity"]).optional() }),
  report_unshared: z.strictObject({ target: z.enum(["report", "opportunity"]).optional() }),
  // A new account signed in for the first time (lib/signup-source.ts): which call to action it came from. Recorded once
  // per account (trackOnce in lib/events.ts), so it carries nothing else.
  signup_completed: z.strictObject({ source: z.enum([...signupSources, "unknown"]) }),
} as const;

/** Events recorded at most once per founder, ever (see trackOnce). */
export const onceEvents = ["signup_completed"] as const satisfies readonly ProductEvent[];

/** Events recorded at most once per founder per UTC day (see trackDaily). */
export const dailyEvents = ["opportunity_viewed"] as const satisfies readonly ProductEvent[];

/** Start of the UTC day that contains `now`, as an ISO timestamp. */
export function utcDayStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export type ProductEvent = keyof typeof eventSchemas;
export type EventProps<E extends ProductEvent> = z.input<(typeof eventSchemas)[E]>;

/** Validated props for an event, or null when the event is unknown, its props do not match, or they are too large. */
export function eventProps(event: string, props: unknown): Record<string, unknown> | null {
  if (!Object.hasOwn(eventSchemas, event)) return null;
  const parsed = eventSchemas[event as ProductEvent].safeParse(props ?? {});
  if (!parsed.success) return null;
  return Buffer.byteLength(JSON.stringify(parsed.data)) <= EVENT_PROPS_MAX_BYTES ? parsed.data : null;
}
