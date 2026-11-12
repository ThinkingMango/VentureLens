import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import { outcomeSchema, type ResearchOutcome } from "@/lib/research-core";
import type { ResearchReport } from "@/lib/research-types";
import { isShareToken, newShareToken } from "@/lib/share-core";

// Share a report (enhancement plan WP-26). The owner manages links with their own session (row-level security); the
// public page reads a shared report with the service role, by its token only.

type UserClient = Awaited<ReturnType<typeof createClient>>;
type AdminClient = ReturnType<typeof createAdminClient>;
export type SharedReport = { id: string; created_at: string; completed_at: string | null; report: ResearchReport; outcome: ResearchOutcome | null };

type ShareRow = { token: string; created_at: string; expires_at: string };
const shareColumns = "token,created_at,expires_at";
const pick = (row: ShareRow): ShareRow => ({ token: row.token, created_at: row.created_at, expires_at: row.expires_at });

/** The founder's live link to one of their reports: not turned off and not expired. Null when there is none. */
export async function readShare(supabase: UserClient, userId: string, runId: string, now = new Date()): Promise<ShareRow | null> {
  const { data, error } = await supabase.from("report_shares").select(shareColumns).eq("user_id", userId).eq("run_id", runId).is("revoked_at", null).gt("expires_at", now.toISOString()).maybeSingle();
  if (error) throw new Error("SHARE_UNAVAILABLE");
  return data ? pick(data) : null;
}

export type CreateResult = ({ ok: true } & ShareRow) | { ok: false; code: "NOT_FOUND" | "SAVE_FAILED" };
/**
 * Makes a link to a completed report of the founder's own, or returns the live one. The database refuses a link to a
 * run that is not theirs or not completed; a second request racing the first gets the first's link.
 */
export async function createShare(supabase: UserClient, userId: string, runId: string, now = new Date()): Promise<CreateResult> {
  const existing = await readShare(supabase, userId, runId, now);
  if (existing) return { ok: true, ...existing };
  // An expired link still holds the report's one live slot until it is turned off, so retire it first. Its expiry is
  // set by the database (90 days); the founder cannot choose it.
  await supabase.from("report_shares").update({ revoked_at: now.toISOString() }).eq("user_id", userId).eq("run_id", runId).is("revoked_at", null).lte("expires_at", now.toISOString());
  const { data, error } = await supabase.from("report_shares").insert({ user_id: userId, run_id: runId, token: newShareToken() }).select(shareColumns).single();
  if (!error && data) return { ok: true, ...pick(data) };
  if (error?.code === "23505") {
    const raced = await readShare(supabase, userId, runId, now);
    if (raced) return { ok: true, ...raced };
  }
  // Row-level security (not theirs, or not completed) and a missing run both read as "not found".
  return { ok: false, code: error?.code === "42501" || error?.code === "23503" ? "NOT_FOUND" : "SAVE_FAILED" };
}

/** Turns off the founder's live link to a report. Turning off a link that is already off changes nothing. */
export async function revokeShare(supabase: UserClient, userId: string, runId: string): Promise<boolean> {
  const { error } = await supabase.from("report_shares").update({ revoked_at: new Date().toISOString() }).eq("user_id", userId).eq("run_id", runId).is("revoked_at", null);
  return !error;
}

/**
 * The report behind a live link, or null for an unknown, turned-off, expired or malformed token, or a run that is no longer a
 * completed report. Reads only the run's report, dates and outcome: never its brief, profile, usage or the founder.
 */
export async function loadSharedReport(token: string, admin: AdminClient = createAdminClient(), now = new Date()): Promise<SharedReport | null> {
  if (!isShareToken(token)) return null;
  const { data: share } = await admin.from("report_shares").select("run_id,user_id").eq("token", token).is("revoked_at", null).gt("expires_at", now.toISOString()).maybeSingle();
  if (!share) return null;
  const [{ data: run }, { data: outcome }] = await Promise.all([
    admin.from("research_runs").select("id,status,report,created_at,completed_at").eq("id", share.run_id).eq("user_id", share.user_id).maybeSingle(),
    admin.from("research_stages").select("output").eq("run_id", share.run_id).eq("user_id", share.user_id).eq("stage_key", "outcome").maybeSingle(),
  ]);
  if (!run || run.status !== "completed" || !run.report) return null;
  const parsed = outcome ? outcomeSchema.safeParse(outcome.output) : null;
  return { id: run.id, created_at: run.created_at, completed_at: run.completed_at, report: run.report as ResearchReport, outcome: parsed?.success ? parsed.data : null };
}
