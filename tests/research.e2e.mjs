import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { emptyBrief, emptyProfile, opportunitySchema } from "../lib/workspace-schema.ts";
import { evidenceGate, groundedClassifications, weightedScore } from "../lib/research-core.ts";
import { qwenModelIds, geminiModelIds } from "../lib/research-models.ts";
const allowedModels = [...qwenModelIds, ...geminiModelIds];
const allowedProviders = ["dashscope-beijing", "google-gemini"];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && key && secret, "真实研究验收被阻挡：测试环境未注入已连接 Supabase 的 URL、公开密钥和服务端密钥；未创建账号或调用模型。");
const base = new URL(process.env.RESEARCH_E2E_BASE_URL ?? "http://localhost:3000");
assert.ok(!base.username && !base.password && base.pathname === "/" && !base.search && !base.hash, "测试地址必须是应用 origin。");
assert.ok(base.protocol === "https:" || (base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)), "仅允许 HTTPS 或本机开发服务。");
assert.notEqual(process.env.VERCEL_ENV, "production", "禁止从生产运行环境发放测试权限。");
const preflight = await fetch(new URL(`/api/research/${randomUUID()}`, base), { redirect: "error", signal: AbortSignal.timeout(20000) });
assert.equal(preflight.status, 401, "应用必须能够识别匿名请求；配置故障时不能创建测试账号。");

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, options);
const cookieJar = new Map();
const client = createServerClient(url, key, {
  cookies: {
    getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
    setAll: cookies => {
      for (const { name, value, options } of cookies) {
        if (options?.maxAge === 0) cookieJar.delete(name);
        else cookieJar.set(name, value);
      }
    },
  },
});
function checked(result, label) {
  assert.ok(!result.error, `${label}${result.error?.code ? `（${result.error.code}）` : ""}`);
  return result.data;
}
async function request(path, body) {
  const response = await fetch(new URL(path, base), {
    method: body ? "POST" : "GET",
    headers: {
      origin: base.origin,
      cookie: [...cookieJar].map(([name, value]) => `${name}=${value}`).join("; "),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(45000),
  });
  const data = await response.json();
  return { status: response.status, data };
}

let userId;
let runId;
let completed = false;
let summary;
try {
  const email = `venturelens-research-${randomUUID()}@example.com`;
  const account = checked(await admin.auth.admin.createUser({ email, email_confirm: true }), "创建隔离测试账号失败");
  userId = account.user.id;
  const issued = checked(await admin.auth.admin.generateLink({ type: "magiclink", email }), "生成隔离测试验证码失败");
  checked(await client.auth.verifyOtp({ email, token: issued.properties.email_otp, type: "email" }), "测试账号登录失败");
  const profile = { ...emptyProfile, name: "研究验收账号", skills: "B2B workflow automation, customer interviews and professional services operations" };
  const savedProfile = await request("/api/workspace", { action: "profile", profile });
  assert.equal(savedProfile.status, 200, "通过正式 API 保存测试画像失败");
  const brief = { ...emptyBrief, name: "真实证据研究验收", discovery_mode: "combined", context: "Investigate narrowly scoped GenAI workflow products for US accounting and bookkeeping firms. Seek independently documented buyer pain, existing software spending, competing offers and disconfirming evidence. Financial projections must remain unverified assumptions." };
  const requestKey = randomUUID();
  const denied = await request("/api/research", { action: "start", brief, requestKey });
  assert.equal(denied.status, 403, "无开发权限的已登录账号必须被拒绝");
  assert.equal(denied.data.code, "DEV_ACCESS_REQUIRED");
  const forbiddenGrant = await client.from("research_dev_access").insert({ user_id: userId, expires_at: new Date(Date.now() + 1800000).toISOString(), max_runs: 1 });
  assert.ok(forbiddenGrant.error, "客户端不能自行授予开发权限");
  checked(await admin.from("research_dev_access").insert({ user_id: userId, expires_at: new Date(Date.now() + 1800000).toISOString(), max_runs: 1 }), "授予单次、30 分钟测试权限失败");

  const started = await request("/api/research", { action: "start", brief, requestKey });
  assert.equal(started.status, 202, `真实研究启动失败：${started.data.code ?? started.status}`);
  runId = started.data.id;
  assert.ok(runId, "API 必须返回已入库的任务 ID");
  const repeated = await request("/api/research", { action: "start", brief, requestKey });
  assert.equal(repeated.status, 202, "重复请求应复用任务");
  assert.equal(repeated.data.id, runId, "幂等键不得产生第二个任务");
  const quota = await request("/api/research", { action: "start", brief, requestKey: randomUUID() });
  assert.equal(quota.status, 403, "单次开发额度不得被绕过");
  assert.equal(quota.data.code, "DEV_QUOTA_EXCEEDED");

  const deadline = Date.now() + 20 * 60 * 1000;
  let detail;
  let previousStage;
  while (Date.now() < deadline) {
    const state = await request(`/api/research/${runId}`);
    assert.equal(state.status, 200, "读取真实研究状态失败");
    detail = state.data;
    if (detail.stage !== previousStage) {
      console.log(`研究阶段：${detail.stage}；任务状态：${detail.status}`);
      previousStage = detail.stage;
    }
    assert.notEqual(detail.status, "failed", `真实研究失败：${detail.error_code ?? "UNKNOWN"}；没有将失败冒充为已完成研究。`);
    if (detail.status === "completed") break;
    await delay(3000);
  }
  assert.equal(detail?.status, "completed", "真实研究未在 20 分钟内完成；测试未通过");
  assert.ok(detail.report, "完成状态必须有报告");
  assert.ok(detail.report.model === "mixed" || allowedModels.includes(detail.report.model));
  assert.ok(detail.report.models?.length > 0 && detail.report.models.every(model => allowedModels.includes(model)));
  assert.ok(detail.report.providers?.length > 0 && detail.report.providers.every(provider => allowedProviders.includes(provider)));
  assert.equal(detail.report.mode, "combined");
  assert.equal(detail.report.methodology, "evidence-driven-v2");
  const opportunities = detail.report.opportunities.map(item => opportunitySchema.parse(item));
  assert.ok(opportunities.length >= 1 && opportunities.length <= 8, "不得凑数或超出机会数量限制");

  const fresh = createClient(url, key, options);
  const session = checked(await client.auth.getSession(), "读取测试会话失败").session;
  checked(await fresh.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }), "在全新客户端恢复会话失败");
  const persisted = checked(await fresh.from("research_runs").select("id,status,report,configuration,workflow_id,budget_usd").eq("id", runId).eq("user_id", userId).single(), "重新读取已持久化任务失败");
  assert.equal(persisted.status, "completed");
  assert.ok(persisted.workflow_id, "必须通过真实持久工作流运行");
  assert.deepEqual(persisted.report, detail.report, "报告必须与全新数据库客户端读到的结果一致");
  assert.equal(persisted.configuration.brief.discovery_mode, "combined");
  assert.ok(Number(persisted.budget_usd) <= 0.25, "开发研究预算不得超过 0.25 USD");
  const evidence = checked(await fresh.from("research_evidence").select("source_key,candidate_id,url,title,excerpt,retrieved_at,published_at,classification").eq("run_id", runId).eq("user_id", userId), "读取持久化外部证据失败");
  assert.ok(evidence.length > 0, "无真实外部检索证据不能通过验收");
  const classes = groundedClassifications(evidence, evidence.flatMap(e => e.classification ? [e.classification] : []));
  const stages = checked(await fresh.from("research_stages").select("stage_key,output").eq("run_id", runId).eq("user_id", userId), "读取研究阶段检查点失败");
  for (const key of ["setup", "discovery", "classification", "evaluation", "scoring", "review"]) assert.ok(stages.some(stage => stage.stage_key === key), `缺少阶段检查点：${key}`);
  const discovery = stages.find(stage => stage.stage_key === "discovery").output;
  for (const candidate of discovery.candidates) assert.ok(stages.some(stage => stage.stage_key === `retrieval:${candidate.key}`), "每个候选必须执行真实检索阶段");
  const evaluations = stages.find(stage => stage.stage_key === "evaluation").output.items;
  const reviews = stages.find(stage => stage.stage_key === "review").output.items;
  for (const opportunity of opportunities) {
    const { sources, supportingDomains } = evidenceGate(opportunity.candidate_id, evidence, classes);
    assert.ok(supportingDomains >= 2, "机会必须满足两个独立支持域名及非供应商需求门槛");
    assert.deepEqual(opportunity.evidence.map(e => e.source_key).sort(), sources.map(e => e.source_key).sort(), "报告引用必须来自实际入库的已核验证据");
    const evaluation = evaluations.find(e => e.candidate_id === opportunity.candidate_id);
    const review = reviews.find(r => r.candidate_id === opportunity.candidate_id);
    assert.ok(evaluation && review && !review.reject, "机会必须通过商业评估与反向审查");
    assert.equal(opportunity.score, weightedScore(evaluation.dimensions, "combined", supportingDomains, review.penalty), "最终评分必须按真实检查点重新计算一致");
  }
  const storedOpportunities = checked(await fresh.from("opportunities").select("id,payload").eq("run_id", runId).eq("user_id", userId), "读取落库机会失败");
  assert.deepEqual(storedOpportunities.map(o => o.payload).sort((a, b) => a.id.localeCompare(b.id)), [...opportunities].sort((a, b) => a.id.localeCompare(b.id)), "报告与机会表必须完整一致");
  const usage = checked(await fresh.from("research_usage").select("provider,model,status,input_tokens,output_tokens,search_requests,estimated_usd,reserved_usd").eq("run_id", runId).eq("user_id", userId), "读取真实用量记录失败");
  assert.ok(usage.length > 0 && usage.every(u => allowedProviders.includes(u.provider) && allowedModels.includes(u.model)));
  assert.deepEqual([...new Set(usage.map(u => u.model))].sort(), [...detail.report.models].sort());
  assert.deepEqual([...new Set(usage.map(u => u.provider))].sort(), [...detail.report.providers].sort());
  assert.ok(usage.some(u => u.search_requests > 0), "必须记录外部检索调用");
  assert.ok(usage.some(u => u.input_tokens > 0 && u.output_tokens > 0), "必须记录真实模型用量");
  const committed = usage.reduce((sum, u) => sum + Number(u.status === "completed" ? u.estimated_usd : u.reserved_usd), 0);
  assert.ok(Number.isFinite(committed) && committed <= Number(persisted.budget_usd) + 0.000001, "真实费用估算及未知调用预留不得超过预算");
  const history = await request("/api/workspace");
  assert.equal(history.status, 200, "重新加载研究历史失败");
  assert.ok(history.data.runs.some(run => run.id === runId && run.status === "completed"), "已完成任务必须出现在真实历史列表中");
  const reopened = await request(`/api/research/${runId}`);
  assert.equal(reopened.status, 200);
  assert.deepEqual(reopened.data.report, persisted.report, "重新打开报告 API 必须返回同一持久化报告");
  const access = checked(await admin.from("research_dev_access").select("runs_used,max_runs").eq("user_id", userId).single(), "读取额度账本失败");
  assert.equal(access.runs_used, 1, "重复请求不得重复扣减额度");
  completed = true;
  summary = { result: "PASS", run_id: runId, workflow_id: persisted.workflow_id, opportunities: opportunities.length, evidence: evidence.length, usage_calls: usage.length, committed_usd: committed, retained: process.env.RESEARCH_E2E_KEEP_RESULTS === "1" };
} finally {
  if (userId) {
    const cleanupFailures = [];
    const revoked = await admin.from("research_dev_access").delete().eq("user_id", userId);
    if (revoked.error) cleanupFailures.push("测试开发权限撤销失败");
    if (!completed || process.env.RESEARCH_E2E_KEEP_RESULTS !== "1" || revoked.error) {
      const deleted = await admin.auth.admin.deleteUser(userId);
      if (deleted.error) cleanupFailures.push("隔离测试账号清理失败");
    }
    assert.deepEqual(cleanupFailures, [], "测试清理未完全成功，需要管理员处理");
  }
}
console.log(JSON.stringify(summary));
