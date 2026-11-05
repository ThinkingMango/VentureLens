"use client";

import { LoaderCircle } from "lucide-react";
import { useCopy } from "@/i18n/use-copy";

export default function Loading() {
  const copy = useCopy();
  return (
    <div role="status" className="flex min-h-64 items-center justify-center gap-3 p-6 text-muted-foreground">
      <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary" />
      <p>{copy("Please wait…")}</p>
    </div>
  );
}
