// Public contact addresses. Shown verbatim in every language.
export const supportEmail = "support@smartmango.ai";
export const privacyEmail = "privacy@smartmango.ai";
// Bump when the privacy notice changes materially.
export const privacyUpdatedAt = "2026-11-09T00:00:00Z";

export function mailto(address: string, subject?: string) {
  return subject
    ? `mailto:${address}?subject=${encodeURIComponent(subject)}`
    : `mailto:${address}`;
}
