// "Report ready" email (spec WP-08). Pure rules shared by the workflow step and the tests: when to send, what the email
// says, and how it is built. The email never carries profile, brief or report text: only the run's own name, its
// outcome and a link back to the run.

export type NotifyEnv = Partial<Record<"NOTIFY_DRY_RUN" | "NOTIFY_SEND" | "RESEND_API_KEY" | "NOTIFY_FROM" | "NOTIFY_REPLY_TO" | "VERCEL_ENV" | "SITE_URL" | "NEXT_PUBLIC_SITE_URL" | "VERCEL_PROJECT_PRODUCTION_URL", string | undefined>>;
export type NotifyMode = { mode: "send" | "dry-run" | "off"; reason: string };

/** Decision D1 (2026-11-11): Resend, sending from notifications@smartmango.ai. Replies go to support. */
export const DEFAULT_FROM = "VentureLens <notifications@smartmango.ai>";
export const DEFAULT_REPLY_TO = "support@smartmango.ai";

/**
 * Whether this deployment sends real email. Nothing is sent without an API key; NOTIFY_DRY_RUN=1 always only logs; and
 * outside Vercel production (development, previews, tests) email is only logged unless NOTIFY_SEND=1 says otherwise.
 */
export function notificationMode(env: NotifyEnv): NotifyMode {
  if (env.NOTIFY_DRY_RUN === "1") return { mode: "dry-run", reason: "NOTIFY_DRY_RUN=1" };
  if (!env.RESEND_API_KEY) return { mode: "off", reason: "RESEND_API_KEY is not set" };
  if (env.VERCEL_ENV !== "production" && env.NOTIFY_SEND !== "1") return { mode: "dry-run", reason: "not production; set NOTIFY_SEND=1 to send" };
  return { mode: "send", reason: "production" };
}

/** The absolute origin for links in the email, without a trailing slash, or null when none is configured. */
export function siteOrigin(env: NotifyEnv): string | null {
  const candidates = [env.SITE_URL, env.NEXT_PUBLIC_SITE_URL, env.VERCEL_PROJECT_PRODUCTION_URL && `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`];
  for (const value of candidates) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:" || url.hostname === "localhost") return url.origin;
    } catch {
      // Ignore a malformed value and try the next one.
    }
  }
  return null;
}

export type RunForNotification = { status: string; error_code: string | null; quota_released: boolean | null; mode: string | null; opportunities: number };
export type NotificationOutcome =
  | { kind: "ready"; count: number }
  | { kind: "verified" }
  | { kind: "nothing_passed" }
  | { kind: "failed"; returned: boolean };

/**
 * What the email reports, or null when the run should not send one: it is not finished, or it was interrupted (the
 * founder retries those from the page, and a later attempt finishes with its own email).
 */
export function notificationOutcome(run: RunForNotification): NotificationOutcome | null {
  if (run.status === "completed") return run.mode === "verify" ? { kind: "verified" } : { kind: "ready", count: run.opportunities };
  if (run.status !== "failed" || run.error_code === "WORKFLOW_INTERRUPTED") return null;
  if (run.error_code === "INSUFFICIENT_EVIDENCE") return { kind: "nothing_passed" };
  return { kind: "failed", returned: run.quota_released === true };
}

export type Translate = (source: string, values?: Record<string, string | number>) => string;
export type EmailMessage = { subject: string; html: string; text: string };

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** The run's own name, on one line and at most 80 characters. */
export function runLabel(name: unknown): string {
  const text = typeof name === "string" ? name.replace(/\s+/g, " ").trim() : "";
  if (!text) return "";
  return text.length > 80 ? `${text.slice(0, 79)}…` : text;
}

function lines(outcome: NotificationOutcome, t: Translate) {
  switch (outcome.kind) {
    case "ready":
      return {
        subject: t("Your VentureLens report is ready"),
        headline: t("{count, plural, one {# opportunity passed} other {# opportunities passed}}", { count: outcome.count }),
        body: t("Each opportunity passed the evidence check and the adversarial review. Open the report to see the claims, sources and how to test it."),
        button: t("Open your report"),
      };
    case "verified":
      return {
        subject: t("Your VentureLens idea check is ready"),
        headline: t("Your idea check is ready"),
        body: t("Open it to see the verdict, the evidence behind it and what to test next."),
        button: t("Open your report"),
      };
    case "nothing_passed":
      return {
        subject: t("Your VentureLens research has finished"),
        headline: t("Nothing passed this time. Here's why"),
        body: t("No idea had enough independent evidence. The run page explains what was missing for each one and what to try next."),
        button: t("See why"),
      };
    case "failed":
      return {
        subject: t("Your VentureLens research stopped"),
        headline: outcome.returned ? t("The run failed and your run was returned") : t("The run failed"),
        body: outcome.returned
          ? t("Something went wrong before the report was finished. The run was returned to your account, so you can start it again.")
          : t("Something went wrong before the report was finished. Open the run to see what happened and whether you can retry."),
        button: t("Open the run"),
      };
  }
}

/** The email for a finished run. `name` is the run's own name; nothing else from the brief, profile or report is used. */
export function buildRunEmail(input: { outcome: NotificationOutcome; name: string; runUrl: string; profileUrl: string; lang: string }, t: Translate): EmailMessage {
  const copy = lines(input.outcome, t);
  const name = runLabel(input.name);
  const subject = name ? `${copy.subject}: ${name}` : copy.subject;
  const footer = t("You get this email because report notifications are on. You can turn them off on your profile page.");
  const font = "font-family:'Geist','Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
  const html = `<!doctype html>
<html lang="${escape(input.lang)}">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="color-scheme" content="light" /><title>${escape(subject)}</title></head>
  <body style="margin:0;padding:0;background-color:#f6f8fb;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f8fb;">
      <tr><td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e0e2e6;border-radius:16px;">
          ${name ? `<tr><td style="padding:32px 32px 0 32px;${font}"><p style="margin:0;font-size:14px;line-height:1.5;color:#59677b;">${escape(name)}</p></td></tr>` : ""}
          <tr><td style="padding:${name ? "8px" : "32px"} 32px 0 32px;${font}"><h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:600;color:#172b4d;">${escape(copy.headline)}</h1></td></tr>
          <tr><td style="padding:12px 32px 0 32px;${font}"><p style="margin:0;font-size:16px;line-height:1.6;color:#59677b;">${escape(copy.body)}</p></td></tr>
          <tr><td style="padding:28px 32px 32px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#3266d9" style="border-radius:10px;">
              <a href="${escape(input.runUrl)}" target="_blank" style="display:inline-block;padding:14px 28px;${font}font-size:16px;line-height:1;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${escape(copy.button)}</a>
            </td></tr></table>
          </td></tr>
        </table>
        <p style="max-width:480px;margin:16px auto 0 auto;${font}font-size:12px;line-height:1.5;color:#8a94a6;">${escape(footer)} <a href="${escape(input.profileUrl)}" style="color:#59677b;">${escape(input.profileUrl)}</a></p>
      </td></tr>
    </table>
  </body>
</html>`;
  const text = [name, copy.headline, "", copy.body, "", `${copy.button}: ${input.runUrl}`, "", `${footer} ${input.profileUrl}`].filter((line, index) => index > 0 || line).join("\n");
  return { subject, html, text };
}
