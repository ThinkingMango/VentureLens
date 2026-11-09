"use client";
import { useId, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Languages, LoaderCircle } from "lucide-react";
import { locales, localeNames } from "@/i18n/config";
import { saveLocale } from "@/i18n/actions";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("language");
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative flex min-w-0 shrink-0 flex-col">
      <label htmlFor={id} className="sr-only">
        {t("label")}
      </label>
      <div className="flex min-h-11 items-center gap-1 rounded-lg border bg-card px-2 text-foreground shadow-card">
        {pending ? (
          <LoaderCircle
            className="size-4 shrink-0 animate-spin"
            aria-hidden="true"
          />
        ) : (
          <Languages className="size-4 shrink-0" aria-hidden="true" />
        )}
        <select
          id={id}
          value={locale}
          disabled={pending}
          aria-busy={pending}
          aria-describedby={failed ? `${id}-error` : undefined}
          className="min-h-11 max-w-28 bg-card text-sm text-foreground focus-visible:outline-offset-0"
          onChange={(event) => {
            const value = event.target.value;
            setFailed(false);
            startTransition(async () => {
              try {
                if (!(await saveLocale(value)).ok) setFailed(true);
              } catch {
                setFailed(true);
              }
            });
          }}
        >
          {locales.map((value) => (
            <option key={value} value={value} lang={value}>
              {localeNames[value]}
            </option>
          ))}
        </select>
      </div>
      <span className="sr-only" role="status">
        {pending ? t("pending") : ""}
      </span>
      {failed && (
        <p id={`${id}-error`} role="alert" className="max-w-52 text-sm">
          {t("error")}
        </p>
      )}
    </div>
  );
}
