import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, isLocale, type Locale } from "@/i18n/config";
import { notificationMode, siteOrigin, smtpConfig } from "@/lib/notify-core";
import { dryRunProvider, smtpProvider, translatorFor, type NotificationProvider } from "@/lib/notify";
import { track } from "@/lib/events";
import { buildWeeklyEmail, linkSecret, pickWeeklyTask, unsubscribeToken, weekKey, weeklyMax, type WeeklyEnv } from "@/lib/weekly-core";

// Weekly progress email (enhancement plan WP-17), sent by the daily cron route. Reads with the service role: active
// sprints, their tasks, founders' choices and confirmed addresses. Each founder gets at most one email per week.

type Client = ReturnType<typeof createAdminClient>;
const PAGE = 1000;
const CHUNK = 100;
async function readAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error("WEEKLY_DATA_UNAVAILABLE");
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}
async function readIn<T>(ids: string[], query: (chunk: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    rows.push(...await readAll<T>((from, to) => query(chunk, from, to)));
  }
  return rows;
}

export type WeeklyResult = {
  mode: "send" | "dry-run" | "off";
  /** Founders with an active sprint old enough and an open task. */
  eligible: number;
  sent: number;
  /** Already emailed this week, turned off, or without a confirmed address. */
  skipped: number;
  failed: number;
  /** Eligible but over this run's cap; tomorrow's run picks them up. */
  deferred: number;
};

/**
 * Sends this week's email to every founder who should get one and has not yet. Oldest sprints first, at most
 * `weeklyMax` per run. A founder is claimed in weekly_emails before sending and released if sending fails, so a retry
 * or an overlapping run never sends twice in one week.
 */
export async function sendWeeklyEmails(deps: { env?: WeeklyEnv; provider?: NotificationProvider; client?: Client; now?: Date } = {}): Promise<WeeklyResult> {
  const env = deps.env ?? (process.env as WeeklyEnv);
  const mode = notificationMode(env);
  const result: WeeklyResult = { mode: mode.mode, eligible: 0, sent: 0, skipped: 0, failed: 0, deferred: 0 };
  if (mode.mode === "off") return result;
  const origin = siteOrigin(env);
  if (!origin) return { ...result, mode: "off" };
  const client = deps.client ?? createAdminClient();
  const now = deps.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const week = weekKey(now);

  const sprints = await readAll<{ id: string; user_id: string; opportunity_id: string; length_days: number; started_on: string }>((from, to) =>
    client.from("validation_sprints").select("id,user_id,opportunity_id,length_days,started_on").eq("status", "active").order("started_on").order("id").range(from, to));
  if (!sprints.length) return result;
  const users = [...new Set(sprints.map(sprint => sprint.user_id))];
  const [tasks, profiles, sent] = await Promise.all([
    readIn<{ sprint_id: string; title: string; detail: string; due_on: string | null; done_at: string | null; position: number }>(sprints.map(s => s.id), (chunk, from, to) =>
      client.from("validation_tasks").select("sprint_id,title,detail,due_on,done_at,position").in("sprint_id", chunk).order("id").range(from, to)),
    readIn<{ user_id: string; notify_weekly: boolean | null }>(users, (chunk, from, to) =>
      client.from("founder_profiles").select("user_id,notify_weekly").in("user_id", chunk).order("user_id").range(from, to)),
    readIn<{ user_id: string }>(users, (chunk, from, to) =>
      client.from("weekly_emails").select("user_id").eq("week", week).in("user_id", chunk).order("user_id").range(from, to)),
  ]);
  const optedOut = new Set(profiles.filter(p => p.notify_weekly === false).map(p => p.user_id));
  const alreadySent = new Set(sent.map(row => row.user_id));

  // One pick per founder: the sprint whose next task is due soonest. Founders in order of their oldest active sprint.
  const picks = users.flatMap(user => {
    const own = sprints.filter(s => s.user_id === user).map(s => ({ ...s, tasks: tasks.filter(t => t.sprint_id === s.id) }));
    const pick = pickWeeklyTask(own, today);
    return pick ? [{ user, pick }] : [];
  });
  result.eligible = picks.length;
  const due = picks.filter(({ user }) => !optedOut.has(user) && !alreadySent.has(user));
  result.skipped = picks.length - due.length;
  const max = weeklyMax(env);
  result.deferred = Math.max(0, due.length - max);
  const batch = due.slice(0, max);
  if (!batch.length) return result;

  const opportunityIds = [...new Set(batch.map(({ pick }) => pick.sprint.opportunity_id))];
  const rows = await readIn<{ id: string; title: string; run_id: string }>(opportunityIds, (chunk, from, to) =>
    client.from("opportunities").select("id,title,run_id").in("id", chunk).order("id").range(from, to));
  const runs = await readIn<{ id: string; language: string | null }>([...new Set(rows.map(row => row.run_id))], (chunk, from, to) =>
    client.from("research_runs").select("id,language:configuration->brief->>language").in("id", chunk).order("id").range(from, to));
  const opportunities = rows.map(row => ({ id: row.id, title: row.title, language: runs.find(run => run.id === row.run_id)?.language ?? null }));
  const smtp = smtpConfig(env);
  const provider = deps.provider ?? (mode.mode === "send" && smtp ? smtpProvider(smtp) : dryRunProvider());
  const secret = linkSecret(env);

  for (const { user, pick } of batch) {
    const { data: account } = await client.auth.admin.getUserById(user);
    const to = account?.user?.email_confirmed_at ? account.user.email : null;
    if (!to) { result.skipped++; continue; }
    const { data: claimed, error: claimError } = await client.from("weekly_emails").upsert({ user_id: user, week }, { onConflict: "user_id,week", ignoreDuplicates: true }).select("user_id");
    if (claimError) { result.failed++; continue; }
    if (!claimed?.length) { result.skipped++; continue; }

    const opportunity = opportunities.find(o => o.id === pick.sprint.opportunity_id);
    const lang: Locale = isLocale(opportunity?.language) ? opportunity.language : "en";
    const unsubscribeUrl = secret ? `${origin}/unsubscribe?u=${user}&t=${unsubscribeToken(secret, user)}` : `${origin}/profile`;
    const email = buildWeeklyEmail({
      opportunity: opportunity?.title ?? "", task: pick.task, day: pick.day, length: pick.sprint.length_days, done: pick.done, total: pick.total,
      sprintUrl: `${origin}/opportunities/${pick.sprint.opportunity_id}?tab=validation`, unsubscribeUrl, lang,
      formatDate: day => formatDate(lang, `${day}T00:00:00Z`),
    }, translatorFor(lang));
    // RFC 8058 one-click unsubscribe, which mail apps show as their own button, only when the link can be signed.
    const headers: Record<string, string> | undefined = secret
      ? { "List-Unsubscribe": `<${origin}/api/notifications/unsubscribe?u=${user}&t=${unsubscribeToken(secret, user)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
      : undefined;
    try {
      await provider.send({ ...email, to, idempotencyKey: `weekly-${week}-${user}`, ...(headers ? { headers } : {}) });
      result.sent++;
      if (mode.mode === "send") await track("weekly_email_sent", { userId: user, props: {} });
    } catch {
      result.failed++;
      await client.from("weekly_emails").delete().eq("user_id", user).eq("week", week);
    }
  }
  return result;
}

/** Turns off a founder's weekly emails, from the signed opt-out link. The caller has verified the token. */
export async function turnOffWeeklyEmails(userId: string, client: Client = createAdminClient()): Promise<void> {
  const { error } = await client.from("founder_profiles").update({ notify_weekly: false }).eq("user_id", userId);
  if (error) throw new Error("UNSUBSCRIBE_FAILED");
}
