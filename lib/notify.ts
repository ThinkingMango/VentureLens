import "server-only";
import { createTranslator } from "next-intl";
import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLocale, messageKey, type Locale } from "@/i18n/config";
import en from "@/messages/en.json";
import zhHans from "@/messages/zh-Hans.json";
import zhHant from "@/messages/zh-Hant.json";
import {
  buildRunEmail, notificationMode, notificationOutcome, siteOrigin, smtpConfig,
  type EmailMessage, type NotifyEnv, type SmtpConfig, type Translate,
} from "@/lib/notify-core";

// Notifications (spec WP-08). One provider interface, so another email service can replace SMTP in one place.
/** `headers`: extra headers, such as List-Unsubscribe on the weekly email (WP-17). */
export type OutgoingEmail = EmailMessage & { to: string; idempotencyKey: string; headers?: Record<string, string> };
export interface NotificationProvider {
  send(message: OutgoingEmail): Promise<void>;
}

type Transport = { sendMail(options: Record<string, unknown>): Promise<unknown> };
/**
 * SMTP (decision D1: the Hostinger mailbox). The password is read on the server only. SMTP has no idempotency key, so
 * each run's email carries a fixed Message-ID: a retried send is the same message, which mail systems can recognise.
 */
export function smtpProvider(config: SmtpConfig, createTransport: (options: Record<string, unknown>) => Transport = (options) => nodemailer.createTransport(options)): NotificationProvider {
  return {
    async send(message) {
      const transport = createTransport({
        host: config.host, port: config.port, secure: config.secure, requireTLS: !config.secure,
        auth: { user: config.user, pass: config.password },
        connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
      });
      const domain = config.user.split("@")[1] || "localhost";
      try {
        await transport.sendMail({
          from: config.from, to: message.to, replyTo: config.replyTo, subject: message.subject, html: message.html, text: message.text,
          messageId: `<${message.idempotencyKey}@${domain}>`,
          ...(message.headers ? { headers: message.headers } : {}),
        });
      } catch (error) {
        // Never pass the provider's error on: it can echo the address or the server's reply. A short code is enough.
        const code = error && typeof error === "object" && "responseCode" in error ? String((error as { responseCode: unknown }).responseCode) : "SEND";
        throw new Error(`EMAIL_PROVIDER_${code.replace(/[^A-Z0-9]/gi, "").slice(0, 12) || "SEND"}`);
      }
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
 * retry can try again. A duplicate is possible only if the server accepted the first message but the connection failed
 * before it said so; both copies then share one Message-ID.
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
  const smtp = smtpConfig(env);
  const provider = deps.provider ?? (mode.mode === "send" && smtp ? smtpProvider(smtp) : dryRunProvider());
  try {
    await provider.send({ ...email, to, idempotencyKey: `run-finished-${ctx.runId}` });
  } catch (sendError) {
    await client.from("research_runs").update({ notified_at: null }).eq("id", ctx.runId).eq("user_id", ctx.userId);
    throw sendError;
  }
  return mode.mode === "send" ? "sent" : "dry-run";
}
