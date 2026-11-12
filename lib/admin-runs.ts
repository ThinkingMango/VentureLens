import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdministrator } from "@/lib/admin-access";
import { classificationSchema, type Evidence } from "@/lib/research-core";
import { qualityMetrics, type MetricOpportunity, type MetricRun, type MetricSource, type MetricUsage, type MetricWindow } from "@/lib/quality-metrics";
import { feedbackMetrics, runModel, type FeedbackMetrics } from "@/lib/feedback-core";
import { FOLLOW_DAYS, stepEvents, validationFunnel, type FunnelEvent, type FunnelReport, type ValidationFunnel } from "@/lib/validation-funnel";
import {
  RUNS_PAGE_SIZE, candidateDiagnostics, filterRange, providerSwitches, runListRow, stageTimeline,
  structuralBudgetBlock, structuralFailure, structuralSetup, usageStage, type RunFilters,
} from "@/lib/admin-runs-core";

// Server-side reads for the operator pages. Every loader checks the administrator claim again, reads with the service
// role, and returns structural data only (owner decision D5; see lib/admin-runs-core.ts).

type Identity = Parameters<typeof isAdministrator>[0];
function assertAdministrator(user: Identity) {
  if (!isAdministrator(user)) throw new Error("ADMIN_REQUIRED");
}
type Result<T> = PromiseLike<{ data: T[] | null; error: unknown }>;
const PAGE = 1000;
const CHUNK = 100;
function checked<T>(result: { data: T | null; error: unknown }): T | null {
  if (result.error) throw new Error("ADMIN_DATA_UNAVAILABLE");
  return result.data;
}
/** Every row of a query, page by page (PostgREST returns at most 1,000 rows per request). The query must be ordered. */
async function readAll<T>(query: (from: number, to: number) => Result<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const page = checked(await query(from, from + PAGE - 1)) ?? [];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}
/** Every row for a set of runs, querying a bounded number of run ids at a time. */
async function readForRuns<T>(ids: string[], query: (chunk: string[], from: number, to: number) => Result<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    rows.push(...await readAll<T>((from, to) => query(chunk, from, to)));
  }
  return rows;
}
const RUN_FIELDS = "id,status,stage,error_code,created_at,started_at,completed_at,retry_count,mode:configuration->brief->>discovery_mode,language:configuration->brief->>language";
type RunRecord = { id: string; status: string; stage: string; error_code: string | null; created_at: string; started_at: string | null; completed_at: string | null; retry_count: number; mode: string | null; language: string | null };

export async function listRuns(user: Identity, filters: RunFilters) {
  assertAdministrator(user);
  const client = createAdminClient();
  const { fromIso, beforeIso } = filterRange(filters);
  const offset = (filters.page - 1) * RUNS_PAGE_SIZE;
  let query = client.from("research_runs").select(RUN_FIELDS, { count: "exact" });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.errorCode) query = query.eq("error_code", filters.errorCode);
  if (fromIso) query = query.gte("created_at", fromIso);
  if (beforeIso) query = query.lt("created_at", beforeIso);
  const result = await query.order("created_at", { ascending: false }).order("id").range(offset, offset + RUNS_PAGE_SIZE - 1);
  const runs = (checked(result) ?? []) as unknown as RunRecord[];
  const ids = runs.map(run => run.id);
  const [usage, opportunities] = await Promise.all([
    readForRuns<MetricUsage>(ids, (chunk, from, to) => client.from("research_usage").select("run_id,status,estimated_usd,reserved_usd").in("run_id", chunk).order("id").range(from, to)),
    readForRuns<{ run_id: string }>(ids, (chunk, from, to) => client.from("opportunities").select("run_id").in("run_id", chunk).order("id").range(from, to)),
  ]);
  const counts = new Map<string, number>();
  for (const row of opportunities) counts.set(row.run_id, (counts.get(row.run_id) ?? 0) + 1);
  return { rows: runs.map(run => runListRow(run, usage, counts.get(run.id) ?? 0)), total: result.count ?? runs.length, pageSize: RUNS_PAGE_SIZE };
}

export async function runInspection(user: Identity, id: string) {
  assertAdministrator(user);
  const client = createAdminClient();
  const run = checked(await client.from("research_runs")
    .select(`${RUN_FIELDS},user_id,updated_at,budget_usd,quota_released,workflow_id`).eq("id", id).maybeSingle()) as (RunRecord & { user_id: string; updated_at: string; budget_usd: number | string | null; quota_released: boolean; workflow_id: string | null }) | null;
  if (!run) return null;
  const [stages, usage, evidence, opportunities] = await Promise.all([
    readAll<{ stage_key: string; created_at: string; output: unknown }>((from, to) => client.from("research_stages").select("stage_key,created_at,output").eq("run_id", id).order("stage_key").range(from, to)),
    readAll<{ stage_key: string; provider: string; model: string; status: string; reserved_usd: number | string; estimated_usd: number | string | null; input_tokens: number; output_tokens: number; search_requests: number; created_at: string }>((from, to) =>
      client.from("research_usage").select("stage_key,provider,model,status,reserved_usd,estimated_usd,input_tokens,output_tokens,search_requests,created_at").eq("run_id", id).order("created_at").order("id").range(from, to)),
    readAll<Evidence>((from, to) => client.from("research_evidence").select("source_key,candidate_id,url,title,excerpt,retrieved_at,published_at").eq("run_id", id).order("source_key").range(from, to)),
    readAll<{ id: string }>((from, to) => client.from("opportunities").select("id").eq("run_id", id).order("id").range(from, to)),
  ]);
  const stage = (key: string) => stages.find(row => row.stage_key === key)?.output;
  // Candidate keys only: discovery's titles, buyers, pains and queries are written from the brief.
  const discovered = (stage("discovery") as { candidates?: { key?: unknown }[] } | undefined)?.candidates ?? [];
  const keys = discovered.map(candidate => candidate?.key).filter((key): key is string => typeof key === "string" && /^c\d{1,2}$/.test(key));
  const retrieval = Object.fromEntries(stages.filter(row => row.stage_key.startsWith("retrieval:")).map(row => [row.stage_key.slice("retrieval:".length), row.output as { skipped?: unknown }]));
  const classified = classificationSchema.safeParse(stage("classification"));
  const settled = usage.map(row => ({ run_id: id, status: row.status, estimated_usd: row.estimated_usd, reserved_usd: row.reserved_usd }));
  return {
    run: {
      ...runListRow(run, settled, opportunities.length),
      user_id: run.user_id, started_at: run.started_at, completed_at: run.completed_at, updated_at: run.updated_at,
      budget_usd: run.budget_usd === null ? null : Number(run.budget_usd), quota_released: run.quota_released, workflow_id: run.workflow_id,
    },
    setup: structuralSetup(stage("setup")),
    failure: stage("failure") ? structuralFailure(stage("failure")) : null,
    budgetBlock: stage("budget_block") ? structuralBudgetBlock(stage("budget_block")) : null,
    timeline: stageTimeline(stages),
    usage: usage.map(row => ({
      stage: usageStage(row.stage_key), provider: row.provider, model: row.model, status: row.status,
      reservedUsd: Number(row.reserved_usd), committedUsd: Number(row.status === "completed" ? row.estimated_usd ?? 0 : row.reserved_usd),
      inputTokens: row.input_tokens, outputTokens: row.output_tokens, searchRequests: row.search_requests, created_at: row.created_at,
    })),
    switches: providerSwitches(usage),
    candidates: candidateDiagnostics({ keys, retrieval, evidence, classifications: classified.success ? classified.data.items : null }),
  };
}
export type RunInspection = NonNullable<Awaited<ReturnType<typeof runInspection>>>;
export type RunList = Awaited<ReturnType<typeof listRuns>>;

export async function qualityReport(user: Identity, days: MetricWindow, now = new Date()) {
  assertAdministrator(user);
  const client = createAdminClient();
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const runs = await readAll<Omit<MetricRun, "preflight_blocked">>((from, to) =>
    client.from("research_runs").select("id,status,error_code,started_at,completed_at").gte("created_at", since).order("created_at").order("id").range(from, to));
  const ids = runs.map(run => run.id);
  const [blocks, usage, sources, opportunities, detachedUsage] = await Promise.all([
    readForRuns<{ run_id: string; kind: string | null }>(ids, (chunk, from, to) => client.from("research_stages").select("run_id,kind:output->>kind").eq("stage_key", "budget_block").in("run_id", chunk).order("run_id").range(from, to)),
    readForRuns<MetricUsage>(ids, (chunk, from, to) => client.from("research_usage").select("run_id,status,estimated_usd,reserved_usd").in("run_id", chunk).order("id").range(from, to)),
    readForRuns<MetricSource>(ids, (chunk, from, to) => client.from("research_evidence").select("reliability:classification->>reliability").in("run_id", chunk).not("classification", "is", null).order("id").range(from, to)),
    readForRuns<MetricOpportunity>(ids, (chunk, from, to) => client.from("opportunities").select("run_id,evidence:payload->evidence").in("run_id", chunk).order("id").range(from, to)),
    // Usage of runs founders deleted in the window (WP-12, D6): no run or founder, still part of what was spent.
    readAll<MetricUsage>((from, to) => client.from("research_usage").select("run_id,status,estimated_usd,reserved_usd").is("run_id", null).gte("created_at", since).order("id").range(from, to)),
  ]);
  const preflight = new Set(blocks.filter(block => block.kind === "estimate").map(block => block.run_id));
  return {
    days, since,
    metrics: qualityMetrics({ runs: runs.map(run => ({ ...run, preflight_blocked: preflight.has(run.id) })), usage, sources, opportunities, detachedUsage }),
    feedback: await feedbackReport(client, since),
    funnel: await funnelReport(client, days, now),
  };
}

/**
 * The validation funnel (WP-15) from product events. Reads every founder's completed-run events up to now, to find each
 * founder's first report, and the step events since the earliest first report the funnel can use (the action-rate
 * cohort starts `days + 30` days ago). Null when events cannot be read, so the rest of the page still loads.
 */
async function funnelReport(client: ReturnType<typeof createAdminClient>, days: MetricWindow, now: Date): Promise<ValidationFunnel | null> {
  try {
    const earliest = new Date(now.getTime() - (days + FOLLOW_DAYS) * 86_400_000).toISOString();
    const [reports, events] = await Promise.all([
      readAll<FunnelReport>((from, to) => client.from("product_events").select("user_id,created_at")
        .eq("event", "run_finished").eq("props->>status", "completed").not("user_id", "is", null)
        .lte("created_at", now.toISOString()).order("created_at").order("id").range(from, to)),
      readAll<FunnelEvent>((from, to) => client.from("product_events").select("user_id,event,created_at")
        .in("event", Object.values(stepEvents)).not("user_id", "is", null)
        .gte("created_at", earliest).lte("created_at", now.toISOString()).order("created_at").order("id").range(from, to)),
    ]);
    return validationFunnel({ reports, events, days, now });
  } catch {
    return null;
  }
}

/**
 * Report feedback left in the window (WP-13): flags by reason, the domains of flagged sources, and ratings by discovery
 * mode and by the model that wrote most of the run. Null when feedback cannot be read (for example before the
 * report_feedback migration is applied), so the rest of the page still loads.
 */
async function feedbackReport(client: ReturnType<typeof createAdminClient>, since: string): Promise<FeedbackMetrics | null> {
  try {
    const rows = await readAll<{ run_id: string; opportunity_id: string | null; target: string; target_key: string; reason: string | null; rating: number | null }>((from, to) =>
      client.from("report_feedback").select("run_id,opportunity_id,target,target_key,reason,rating").gte("created_at", since).order("created_at").order("id").range(from, to));
    const flags = rows.filter(row => row.target !== "report");
    const ratings = rows.filter(row => row.target === "report" && typeof row.rating === "number");
    const flaggedOpportunities = [...new Set(flags.filter(row => row.target === "source" && row.opportunity_id).map(row => row.opportunity_id as string))];
    const ratedRuns = [...new Set(ratings.map(row => row.run_id))];
    const [evidence, runs, usage] = await Promise.all([
      readForRuns<{ id: string; evidence: unknown }>(flaggedOpportunities, (chunk, from, to) => client.from("opportunities").select("id,evidence:payload->evidence").in("id", chunk).order("id").range(from, to)),
      readForRuns<{ id: string; mode: string | null }>(ratedRuns, (chunk, from, to) => client.from("research_runs").select("id,mode:configuration->brief->>discovery_mode").in("id", chunk).order("id").range(from, to)),
      readForRuns<{ run_id: string; provider: string; model: string; status: string; output_tokens: number }>(ratedRuns, (chunk, from, to) =>
        client.from("research_usage").select("run_id,provider,model,status,output_tokens").in("run_id", chunk).order("id").range(from, to)),
    ]);
    const evidenceOf = new Map(evidence.map(row => [row.id, row.evidence]));
    const modeOf = new Map(runs.map(row => [row.id, row.mode]));
    return feedbackMetrics({
      flags: flags.map(row => ({ target: row.target, target_key: row.target_key, reason: row.reason, evidence: row.opportunity_id ? evidenceOf.get(row.opportunity_id) : undefined })),
      ratings: ratings.map(row => ({ rating: row.rating as number, mode: modeOf.get(row.run_id) ?? null, model: runModel(usage.filter(u => u.run_id === row.run_id)) })),
    });
  } catch {
    return null;
  }
}
export type QualityReport = Awaited<ReturnType<typeof qualityReport>>;
