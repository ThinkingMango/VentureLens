import { timingSafeEqual } from "node:crypto";

/** Whether the request carries the deployment's CRON_SECRET, as Vercel Cron sends it. Without a secret, nothing passes. */
export function cronAuthorized(header: string | null, secret: string | undefined) {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
