"use client";
import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";
import { formatDate, formatNumber, messageKey } from "./config";
export type Copy = (
  source: string,
  values?: Record<string, string | number>,
) => string;

// Missing sources already reported in this browser session, so each is logged once.
const reported = new Set<string>();

export function useCopy() {
  const t = useTranslations("ui");
  return useCallback<Copy>(
    (source, values) => {
      const key = messageKey(source);
      if (t.has(key)) return t(key, values);
      // In production the source text is the fallback. In development a missing entry is reported, because the
      // fallback would otherwise show one language's text to everyone without any error.
      if (process.env.NODE_ENV !== "production" && !reported.has(source)) {
        reported.add(source);
        console.warn(`[i18n] No catalogue entry for "${source}" (${key}). Add it with scripts/i18n-merge.mjs.`);
      }
      return source;
    },
    [t],
  );
}
export function useFormats() {
  const locale = useLocale();
  return {
    date: (value: string | Date, includeTime = false) =>
      formatDate(locale, value, includeTime),
    number: (value: number, options?: Intl.NumberFormatOptions) =>
      formatNumber(locale, value, options),
    usd: (value: number, digits = 2) =>
      formatNumber(locale, value, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }),
  };
}
