// Browser helpers for calling the app's own JSON API.
//
// A dropped connection makes `fetch` reject with a browser-specific TypeError ("Load failed" in Safari,
// "Failed to fetch" in Chrome) even when the server finished the request. Callers must never show that raw
// text, and should only re-send requests the server treats as idempotent.

export class ApiNetworkError extends Error {
  constructor() {
    super("NETWORK_ERROR");
    this.name = "ApiNetworkError";
  }
}

export type ApiResult = { ok: boolean; status: number; body: Record<string, unknown> };

/** Parses a response body as a JSON object; an empty, HTML or malformed body becomes `{}`. */
export function parseJsonObject(text: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * POSTs JSON and returns the status and parsed body. A network failure (no response, or the body cut off) is
 * re-sent up to `networkRetries` times, so pass a non-zero value only for idempotent requests.
 * Throws ApiNetworkError when no response could be read.
 */
export async function postJson(url: string, payload: unknown, { networkRetries = 0, fetcher = fetch } = {}): Promise<ApiResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetcher(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const text = await response.text();
      return { ok: response.ok, status: response.status, body: parseJsonObject(text) };
    } catch {
      if (attempt >= networkRetries) throw new ApiNetworkError();
      await wait(750 * (attempt + 1));
    }
  }
}

/** GETs JSON with the same safe parsing; throws ApiNetworkError when no response could be read. */
export async function getJson(url: string, { fetcher = fetch } = {}): Promise<ApiResult> {
  try {
    const response = await fetcher(url, { cache: "no-store" });
    return { ok: response.ok, status: response.status, body: parseJsonObject(await response.text()) };
  } catch {
    throw new ApiNetworkError();
  }
}
