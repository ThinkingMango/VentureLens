import type { WorkspaceOpportunity, ResearchBrief } from "@/lib/workspace-schema";
import type { Mode } from "@/lib/research-core";
export type ResearchReport = {
  methodology: string;
  model: string;
  mode: Mode;
  generated_at: string;
  summary: string;
  limitations: string[];
  weights: Record<string, number>;
  opportunities: WorkspaceOpportunity[];
};
export type ResearchDetail = {
  id: string;
  status: string;
  stage: string;
  error_code: string | null;
  retry_count: number;
  configuration: { brief: ResearchBrief };
  report: ResearchReport | null;
  created_at: string;
  completed_at: string | null;
  steps: { stage_key: string; created_at: string }[];
  usage: { estimated_usd: number; committed_usd: number; uncertain_calls: number; input_tokens: number; output_tokens: number; search_requests: number; budget_usd: number };
};
