"use client";
import { errorDigest } from "@/lib/error-digest";

// Shown only when the root layout itself fails. It replaces that layout, so the translation provider, fonts and
// global styles are unavailable: the page is self-contained and states its message in all three interface languages.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = errorDigest(error);
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#f5f3ed", color: "#17352d" }}>
        <title>VentureLens AI</title>
        <main style={{ maxWidth: "28rem", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Something went wrong.</h1>
          <p style={{ margin: 0 }} lang="zh-Hans">出现问题，请重试。</p>
          <p style={{ margin: 0 }} lang="zh-Hant">發生問題，請再試一次。</p>
          {digest && <p style={{ margin: 0, fontFamily: "monospace", fontSize: "0.875rem" }}>Reference: {digest}</p>}
          <button type="button" onClick={() => retry()} style={{ minHeight: "2.75rem", borderRadius: "0.75rem", border: 0, background: "#245846", color: "#fff", fontSize: "1rem", cursor: "pointer" }}>
            Try again · 重试 · 再試一次
          </button>
        </main>
      </body>
    </html>
  );
}
