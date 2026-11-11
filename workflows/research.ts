import { FatalError, getWorkflowMetadata } from "workflow";
import { initializeResearch, executeResearchStage, failResearch, recordStageFailure } from "@/lib/research-engine";
import { errorCode } from "@/lib/research-core";
import { notifyRunFinished } from "@/lib/notify";

type Context = { runId: string; userId: string; workflowId: string };
async function initialize(ctx: Context) {
  "use step";
  try {
    return await initializeResearch(ctx);
  } catch (error) {
    await recordStageFailure(ctx, "setup", error);
    throw new FatalError(errorCode(error));
  }
}
initialize.maxRetries = 0;
async function stage(ctx: Context, key: string) {
  "use step";
  try {
    return await executeResearchStage(ctx, key);
  } catch (error) {
    // Errors raised by the engine are classified and final: retrying them would only repeat paid requests.
    await recordStageFailure(ctx, key, error);
    throw new FatalError(errorCode(error));
  }
}
// One retry covers a step lost to the platform (function timeout or crash) rather than to the engine. Completed batches
// are checkpointed, so a retried stage resumes after the last saved batch instead of starting over.
stage.maxRetries = 1;
async function recordFailure(ctx: Context, code: string) {
  "use step";
  await failResearch(ctx, code);
}
recordFailure.maxRetries = 1;
// "Report ready" email (WP-08). The run is already finished and saved; a failed email must never change that.
async function notify(ctx: Context) {
  "use step";
  try {
    const result = await notifyRunFinished(ctx);
    if (result !== "sent") console.info("[notify] run finished without an email", { runId: ctx.runId, result });
  } catch (error) {
    console.warn("[notify] email could not be sent", { runId: ctx.runId, reason: error instanceof Error ? error.message : "unknown" });
    throw error;
  }
}
notify.maxRetries = 1;
export async function researchWorkflow(runId: string, userId: string) {
  "use workflow";
  const ctx = { runId, userId, workflowId: getWorkflowMetadata().workflowRunId };
  try {
    if (!await initialize(ctx)) return;
    const candidates = await stage(ctx, "discovery");
    for (const key of candidates) await stage(ctx, `retrieval:${key}`);
    for (const key of ["classification", "evaluation", "scoring", "review", "finalizing"]) await stage(ctx, key);
  } catch (error) {
    await recordFailure(ctx, errorCode(error));
  }
  try {
    await notify(ctx);
  } catch {
    // Already logged by the step; the report and the run status are unaffected.
  }
}
