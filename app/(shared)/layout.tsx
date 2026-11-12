import Link from "next/link";
import { getCopy } from "@/i18n/server";

export const dynamic = "force-dynamic";
// Shared reports are unlisted: never indexed, and no Referer, so opening a source never sends the link's secret to it.
export const metadata = { robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" as const };

/** Shared reports and opportunities (WP-26): the document for anyone with the link, with a plain header and footer. */
export default async function SharedLayout({ children }: { children: React.ReactNode }) {
  const copy = await getCopy();
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Link href="/" className="text-lg font-semibold">VentureLens</Link>
          <span className="text-sm text-muted-foreground">{copy("Shared research · read-only")}</span>
        </div>
      </header>
      <main id="main-content" className="print-doc mx-auto w-full max-w-3xl px-4 py-8 sm:px-8">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-8">
          <p>{copy("Researched with VentureLens: evidence-first research for founders. Scores compare evidence; they are not a chance of success or investment advice.")}</p>
          <Link href="/" className="min-h-11 self-start py-3 font-medium text-primary underline-offset-2 hover:underline">{copy("Research your own idea")}</Link>
        </div>
      </footer>
    </div>
  );
}
