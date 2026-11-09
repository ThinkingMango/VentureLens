"use client";

import { useCopy } from "@/i18n/use-copy";

export default function Loading() {
  const copy = useCopy();
  return (
    <div role="status" className="mx-auto flex min-h-64 w-full max-w-5xl flex-col gap-6 p-6" aria-label={copy("Please wait…")}>
      <div className="h-4 w-32 animate-pulse rounded-full bg-secondary motion-reduce:animate-none" />
      <div className="h-12 max-w-lg animate-pulse rounded-xl bg-secondary motion-reduce:animate-none" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-56 animate-pulse rounded-2xl border bg-card motion-reduce:animate-none" />
        <div className="h-56 animate-pulse rounded-2xl border bg-card motion-reduce:animate-none" />
      </div>
      <span className="sr-only">{copy("Please wait…")}</span>
    </div>
  );
}
