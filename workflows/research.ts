import { FatalError, getWorkflowMetadata } from "workflow";
import { initializeResearch, executeResearchStage, failResearch, recordStageFailure } from "@/lib/research-engine";
import { errorCode } from "@/lib/research-core";

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
}
