import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import { outcomeSchema, type ResearchOutcome } from "@/lib/research-core";
import type { ResearchReport } from "@/lib/research-types";
import { opportunitySchema, type WorkspaceOpportunity } from "@/lib/workspace-schema";
import { isShareToken, newShareToken, type ShareTarget } from "@/lib/share-core";

// Share a report (enhancement plan WP-26) or one opportunity in it. The owner manages links with their own session
// (row-level security); the public page reads what a link shows with the service role, by its token only.

type UserClient = Awaited<ReturnType<typeof createClient>>;
type AdminClient = ReturnType<typeof createAdminClient>;
export type SharedReport = { kind: "report"; id: string; created_at: string; completed_at: string | null; report: ResearchReport; outcome: ResearchOutcome | null };
export type SharedOpportunity = { kind: "opportunity"; id: string; completed_at: string | null; created_at: string; opportunity: WorkspaceOpportunity };
export type Shared = SharedReport | SharedOpportunity;

/**
 * Narrows a query to the links for one target. A report's links are the ones with no opportunity, so sharing one
 * opportunity never reads, renews or turns off the whole report's link, and the reverse.
 */
type Filters = { eq(column: string, value: string): Filters; is(column: string, value: null): Filters };
function forTarget<Q>(query: Q, userId: string, target: ShareTarget): Q {
  // Supabase's builder types are too deep to constrain generically; the two filters used here exist on every builder.
  const owned = (query as unknown as Filters).eq("user_id", userId);
  return (target.kind === "report" ? owned.eq("run_id", target.runId).is("opportunity_id", null) : owned.eq("opportunity_id", target.opportunityId)) as unknown as Q;
}

type ShareRow = { token: string; created_at: string; expires_at: string };
const shareColumns = "token,created_at,expires_at";
const pick = (row: ShareRow): ShareRow => ({ token: row.token, created_at: row.created_at, expires_at: row.expires_at });

/** The founder's live link to one of their reports or opportunities: not turned off and not expired. Null when there is none. */
export async function readShare(supabase: UserClient, userId: string, target: ShareTarget, now = new Date()): Promise<ShareRow | null> {
  const { data, error } = await forTarget(supabase.from("report_shares").select(shareColumns), userId, target).is("revoked_at", null).gt("expires_at", now.toISOString()).maybeSingle();
  if (error) throw new Error("SHARE_UNAVAILABLE");
  return data ? pick(data) : null;
}

export type CreateResult = ({ ok: true } & ShareRow) | { ok: false; code: "NOT_FOUND" | "SAVE_FAILED" };
/**
 * Makes a link to a completed report of the founder's own, or to one opportunity in it, or returns the live one. The
 * database refuses a link to a run that is not theirs or not completed, and to an opportunity that is not theirs or not
 * from that run; a second request racing the first gets the first's link.
 */
export async function createShare(supabase: UserClient, userId: string, target: ShareTarget, now = new Date()): Promise<CreateResult> {
  const existing = await readShare(supabase, userId, target, now);
  if (existing) return { ok: true, ...existing };
  // An opportunity link also names its report, so the database can check the report is complete and the opportunity is
  // from it. Row-level security hides other founders' opportunities, so theirs read as not found.
  let runId: string;
  if (target.kind === "report") runId = target.runId;
  else {
    const { data: opportunity, error } = await supabase.from("opportunities").select("run_id").eq("id", target.opportunityId).eq("user_id", userId).maybeSingle();
    if (error) return { ok: false, code: "SAVE_FAILED" };
    if (!opportunity?.run_id) return { ok: false, code: "NOT_FOUND" };
    runId = opportunity.run_id;
  }
  // An expired link still holds its target's one live slot until it is turned off, so retire it first. Its expiry is
  // set by the database (90 days); the founder cannot choose it.
  await forTarget(supabase.from("report_shares").update({ revoked_at: now.toISOString() }), userId, target).is("revoked_at", null).lte("expires_at", now.toISOString());
  const row = { user_id: userId, run_id: runId, token: newShareToken(), ...(target.kind === "opportunity" ? { opportunity_id: target.opportunityId } : {}) };
  const { data, error } = await supabase.from("report_shares").insert(row).select(shareColumns).single();
  if (!error && data) return { ok: true, ...pick(data) };
  if (error?.code === "23505") {
    const raced = await readShare(supabase, userId, target, now);
    if (raced) return { ok: true, ...raced };
  }
  // Row-level security (not theirs, or not completed) and a missing run both read as "not found".
  return { ok: false, code: error?.code === "42501" || error?.code === "23503" ? "NOT_FOUND" : "SAVE_FAILED" };
}

/** Turns off the founder's live link to a report or opportunity. Turning off a link that is already off changes nothing. */
export async function revokeShare(supabase: UserClient, userId: string, target: ShareTarget): Promise<boolean> {
  const { error } = await forTarget(supabase.from("report_shares").update({ revoked_at: new Date().toISOString() }), userId, target).is("revoked_at", null);
  return !error;
}

/**
 * What a live link shows, or null for an unknown, turned-off, expired or malformed token, or a run that is no longer a
 * completed report. A report link reads only the run's report, dates and outcome; an opportunity link reads only that
 * opportunity and its report's dates. Never the brief, profile, usage, sprints or the founder.
 */
export async function loadShared(token: string, admin: AdminClient = createAdminClient(), now = new Date()): Promise<Shared | null> {
  if (!isShareToken(token)) return null;
  const { data: share } = await admin.from("report_shares").select("run_id,user_id,opportunity_id").eq("token", token).is("revoked_at", null).gt("expires_at", now.toISOString()).maybeSingle();
  if (!share) return null;
  if (share.opportunity_id) {
    const [{ data: run }, { data: row }] = await Promise.all([
      admin.from("research_runs").select("id,status,created_at,completed_at").eq("id", share.run_id).eq("user_id", share.user_id).maybeSingle(),
      admin.from("opportunities").select("id,title,score,payload,run_id").eq("id", share.opportunity_id).eq("run_id", share.run_id).eq("user_id", share.user_id).maybeSingle(),
    ]);
    if (!run || run.status !== "completed" || !row) return null;
    const parsed = opportunitySchema.safeParse({ ...(row.payload as Record<string, unknown>), id: row.id, title: row.title, score: row.score, run_id: row.run_id, archived_at: null });
    return parsed.success ? { kind: "opportunity", id: row.id, created_at: run.created_at, completed_at: run.completed_at, opportunity: parsed.data } : null;
  }
  const [{ data: run }, { data: outcome }] = await Promise.all([
    admin.from("research_runs").select("id,status,report,created_at,completed_at").eq("id", share.run_id).eq("user_id", share.user_id).maybeSingle(),
    admin.from("research_stages").select("output").eq("run_id", share.run_id).eq("user_id", share.user_id).eq("stage_key", "outcome").maybeSingle(),
  ]);
  if (!run || run.status !== "completed" || !run.report) return null;
  const parsed = outcome ? outcomeSchema.safeParse(outcome.output) : null;
  return { kind: "report", id: run.id, created_at: run.created_at, completed_at: run.completed_at, report: run.report as ResearchReport, outcome: parsed?.success ? parsed.data : null };
}
