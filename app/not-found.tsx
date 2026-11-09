"use client";

import { useCopy } from "@/i18n/use-copy";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/shared";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  const copy = useCopy();
  const pathname = usePathname();
  const workspaceHref = pathname?.startsWith("/demo/") ? "/demo/dashboard" : "/dashboard";
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <Brand />
      <h1 className="text-3xl font-semibold">
        {copy("This page isn’t here.")}
      </h1>
      <p className="text-muted-foreground">
        {copy(
          "The link may be out of date, or the page has moved.",
        )}
      </p>
      <Button asChild>
        <Link href={workspaceHref}>{copy("Back to your workspace")}</Link>
      </Button>
    </main>
  );
}
