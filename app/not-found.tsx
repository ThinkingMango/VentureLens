"use client";

import { useCopy } from "@/i18n/use-copy";
import Link from "next/link";
import { Brand } from "@/components/shared";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  const copy = useCopy();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <Brand />
      <h1 className="text-3xl font-semibold">
        {copy("This opportunity isn’t here.")}
      </h1>
      <p className="text-muted-foreground">
        {copy(
          "The page may have moved, or the demo opportunity doesn’t exist.",
        )}
      </p>
      <Button asChild>
        <Link href="/dashboard">{copy("Back to your workspace")}</Link>
      </Button>
    </main>
  );
}
