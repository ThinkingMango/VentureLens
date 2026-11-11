import "server-only";
import { start, getRun } from "workflow/api";
import { HookConflictError, WorkflowWorldError } from "workflow/errors";
import { researchWorkflow } from "@/workflows/research";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import type { ResearchDetail, ResearchModelInfo } from "@/lib/research-types";
import { researchProviderSettings } from "@/lib/provider-settings";
import { providerPlan } from "@/lib/provider-settings-core";
import { selectedModel } from "@/lib/research-models";
import { QWEN_PROVIDER } from "@/lib/qwen-core";
import { GEMINI_PROVIDER } from "@/lib/research-fallback-core";
import { outcomeSchema } from "@/lib/research-core";
import { PROGRESS_SOURCES, estimateMinutes, progressSource, type RunProgress } from "@/lib/research-progress";

export async function dispatchResearch(id: string, userId: string) {
  const client = createAdminClient();
  const { data, error } = await client.from("research_runs").select("status,workflow_id,retry_count").eq("id", id).eq("user_id", userId).single();
  if (error || !data) throw new Error("WORKFLOW_INTERRUPTED");
  if (data.status !== "pending" || data.workflow_id) return;
  let workflowId: string;
  try {
    workflowId = await startResearchWorkflow(id, userId, data.retry_count);
  } catch (error) {
    if (HookConflictError.is(error) && error.conflictingRunId) {
      workflowId = error.conflictingRunId;
    } else {
      // Surface the SDK's reason in runtime logs; the run itself only records DISPATCH_FAILED.
      const failure = error as { name?: string; message?: string; code?: string; cause?: { message?: string } };
      console.error("[research] workflow dispatch failed", { run: id, retry: data.retry_count, name: failure?.name, code: failure?.code, message: failure?.message, cause: failure?.cause?.message });
      const { error: updateError } = await client.from("research_runs").update({ status: "failed", error_code: "DISPATCH_FAILED", completed_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId).eq("status", "pending").is("workflow_id", null);
      if (updateError) throw new Error("WORKFLOW_INTERRUPTED");
      throw new Error("DISPATCH_FAILED");
    }
  }
  const linked = await client.from("research_runs").update({ workflow_id: workflowId }).eq("id", id).eq("user_id", userId).eq("status", "pending").is("workflow_id", null);
  if (linked.error) throw new Error("WORKFLOW_INTERRUPTED");
}
// A start hook makes dispatch idempotent per attempt, but `start({ hook })` is opt-in on the Vercel World
// (WORKFLOW_VERCEL_EXPERIMENTAL_START_HOOK=1) and throws, creating no run, where the deployment does not support it.
// Without the hook a duplicate dispatch can create a second workflow, but initializeResearch claims the run with a
// conditional update, so only one workflow ever executes it; the other exits before any provider request.
export function startHookUnsupported(error: unknown) {
  return WorkflowWorldError.is(error) && ["WORLD_CONTRACT_ERROR", "START_HOOK_ADMISSION_DISABLED"].includes(String(error.code));
}
async function startResearchWorkflow(id: string, userId: string, retryCount: number) {
  try {
    const run = await start(researchWorkflow, [id, userId], { hook: { token: `research:${id}:${retryCount}`, experimental_minRetention: "30 days" } });
    return run.runId;
  } catch (error) {
    if (!startHookUnsupported(error)) throw error;
    console.warn("[research] start hooks unavailable on this deployment; starting without one", { run: id, message: (error as Error).message });
    const run = await start(researchWorkflow, [id, userId]);
    return run.runId;
  }
}
export async function researchDetail(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, id: string): Promise<ResearchDetail | null> {
  const result = await supabase.from("research_runs").select("id,status,stage,error_code,retry_count,configuration,report,created_at,completed_at,workflow_id,updated_at,budget_usd,quota_released").eq("id", id).eq("user_id", userId).maybeSingle();
  if (result.error) throw new Error("WORKFLOW_INTERRUPTED");
  if (!result.data) return null;
  const run = result.data;
  let interrupted: string | null = null;
  if (["pending", "running"].includes(run.status)) {
    if (run.workflow_id) {
      try {
        const status = await getRun(run.workflow_id).status;
        if (["failed", "cancelled", "completed"].includes(status)) interrupted = "WORKFLOW_INTERRUPTED";
      } catch {
        // Observability outages must not mark a still-running durable job as failed.
      }
    } else if (Date.now() - new Date(run.updated_at).getTime() > 300000) interrupted = "DISPATCH_FAILED";
    if (interrupted) {
      const completedAt = new Date().toISOString();
      const { data: recovered, error } = await createAdminClient().from("research_runs").update({ status: "failed", error_code: interrupted, completed_at: completedAt }).eq("id", id).eq("user_id", userId).eq("status", run.status).eq("updated_at", run.updated_at).select("id,quota_released");
      if (error) throw new Error("WORKFLOW_INTERRUPTED");
      // The refund trigger decides quota_released in the same update, so read it back rather than assume it.
      if (recovered?.length) { run.status = "failed"; run.error_code = interrupted; run.completed_at = completedAt; run.quota_released = recovered[0].quota_released; }
    }
  }
  const [steps, usage, budgetBlock, setup, outcomeRow] = await Promise.all([
    supabase.from("research_stages").select("stage_key,created_at").eq("run_id", id).eq("user_id", userId).order("created_at"),
    supabase.from("research_usage").select("status,input_tokens,output_tokens,search_requests,estimated_usd,reserved_usd,provider,model").eq("run_id", id).eq("user_id", userId),
    supabase.from("research_stages").select("output").eq("run_id", id).eq("user_id", userId).eq("stage_key", "budget_block").maybeSingle(),
    supabase.from("research_stages").select("output").eq("run_id", id).eq("user_id", userId).eq("stage_key", "setup").maybeSingle(),
    supabase.from("research_stages").select("output").eq("run_id", id).eq("user_id", userId).eq("stage_key", "outcome").maybeSingle(),
  ]);
  if (steps.error || usage.error || budgetBlock.error || setup.error || outcomeRow.error) throw new Error("WORKFLOW_INTERRUPTED");
  // Runs from before outcomes were recorded have none; an outcome that does not match the schema is not shown.
  const parsedOutcome = outcomeRow.data ? outcomeSchema.safeParse(outcomeRow.data.output) : null;
  const model = await describeModel(setup.data?.output, usage.data ?? []);
  const totals = (usage.data ?? []).reduce((sum, u) => ({
    estimated_usd: sum.estimated_usd + (u.status === "completed" ? Number(u.estimated_usd) : 0),
    committed_usd: sum.committed_usd + Number(u.status === "completed" ? u.estimated_usd : u.reserved_usd),
    uncertain_calls: sum.uncertain_calls + Number(u.status !== "completed"),
    input_tokens: sum.input_tokens + u.input_tokens, output_tokens: sum.output_tokens + u.output_tokens, search_requests: sum.search_requests + u.search_requests,
  }), { estimated_usd: 0, committed_usd: 0, uncertain_calls: 0, input_tokens: 0, output_tokens: 0, search_requests: 0 });
  const blocked = budgetBlock.data?.output;
  const budget_block = run.status === "failed" && run.error_code === "BUDGET_EXCEEDED" && blocked && typeof blocked.model === "string" && Number.isFinite(blocked.required_usd)
    ? { model: blocked.model, required_usd: Number(blocked.required_usd), remaining_usd: Math.max(0, Number(run.budget_usd) - totals.committed_usd), kind: blocked.kind === "estimate" ? "estimate" as const : "reservation" as const }
    : undefined;
  const progress = ["pending", "running"].includes(run.status) ? await runProgress(supabase, userId, id, run.configuration?.brief?.discovery_mode) : undefined;
  return { ...(progress ? { progress } : {}), id: run.id, status: run.status, stage: run.stage, model, error_code: run.error_code, retry_count: run.retry_count, quota_released: run.quota_released, configuration: { brief: run.configuration.brief }, report: run.report, outcome: parsedOutcome?.success ? parsedOutcome.data : null, created_at: run.created_at, completed_at: run.completed_at, steps: steps.data ?? [], usage: { ...totals, budget_usd: Number(run.budget_usd) }, ...(budget_block ? { budget_block } : {}) };
}

/**
 * Live progress for a run still working (WP-08): how many candidates discovery chose, the sources saved so far (title
 * and domain only), and a time estimate from recent runs of the same mode. Any part that cannot be read is left out;
 * progress never stops the page from loading.
 */
async function runProgress(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, id: string, mode: unknown): Promise<RunProgress> {
  const [discovery, sources, minutes] = await Promise.all([
    supabase.from("research_stages").select("candidates:output->candidates").eq("run_id", id).eq("user_id", userId).eq("stage_key", "discovery").maybeSingle(),
    supabase.from("research_evidence").select("title,url", { count: "exact" }).eq("run_id", id).eq("user_id", userId).order("retrieved_at", { ascending: false }).limit(PROGRESS_SOURCES),
    typicalMinutes(typeof mode === "string" ? mode : "combined"),
  ]);
  const candidates = (discovery.data as { candidates?: unknown } | null)?.candidates;
  return {
    candidates: Array.isArray(candidates) ? candidates.length : null,
    sources: sources.error ? [] : (sources.data ?? []).map(progressSource).filter(source => source.title),
    sourceCount: sources.error ? 0 : sources.count ?? sources.data?.length ?? 0,
    estimateMinutes: minutes,
  };
}
// Median duration of recent finished runs per mode, kept for ten minutes so polling does not repeat the query.
const estimates = new Map<string, { at: number; minutes: number | null }>();
async function typicalMinutes(mode: string): Promise<number | null> {
  const cached = estimates.get(mode);
  if (cached && Date.now() - cached.at < 600_000) return cached.minutes;
  try {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data, error } = await createAdminClient().from("research_runs").select("started_at,completed_at")
      .eq("status", "completed").eq("configuration->brief->>discovery_mode", mode).gte("completed_at", since)
      .order("completed_at", { ascending: false }).limit(200);
    const minutes = error ? null : estimateMinutes(data ?? []);
    estimates.set(mode, { at: Date.now(), minutes });
    return minutes;
  } catch {
    return null;
  }
}

// Which model a run uses: the recorded choice once the run has initialized, otherwise the configured primary.
async function describeModel(setupOutput: unknown, usage: { provider?: string | null; model?: string | null }[]): Promise<ResearchModelInfo> {
  const used = [...new Set(usage.map(row => row.model).filter((value): value is string => typeof value === "string" && value.length > 0))];
  const setup = setupOutput && typeof setupOutput === "object" ? setupOutput as { provider?: unknown; model?: unknown } : null;
  if (setup && typeof setup.model === "string") {
    return { provider: typeof setup.provider === "string" ? setup.provider : null, model: setup.model, planned: false, used };
  }
  try {
    const settings = await researchProviderSettings();
    const plan = providerPlan(settings);
    return { provider: plan.primary === "gemini" ? GEMINI_PROVIDER : QWEN_PROVIDER, model: selectedModel(plan.primary, settings), planned: true, used };
  } catch {
    return { provider: null, model: null, planned: true, used };
  }
}
