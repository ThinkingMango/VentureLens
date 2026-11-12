import { randomBytes } from "node:crypto";

// Share a report (enhancement plan WP-26) or one opportunity in it. Pure rules shared by the API route, the shared page and the tests.

/** A link's secret: 32 random bytes as base64url, 43 characters, the same shape the database checks. */
export function newShareToken(): string {
  return randomBytes(32).toString("base64url");
}
export const SHARE_TOKEN = /^[A-Za-z0-9_-]{43}$/;
export function isShareToken(value: unknown): value is string {
  return typeof value === "string" && SHARE_TOKEN.test(value);
}
/** The public path of a shared report. */
export function sharePath(token: string): string {
  return `/s/${token}`;
}
/** How long a link lasts. The database sets each link's expiry (report_shares.expires_at default); keep them equal. */
export const SHARE_DAYS = 90;
export type ShareState = { url: string; created_at: string; expires_at: string } | null;
/** What a link is for: a whole report, or one opportunity in a report. */
export type ShareTarget = { kind: "report"; runId: string } | { kind: "opportunity"; opportunityId: string };

/** What each kind of link shows and never shows, said before the founder makes it. English sources for copy(). */
export const shareWording = {
  report: {
    title: "Share this report",
    description: "Anyone with the link can read the report without signing in. It is not listed or indexed anywhere, it stops working after 90 days, and you can turn it off at any time.",
    shows: "The summary, each opportunity's scores, claims, sources, economics and review, and the ideas that did not pass.",
    never: "Your profile, your brief, each score's rationale, your sprints, notes, ratings or email address.",
    warning: "Other report text can still mention your skills or background where they affected an idea. Read the report before you share it.",
  },
  opportunity: {
    title: "Share this opportunity",
    description: "Anyone with the link can read this opportunity without signing in. It is not listed or indexed anywhere, it stops working after 90 days, and you can turn it off at any time.",
    shows: "This opportunity only: its scores, claims, sources, economics, review and next steps.",
    never: "The rest of the report and its other ideas, your profile, your brief, the score's rationale, your sprints, notes, ratings or email address.",
    warning: "The opportunity's text can still mention your skills or background where they shaped the idea. Read it before you share it.",
  },
} as const;
