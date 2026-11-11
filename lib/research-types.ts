import type { RunProgress } from "./research-progress";
import type { WorkspaceOpportunity, ResearchBrief } from "@/lib/workspace-schema";
import type { Mode, ResearchOutcome } from "@/lib/research-core";
export type ResearchReport = {
  methodology: string;
  language?: string;
  model: string;
  provider?: string;
  mode: Mode;
  generated_at: string;
  summary: string;
  limitations: string[];
  weights: Record<string, number>;
  opportunities: WorkspaceOpportunity[];
  /** Ideas discovery proposed that the founder had already seen, dropped before research (WP-04). */
  skipped_duplicates?: number;
};
export type ResearchModelInfo = {
  provider: string | null;
  model: string | null;
  // true when the run has not initialized yet and this is the configured primary, not a recorded choice
  planned: boolean;
  used: string[];
};
export type ResearchDetail = {
  id: string;
  status: string;
  stage: string;
  model: ResearchModelInfo;
  error_code: string | null;
  budget_block?: { model: string; required_usd: number; remaining_usd: number; kind: "reservation" | "estimate" };
  retry_count: number;
  /** Whether a failed run handed its slot back. False once the account's failed-run refund allowance is used up. */
  quota_released?: boolean;
  configuration: { brief: ResearchBrief };
  report: ResearchReport | null;
  /** Why each candidate passed or not (WP-06). Null for runs saved before outcomes were recorded, or not yet decided. */
  outcome?: ResearchOutcome | null;
  created_at: string;
  completed_at: string | null;
  steps: { stage_key: string; created_at: string }[];
  /** Live progress while the run is pending or running (WP-08); absent once it has finished. */
  progress?: RunProgress;
  usage: { estimated_usd: number; committed_usd: number; uncertain_calls: number; input_tokens: number; output_tokens: number; search_requests: number; budget_usd: number };
};
