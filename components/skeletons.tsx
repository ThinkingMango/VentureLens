"use client";

import { useCopy } from "@/i18n/use-copy";
import { cn } from "@/lib/utils";

/**
 * Loading placeholders shaped like the page that is coming, so the layout does not jump when it arrives.
 * The whole fallback fades in after a short delay (globals.css .skeleton-screen): a fast navigation never flashes it.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton", className)} />;
}

function Screen({ children, className }: { children: React.ReactNode; className?: string }) {
  const copy = useCopy();
  return (
    <div role="status" aria-label={copy("Please wait…")} className={cn("skeleton-screen flex flex-col gap-6", className)}>
      {children}
      <span className="sr-only">{copy("Please wait…")}</span>
    </div>
  );
}

/** A workspace page: heading, a row of figures, then cards. Fits the overview, research, saved and profile pages. */
export function PageSkeleton() {
  return (
    <Screen>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full max-w-md md:h-12" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="surface flex flex-col gap-3 p-5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="surface flex flex-col gap-4 p-6">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="mt-2 h-20 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </Screen>
  );
}

/** The opportunity page: header card, tab bar, then the panel with the score card beside it on wide screens. */
export function OpportunitySkeleton() {
  return (
    <Screen>
      <Skeleton className="h-4 w-32" />
      <div className="surface flex flex-col gap-4 p-5 sm:p-6">
        <Skeleton className="h-10 w-full max-w-xl md:h-12" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-2/3 max-w-lg" />
        <div className="mt-2 flex gap-2">
          <Skeleton className="h-11 w-36 rounded-lg" />
          <Skeleton className="h-11 w-24 rounded-lg" />
        </div>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="surface flex flex-col gap-4 p-6 xl:order-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-6 w-full rounded-lg" />
        </div>
        <div className="flex flex-col gap-4 xl:order-1">
          <div className="flex gap-6 border-b pb-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-4 w-16" />
            ))}
          </div>
          <div className="surface flex flex-col gap-4 p-6 md:p-8">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      </div>
    </Screen>
  );
}
