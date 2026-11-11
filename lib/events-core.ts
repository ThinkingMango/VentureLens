import { z } from "zod";

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
  task_completed: z.strictObject({}),
  sprint_decided: z.strictObject({ decision: z.enum(["keep", "park", "kill"]) }),
  // Source flags (WP-13) are recorded under the same event, with the target that was flagged.
  claim_flagged: z.strictObject({ reason: z.enum(["wrong", "outdated", "irrelevant", "broken_link", "other"]), target: z.enum(["claim", "source"]).optional() }),
  report_rated: z.strictObject({ rating: z.number().int().min(1).max(5) }),
  starter_profile_used: z.strictObject({ id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/) }),
} as const;

export type ProductEvent = keyof typeof eventSchemas;
export type EventProps<E extends ProductEvent> = z.input<(typeof eventSchemas)[E]>;

/** Validated props for an event, or null when the event is unknown, its props do not match, or they are too large. */
export function eventProps(event: string, props: unknown): Record<string, unknown> | null {
  if (!Object.hasOwn(eventSchemas, event)) return null;
  const parsed = eventSchemas[event as ProductEvent].safeParse(props ?? {});
  if (!parsed.success) return null;
  return Buffer.byteLength(JSON.stringify(parsed.data)) <= EVENT_PROPS_MAX_BYTES ? parsed.data : null;
}
