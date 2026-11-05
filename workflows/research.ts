import { getWorkflowMetadata } from "workflow";
import { initializeResearch, executeResearchStage, failResearch } from "@/lib/research-engine";
import { errorCode } from "@/lib/research-core";

type Context = { runId: string; userId: string; workflowId: string };
async function initialize(ctx: Context) {
  "use step";
  try {
    return await initializeResearch(ctx);
  } catch (error) {
    throw new Error(errorCode(error));
  }
}
initialize.maxRetries = 0;
async function stage(ctx: Context, key: string) {
  "use step";
  try {
    return await executeResearchStage(ctx, key);
  } catch (error) {
    throw new Error(errorCode(error));
  }
}
stage.maxRetries = 0;
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
