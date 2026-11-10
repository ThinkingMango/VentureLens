"use client";
import type { Copy } from "@/i18n/use-copy";

// Labels for codes shown on the operator pages. Each is a literal copy() call, so the catalogue test sees it.

export function statusLabel(copy: Copy, status: string) {
  switch (status) {
    case "pending": return copy("Queued");
    case "running": return copy("Running");
    case "completed": return copy("Completed");
    case "failed": return copy("Failed");
    default: return status;
  }
}
export function modeLabel(copy: Copy, mode: string | null) {
  switch (mode) {
    case "founder": return copy("Founder fit");
    case "market": return copy("Market first");
    case "combined": return copy("Founder + market");
    default: return "—";
  }
}
export function languageLabel(copy: Copy, language: string | null) {
  switch (language) {
    case "en": return copy("English");
    case "zh-Hans": return copy("Simplified Chinese");
    case "zh-Hant": return copy("Traditional Chinese");
    default: return "—";
  }
}
export function gateLabel(copy: Copy, gate: string) {
  switch (gate) {
    case "passed": return copy("Passed the gate");
    case "failed": return copy("Did not pass");
    default: return copy("Not evaluated yet");
  }
}
export function retrievalLabel(copy: Copy, retrieval: string) {
  switch (retrieval) {
    case "searched": return copy("Searched");
    case "skipped": return copy("Search found nothing readable");
    default: return copy("Not reached");
  }
}
export function formatDuration(copy: Copy, ms: number | null) {
  if (ms === null) return "—";
  const seconds = Math.round(ms / 1000);
  return seconds < 120 ? copy("{n} s", { n: seconds }) : copy("{n} min", { n: Math.round(seconds / 6) / 10 });
}
