import "server-only";
import { start, getRun } from "workflow/api";
import { researchWorkflow } from "@/workflows/research";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import type { ResearchDetail } from "@/lib/research-types";

export async function dispatchResearch(id: string, userId: string) {
  const client = createAdminClient();
  const { data, error } = await client.from("research_runs").select("status,workflow_id").eq("id", id).eq("user_id", userId).single();
  if (error || !data) throw new Error("WORKFLOW_INTERRUPTED");
  if (data.status !== "pending" || data.workflow_id) return;
  try {
    await start(researchWorkflow, [id, userId]);
  } catch {
    const { error: updateError } = await client.from("research_runs").update({ status: "failed", error_code: "DISPATCH_FAILED", completed_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId).eq("status", "pending").is("workflow_id", null);
    if (updateError) throw new Error("WORKFLOW_INTERRUPTED");
    throw new Error("DISPATCH_FAILED");
  }
}
export async function researchDetail(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, id: string): Promise<ResearchDetail | null> {
  const result = await supabase.from("research_runs").select("id,status,stage,error_code,retry_count,configuration,report,created_at,completed_at,workflow_id,updated_at,budget_usd").eq("id", id).eq("user_id", userId).maybeSingle();
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
      const { data: recovered, error } = await createAdminClient().from("research_runs").update({ status: "failed", error_code: interrupted, completed_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId).eq("status", run.status).eq("updated_at", run.updated_at).select("id");
      if (error) throw new Error("WORKFLOW_INTERRUPTED");
      if (recovered?.length) { run.status = "failed"; run.error_code = interrupted; }
    }
  }
  const [steps, usage] = await Promise.all([
    supabase.from("research_stages").select("stage_key,created_at").eq("run_id", id).eq("user_id", userId).order("created_at"),
    supabase.from("research_usage").select("status,input_tokens,output_tokens,search_requests,estimated_usd,reserved_usd").eq("run_id", id).eq("user_id", userId),
  ]);
  if (steps.error || usage.error) throw new Error("WORKFLOW_INTERRUPTED");
  const totals = (usage.data ?? []).reduce((sum, u) => ({
    estimated_usd: sum.estimated_usd + (u.status === "completed" ? Number(u.estimated_usd) : 0),
    committed_usd: sum.committed_usd + Number(u.status === "completed" ? u.estimated_usd : u.reserved_usd),
    uncertain_calls: sum.uncertain_calls + Number(u.status !== "completed"),
    input_tokens: sum.input_tokens + u.input_tokens, output_tokens: sum.output_tokens + u.output_tokens, search_requests: sum.search_requests + u.search_requests,
  }), { estimated_usd: 0, committed_usd: 0, uncertain_calls: 0, input_tokens: 0, output_tokens: 0, search_requests: 0 });
  return { id: run.id, status: run.status, stage: run.stage, error_code: run.error_code, retry_count: run.retry_count, configuration: { brief: run.configuration.brief }, report: run.report, created_at: run.created_at, completed_at: run.completed_at, steps: steps.data ?? [], usage: { ...totals, budget_usd: Number(run.budget_usd) } };
}
