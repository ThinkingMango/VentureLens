"use client";

import { Skeleton } from "@/components/skeletons";
import { useCopy } from "@/i18n/use-copy";

// Outside the workspace (landing, auth, onboarding): a page heading and two cards, faded in after a short delay.
export default function Loading() {
  const copy = useCopy();
  return (
    <div role="status" className="skeleton-screen mx-auto flex min-h-64 w-full max-w-5xl flex-col gap-6 p-6" aria-label={copy("Please wait…")}>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-12 max-w-lg" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="surface h-56" />
        <div className="surface h-56" />
      </div>
      <span className="sr-only">{copy("Please wait…")}</span>
    </div>
  );
}
