// Sign-up attribution: which call to action a new account came from. Each sign-up link carries `?from=<source>`; the
// sign-up form passes it to Supabase as account metadata (stored only when the account is created), and /auth/callback
// records one `signup_completed` product event with it. No cookie is set: the value travels with the account itself, so
// it survives both the emailed code and the emailed link, which carries no query parameters of its own.

/** Every place that links to /signup. A link without one of these, or a typed-in /signup, is recorded as "unknown". */
export const signupSources = [
  "landing_hero",
  "landing_close",
  "header",
  "mobile_menu",
  "mobile_bar",
  "footer",
  "pricing_hero",
  "pricing_close",
  "demo",
] as const;

export type SignupSource = (typeof signupSources)[number];

/** The account metadata key that carries the source from the sign-up form to the callback. */
export const SIGNUP_SOURCE_KEY = "signup_source";

/** How recently an account must have been created for its first sign-in to count as a sign-up rather than a login. */
export const NEW_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function parseSignupSource(value: unknown): SignupSource | null {
  return typeof value === "string" && (signupSources as readonly string[]).includes(value) ? (value as SignupSource) : null;
}

/** The sign-up link for a call to action. */
export function signupHref(source: SignupSource): string {
  return `/signup?from=${source}`;
}

/** True when an account was created within the last day: its first sign-in is the sign-up. Unparseable dates are not. */
export function isNewAccount(createdAt: string | null | undefined, now: Date): boolean {
  const created = createdAt ? Date.parse(createdAt) : Number.NaN;
  return Number.isFinite(created) && now.getTime() - created >= 0 && now.getTime() - created <= NEW_ACCOUNT_WINDOW_MS;
}

/** Sign-ups per source for the admin quality page, largest first, with "unknown" last. */
export function signupSourceCounts(events: { props: unknown }[]): { source: SignupSource | "unknown"; count: number }[] {
  const counts = new Map<SignupSource | "unknown", number>();
  for (const event of events) {
    const source = parseSignupSource((event.props as { source?: unknown } | null)?.source) ?? "unknown";
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return [...counts]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => (a.source === "unknown" ? 1 : b.source === "unknown" ? -1 : b.count - a.count || a.source.localeCompare(b.source)));
}
