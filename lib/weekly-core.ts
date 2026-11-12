import { createHmac, timingSafeEqual } from "node:crypto";
import { nextTasks, sprintDay, sprintProgress, type SprintLength, type SprintTask } from "./sprint-core.ts";
import { weekStart } from "./validation-funnel.ts";
import type { EmailMessage, NotifyEnv, Translate } from "./notify-core.ts";

// Weekly progress email (enhancement plan WP-17). Pure rules shared by the cron route and the tests: who gets one,
// which task it names, how it is worded, and how its opt-out link is signed. Decision E2 (2026-11-12): on by default,
// an opt-out link in every email, and a switch on the profile page.

/** The week an email belongs to: its Monday (UTC). Each founder gets at most one email per week. */
export function weekKey(now: Date): string {
  return weekStart(now.getTime());
}

/** A sprint must be this many days old before its first weekly email, so starting one does not trigger an email. */
export const MIN_SPRINT_AGE_DAYS = 3;
/** Emails sent per cron run at most, unless NOTIFY_WEEKLY_MAX says otherwise; the rest are sent on the next day's run. */
export const DEFAULT_WEEKLY_MAX = 100;
export function weeklyMax(env: Pick<WeeklyEnv, "NOTIFY_WEEKLY_MAX">): number {
  const value = Number(env.NOTIFY_WEEKLY_MAX);
  return Number.isInteger(value) && value > 0 && value <= 1000 ? value : DEFAULT_WEEKLY_MAX;
}
export type WeeklyEnv = NotifyEnv & Partial<Record<"NOTIFY_LINK_SECRET" | "CRON_SECRET" | "NOTIFY_WEEKLY_MAX", string | undefined>>;

/**
 * The secret that signs opt-out links: NOTIFY_LINK_SECRET, or the deployment's CRON_SECRET when that is not set. Null
 * when neither is set; emails then link to the profile page instead, where the founder signs in to turn them off.
 */
export function linkSecret(env: WeeklyEnv): string | null {
  const secret = env.NOTIFY_LINK_SECRET?.trim() || env.CRON_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
}
/** A token that lets the opt-out link turn off this founder's weekly emails, and nothing else, without signing in. */
export function unsubscribeToken(secret: string, userId: string): string {
  return createHmac("sha256", secret).update(`weekly-optout:${userId}`).digest("base64url");
}
export function verifyUnsubscribeToken(secret: string | null, userId: unknown, token: unknown): boolean {
  if (!secret || typeof userId !== "string" || typeof token !== "string") return false;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return false;
  const expected = Buffer.from(unsubscribeToken(secret, userId));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

type WeeklySprint = { id: string; opportunity_id: string; length_days: number; started_on: string };
type WeeklyTask = Pick<SprintTask, "title" | "detail" | "due_on" | "done_at" | "position">;
export type WeeklyPick = { sprint: WeeklySprint; task: WeeklyTask; day: number; done: number; total: number };

/**
 * Which of a founder's active sprints the email is about, and its one next task: the sprint whose next open task is due
 * soonest (undated last, then the oldest sprint). Null when no sprint is old enough or none has an open task.
 */
export function pickWeeklyTask(sprints: (WeeklySprint & { tasks: WeeklyTask[] })[], today: string): WeeklyPick | null {
  const candidates = sprints.flatMap(sprint => {
    // The database allows only 7, 14 or 30 days; sprintDay caps the day at the length.
    const timing = { started_on: sprint.started_on, length_days: sprint.length_days as SprintLength };
    if (sprintDay(timing, today) <= MIN_SPRINT_AGE_DAYS) return [];
    const [task] = nextTasks(sprint.tasks, 1);
    if (!task) return [];
    const { done, total } = sprintProgress(sprint.tasks);
    return [{ sprint, task, day: sprintDay(timing, today), done, total }];
  });
  candidates.sort((a, b) =>
    (a.task.due_on ?? "9999-12-31").localeCompare(b.task.due_on ?? "9999-12-31") || a.sprint.started_on.localeCompare(b.sprint.started_on));
  const best = candidates[0];
  if (!best) return null;
  const { tasks: _tasks, ...sprint } = best.sprint;
  return { ...best, sprint };
}

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const oneLine = (value: string, max: number) => {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

export type WeeklyEmailInput = {
  opportunity: string;
  task: Pick<WeeklyTask, "title" | "detail" | "due_on">;
  day: number;
  length: number;
  done: number;
  total: number;
  sprintUrl: string;
  /** The signed opt-out link, or the profile page when links cannot be signed. */
  unsubscribeUrl: string;
  lang: string;
  /** Formats a due date (YYYY-MM-DD) in the email's language. */
  formatDate: (day: string) => string;
};

/**
 * The weekly email. It names the founder's one next task and asks them to pick a time for it now: a plan that says
 * when and where is followed through more often than a goal alone (enhancement plan §1.2, [S4]). No streaks, no badges,
 * no guilt. The task's own detail (where, done when, stop if) is included because it is the founder's own plan.
 */
export function buildWeeklyEmail(input: WeeklyEmailInput, t: Translate): EmailMessage {
  const opportunity = oneLine(input.opportunity, 80);
  const task = oneLine(input.task.title, 300);
  const detail = input.task.detail.trim().split("\n").map(line => oneLine(line, 300)).filter(Boolean).slice(0, 4);
  const subject = opportunity ? `${t("Your one step this week")}: ${opportunity}` : t("Your one step this week");
  const progress = t("Day {day} of {length} · {done} of {total} tasks done", { day: input.day, length: input.length, done: input.done, total: input.total });
  const plan = t("Pick a day and time for it now. When that moment comes, do just this one step, then tick it off.");
  const due = input.task.due_on ? t("Due {date}", { date: input.formatDate(input.task.due_on) }) : "";
  const button = t("Open your sprint");
  const footer = t("You get this email once a week while a validation sprint is active.");
  const optOut = t("Stop weekly emails");
  const font = "font-family:'Geist','Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
  const html = `<!doctype html>
<html lang="${escape(input.lang)}">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="color-scheme" content="light" /><title>${escape(subject)}</title></head>
  <body style="margin:0;padding:0;background-color:#f6f8fb;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f8fb;">
      <tr><td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e0e2e6;border-radius:16px;">
          ${opportunity ? `<tr><td style="padding:32px 32px 0 32px;${font}"><p style="margin:0;font-size:14px;line-height:1.5;color:#59677b;">${escape(opportunity)} · ${escape(progress)}</p></td></tr>` : ""}
          <tr><td style="padding:${opportunity ? "8px" : "32px"} 32px 0 32px;${font}"><h1 style="margin:0;font-size:22px;line-height:1.35;font-weight:600;color:#172b4d;">${escape(task)}</h1></td></tr>
          ${detail.length || due ? `<tr><td style="padding:12px 32px 0 32px;${font}">${[...detail, due].filter(Boolean).map(line => `<p style="margin:0 0 4px 0;font-size:14px;line-height:1.5;color:#59677b;">${escape(line)}</p>`).join("")}</td></tr>` : ""}
          <tr><td style="padding:16px 32px 0 32px;${font}"><p style="margin:0;font-size:16px;line-height:1.6;color:#172b4d;">${escape(plan)}</p></td></tr>
          <tr><td style="padding:24px 32px 32px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#3266d9" style="border-radius:10px;">
              <a href="${escape(input.sprintUrl)}" target="_blank" style="display:inline-block;padding:14px 28px;${font}font-size:16px;line-height:1;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${escape(button)}</a>
            </td></tr></table>
          </td></tr>
        </table>
        <p style="max-width:480px;margin:16px auto 0 auto;${font}font-size:12px;line-height:1.5;color:#8a94a6;">${escape(footer)} <a href="${escape(input.unsubscribeUrl)}" style="color:#59677b;">${escape(optOut)}</a></p>
      </td></tr>
    </table>
  </body>
</html>`;
  const text = [
    opportunity ? `${opportunity} · ${progress}` : progress, "", task, ...detail, ...(due ? [due] : []), "", plan, "",
    `${button}: ${input.sprintUrl}`, "", footer, `${optOut}: ${input.unsubscribeUrl}`,
  ].join("\n");
  return { subject, html, text };
}
