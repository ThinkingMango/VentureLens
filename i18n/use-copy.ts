"use client";
import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";
import { formatDate, formatNumber, messageKey } from "./config";
export type Copy = (
  source: string,
  values?: Record<string, string | number>,
) => string;

export function useCopy() {
  const t = useTranslations("ui");
  return useCallback<Copy>(
    (source, values) => {
      const key = messageKey(source);
      return t.has(key) ? t(key, values) : source;
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
