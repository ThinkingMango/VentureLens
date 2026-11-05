import { z } from "zod";
import { getDomain } from "tldts";

export const RESEARCH_MODEL = "alibaba/qwen3.8-flash";
export const methodology = "evidence-driven-v1";
export const stageLabels: Record<string, string> = {
  queued: "等待处理", discovery: "发现候选机会", retrieval: "检索外部证据",
  classification: "分类与核验证据", evaluation: "商业评估", scoring: "加权评分",
  review: "反向审查", finalizing: "保存报告", completed: "研究完成", failed: "研究中止",
};
const short = z.string().min(1).max(800);
export const candidateSchema = z.object({
  key: z.string().regex(/^c[1-8]$/), title: z.string().min(1).max(180),
  buyer: short, pain: short, solution: short, advantage: short,
  query: z.string().min(10).max(300),
});
export const discoverySchema = z.object({ candidates: z.array(candidateSchema).min(5).max(8) });
export type Candidate = z.infer<typeof candidateSchema>;
export const evidenceSchema = z.object({
  source_key: z.string(), candidate_id: z.string(), url: z.string().url(),
  title: z.string(), excerpt: z.string(), retrieved_at: z.string(), published_at: z.string().nullable(),
});
export type Evidence = z.infer<typeof evidenceSchema>;
export const classificationSchema = z.object({ items: z.array(z.object({
  source_key: z.string(), relevant: z.boolean(),
  kind: z.enum(["pain", "demand", "competition", "regulation", "other"]),
  reliability: z.enum(["primary", "secondary", "vendor", "unknown"]),
  stance: z.enum(["supports", "contradicts", "neutral"]),
  quote: z.string().max(500), claim: short,
})).max(32) });
export type Classification = z.infer<typeof classificationSchema>["items"][number];
export const evaluationSchema = z.object({ items: z.array(z.object({
  candidate_id: z.string(), description: short, category: z.string().max(100),
  revenue: short, cost: short, risk: short, assumptions: z.array(short).min(1).max(4),
  validation: z.array(short).min(2).max(4),
  dimensions: z.object({ pain: z.number().int().min(0).max(100), demand: z.number().int().min(0).max(100), economics: z.number().int().min(0).max(100), feasibility: z.number().int().min(0).max(100), advantage: z.number().int().min(0).max(100) }),
  rationale: short,
})).min(1).max(8) });
export type Evaluation = z.infer<typeof evaluationSchema>["items"][number];
export const reviewSchema = z.object({ items: z.array(z.object({
  candidate_id: z.string(), reject: z.boolean(), critique: short,
  penalty: z.number().int().min(0).max(30), falsification: short,
})).min(1).max(8) });
export type Review = z.infer<typeof reviewSchema>["items"][number];
export type Mode = "founder" | "market" | "combined";
export const scoringWeights = {
  founder: { pain: 0.25, demand: 0.15, economics: 0.15, feasibility: 0.2, advantage: 0.25 },
  market: { pain: 0.3, demand: 0.3, economics: 0.2, feasibility: 0.2, advantage: 0 },
  combined: { pain: 0.25, demand: 0.25, economics: 0.2, feasibility: 0.15, advantage: 0.15 },
} as const;
export function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (!host.includes('.') || host === 'localhost' || host.endsWith('.local') || host.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}
export function groundedClassifications(evidence: Evidence[], items: Classification[]) {
  const byKey = new Map(evidence.map(e => [e.source_key, e]));
  const seen = new Set<string>();
  return items.filter(item => {
    const source = byKey.get(item.source_key);
    if (!source || seen.has(item.source_key) || item.quote.trim().length < 12 || !source.excerpt.includes(item.quote)) return false;
    seen.add(item.source_key);
    return true;
  });
}
export function eligibleEvidence(candidate: string, evidence: Evidence[], classifications: Classification[]) {
  const byKey = new Map(groundedClassifications(evidence, classifications).map(c => [c.source_key, c]));
  const domains = new Set<string>();
  const urls = new Set<string>();
  const relevant = evidence.filter(e => {
    if (e.candidate_id !== candidate || !byKey.get(e.source_key)?.relevant) return false;
    const url = safeSourceUrl(e.url);
    if (!url || urls.has(url)) return false;
    const domain = getDomain(new URL(url).hostname.replace(/\.$/, ''), { allowPrivateDomains: true });
    if (!domain) return false;
    urls.add(url);
    domains.add(domain);
    return true;
  });
  const demand = relevant.some(e => {
    const c = byKey.get(e.source_key)!;
    return c.stance === 'supports' && ['pain', 'demand'].includes(c.kind) && ['primary', 'secondary'].includes(c.reliability);
  });
  return domains.size >= 2 && demand ? relevant : [];
}
export function weightedScore(dimensions: Evaluation['dimensions'], mode: Mode, evidenceCount: number, penalty = 0) {
  const weights = scoringWeights[mode];
  const raw = Object.entries(weights).reduce((sum, [key, weight]) => sum + dimensions[key as keyof typeof dimensions] * weight, 0);
  return Math.max(0, Math.min(evidenceCount >= 3 ? 85 : 70, Math.round(raw - penalty)));
}
export function requireExactIds(expected: string[], actual: string[]) {
  if (new Set(actual).size !== actual.length || actual.length !== expected.length || actual.some(id => !expected.includes(id))) throw new Error('INVALID_OUTPUT');
}
export const researchErrors: Record<string, string> = {
  DEV_ACCESS_REQUIRED: "此账号没有有效的开发研究权限。尚未启用付费研究。",
  DEV_QUOTA_EXCEEDED: "开发研究额度已用完。",
  RUN_ALREADY_ACTIVE: "已有研究任务正在处理，请先查看该任务。",
  BUDGET_EXCEEDED: "已达到本次研究的估算预算上限，任务已停止。",
  RETRIEVAL_UNAVAILABLE: "外部检索未返回可验证的内容。本次没有生成研究报告。",
  INSUFFICIENT_EVIDENCE: "证据不足以支持任何机会，本次没有生成报告。",
  INVALID_OUTPUT: "模型输出未通过结构或证据核验，本次没有生成报告。",
  TRANSIENT_PROVIDER: "服务暂时不可用。可在剩余预算内手动重试一次。",
  PROVIDER_CREDITS_REQUIRED: "Research requires paid AI Gateway credits for the configured model. Ask the project owner to add credits before starting another run.",
  PROVIDER_CONFIGURATION: "研究服务暂不可用，请检查部署配置。",
  WORKFLOW_INTERRUPTED: "工作流执行中断。可在剩余预算内手动重试一次。",
  DISPATCH_FAILED: "任务未能启动，可手动重试一次。",
};
export function errorCode(error: unknown): string {
  const seen = new Set<unknown>();
  const failures: { message: string; status: number }[] = [];
  for (let current = error; current && !seen.has(current) && failures.length < 8;) {
    seen.add(current);
    const record = typeof current === 'object' ? current as { message?: unknown; statusCode?: unknown; cause?: unknown } : null;
    failures.push({ message: typeof record?.message === 'string' ? record.message : String(current), status: Number(record?.statusCode ?? 0) });
    current = record?.cause;
  }
  const message = failures.map(failure => failure.message).join('\n');
  const known = Object.keys(researchErrors).find(code => message.includes(code));
  if (known) return known;
  if (/free tier users do not have access|upgrade to paid credits|insufficient (?:credits|balance)|credit balance|credits? (?:are )?(?:exhausted|required)/i.test(message)) return 'PROVIDER_CREDITS_REQUIRED';
  if (failures.some(({ status }) => [401, 402, 403].includes(status)) || /authentication|api.key|oidc/i.test(message)) return 'PROVIDER_CONFIGURATION';
  if (failures.some(({ status }) => status === 429 || status >= 500) || /timeout|abort|fetch failed/i.test(message)) return 'TRANSIENT_PROVIDER';
  return 'INVALID_OUTPUT';
}
