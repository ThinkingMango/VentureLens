/** The identifier Next.js attaches to server errors; it matches the server log entry for that failure. */
export function errorDigest(error: unknown): string | null {
  return error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest
    ? error.digest
    : null;
}
