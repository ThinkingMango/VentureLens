import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCopy } from "@/i18n/server";
import { parseEmailLink } from "@/lib/email-auth";
import { safeReturnPath } from "@/lib/workspace-schema";
import { Brand } from "@/components/shared";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ContinueButton } from "@/components/confirm-continue-button";
import { Button } from "@/components/ui/button";
import { confirmEmailLink } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getCopy();
  return {
    title: copy("Confirm sign-in"),
    robots: { index: false, follow: false },
    // The URL carries the one-time token hash, so never send it to other
    // origins. "no-referrer" would also make plain form posts send
    // Origin: null, which Next.js rejects as a cross-site Server Action.
    referrer: "same-origin",
  };
}

// Opening this page never signs anyone in. Link scanners such as Microsoft
// Defender Safe Links open every link in an email, so verifying on GET would
// use up the token before the founder clicks. Verification waits for the form.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (typeof value === "string") params.set(key, value);
  const link = parseEmailLink(params);
  if (!link) redirect("/login?notice=callback");
  const copy = await getCopy();
  return (
    <main className="flex min-h-screen flex-col justify-between gap-10 bg-card p-6 sm:p-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Brand />
        <LanguageSwitcher />
      </header>
      <div className="mx-auto flex w-full max-w-sm flex-col gap-7">
        <ShieldCheck className="size-10 text-primary" strokeWidth={1.4} />
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold text-balance">
            {copy("Continue to VentureLens")}
          </h1>
          <p className="text-muted-foreground text-pretty">
            {copy(
              "For your security, confirm that you want to sign in on this device.",
            )}
          </p>
        </div>
        <form action={confirmEmailLink} className="flex flex-col gap-4">
          <input type="hidden" name="token_hash" value={link.token_hash} />
          <input type="hidden" name="type" value={link.type} />
          <input
            type="hidden"
            name="next"
            value={safeReturnPath(params.get("next"))}
          />
          <ContinueButton />
        </form>
        <p className="text-sm text-muted-foreground">
          {copy(
            "This link works once. If it has expired, request a new email from the sign-in page.",
          )}
        </p>
        <Button variant="outline" asChild>
          <Link href="/login">{copy("Back to sign in")}</Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {copy("Secure authentication · Your workspace stays private.")}
      </p>
    </main>
  );
}
