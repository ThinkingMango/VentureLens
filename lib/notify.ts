import "server-only";
import { createTranslator } from "next-intl";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLocale, messageKey, type Locale } from "@/i18n/config";
import en from "@/messages/en.json";
import zhHans from "@/messages/zh-Hans.json";
import zhHant from "@/messages/zh-Hant.json";
import {
  DEFAULT_FROM, DEFAULT_REPLY_TO, buildRunEmail, notificationMode, notificationOutcome, siteOrigin,
  type EmailMessage, type NotifyEnv, type Translate,
} from "@/lib/notify-core";

// Notifications (spec WP-08). One provider interface, so another email service can replace Resend in one place.
export type OutgoingEmail = EmailMessage & { to: string; idempotencyKey: string };
export interface NotificationProvider {
  send(message: OutgoingEmail): Promise<void>;
}

/** Resend's HTTP API. The key is read on the server only. The idempotency key makes a retried send deliver once. */
export function resendProvider(apiKey: string, from = DEFAULT_FROM, replyTo = DEFAULT_REPLY_TO, fetcher: typeof fetch = fetch): NotificationProvider {
  return {
    async send(message) {
      const response = await fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": message.idempotencyKey },
        body: JSON.stringify({ from, to: [message.to], reply_to: replyTo, subject: message.subject, html: message.html, text: message.text }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`EMAIL_PROVIDER_${response.status}`);
    },
  };
}
/** Logs what would be sent, without the recipient's address or the body. */
export function dryRunProvider(log: (line: string, details: Record<string, unknown>) => void = (line, details) => console.info(line, details)): NotificationProvider {
  return {
    async send(message) {
      log("[notify] dry run: email not sent", { subject: message.subject, key: message.idempotencyKey, recipientDomain: message.to.split("@")[1] ?? null });
    },
  };
}

const catalogs: Record<Locale, typeof en> = { en, "zh-Hans": zhHans, "zh-Hant": zhHant };
/** Translates fixed email lines into the run's report language, falling back to English for a missing entry. */
export function translatorFor(locale: Locale): Translate {
  const t = createTranslator({ locale, messages: catalogs[locale], namespace: "ui" });
  const fallback = createTranslator({ locale: "en", messages: en, namespace: "ui" });
  return (source, values) => {
    const key = messageKey(source) as Parameters<typeof t>[0];
    try {
      return (catalogs[locale].ui as Record<string, string>)[key] ? t(key, values) : fallback(key, values);
    } catch {
      return source;
    }
  };
}

type Context = { runId: string; userId: string };
export type NotifyResult = "sent" | "dry-run" | "off" | "not-final" | "opted-out" | "already-notified" | "no-recipient" | "no-site-url";

/**
 * Emails the founder once when their run finishes. Called from the workflow's last step. The run is claimed by setting
 * notified_at from null, so a retried step never sends twice; if sending fails, the claim is released so the step's
 * retry can try again (the provider's idempotency key stops a duplicate if the first send in fact went through).
 */
export async function notifyRunFinished(ctx: Context, deps: { env?: NotifyEnv; provider?: NotificationProvider; client?: ReturnType<typeof createAdminClient> } = {}): Promise<NotifyResult> {
  const env = deps.env ?? (process.env as NotifyEnv);
  const mode = notificationMode(env);
  if (mode.mode === "off") return "off";
  const origin = siteOrigin(env);
  if (!origin) return "no-site-url";
  const client = deps.client ?? createAdminClient();
  const { data: run, error } = await client.from("research_runs")
    .select("status,error_code,quota_released,notified_at,name:configuration->brief->>name,mode:configuration->brief->>discovery_mode,language:configuration->brief->>language")
    .eq("id", ctx.runId).eq("user_id", ctx.userId).maybeSingle();
  if (error) throw new Error("NOTIFY_RUN_UNAVAILABLE");
  if (!run || run.notified_at) return run ? "already-notified" : "not-final";
  const { count } = await client.from("opportunities").select("id", { count: "exact", head: true }).eq("run_id", ctx.runId).eq("user_id", ctx.userId);
  const outcome = notificationOutcome({ status: run.status, error_code: run.error_code, quota_released: run.quota_released, mode: run.mode, opportunities: count ?? 0 });
  if (!outcome) return "not-final";
  const { data: profile } = await client.from("founder_profiles").select("notify_on_complete").eq("user_id", ctx.userId).maybeSingle();
  if (profile?.notify_on_complete === false) return "opted-out";
  const { data: user } = await client.auth.admin.getUserById(ctx.userId);
  const to = user?.user?.email_confirmed_at ? user.user.email : null;
  if (!to) return "no-recipient";

  const { data: claimed, error: claimError } = await client.from("research_runs")
    .update({ notified_at: new Date().toISOString() }).eq("id", ctx.runId).eq("user_id", ctx.userId).is("notified_at", null).select("id");
  if (claimError) throw new Error("NOTIFY_CLAIM_FAILED");
  if (!claimed?.length) return "already-notified";

  const lang: Locale = isLocale(run.language) ? run.language : "en";
  const email = buildRunEmail({ outcome, name: run.name ?? "", runUrl: `${origin}/research/${ctx.runId}`, profileUrl: `${origin}/profile`, lang }, translatorFor(lang));
  const provider = deps.provider ?? (mode.mode === "send" ? resendProvider(env.RESEND_API_KEY!, env.NOTIFY_FROM || DEFAULT_FROM, env.NOTIFY_REPLY_TO || DEFAULT_REPLY_TO) : dryRunProvider());
  try {
    await provider.send({ ...email, to, idempotencyKey: `run-finished-${ctx.runId}` });
  } catch (sendError) {
    await client.from("research_runs").update({ notified_at: null }).eq("id", ctx.runId).eq("user_id", ctx.userId);
    throw sendError;
  }
  return mode.mode === "send" ? "sent" : "dry-run";
}
