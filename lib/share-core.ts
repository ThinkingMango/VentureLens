import { randomBytes } from "node:crypto";

// Share a report (enhancement plan WP-26). Pure rules shared by the API route, the shared page and the tests.

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
