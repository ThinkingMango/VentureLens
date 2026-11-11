import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { getCopy } from "@/i18n/server";
import { readOpportunity, requireUser } from "@/lib/workspace";
import { buildOpportunityExport } from "@/lib/report-export";
import { OpportunityDocument, PrintToolbar } from "@/components/print-document";

export async function generateMetadata() {
  const copy = await getCopy();
  return { title: copy("Print opportunity"), robots: { index: false, follow: false } };
}

/** One opportunity as a printable document, from its full stored record (with source excerpts). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, user } = await requireUser();
  const opportunity = await readOpportunity(supabase, user.id, id);
  if (!opportunity) notFound();
  const [copy, locale] = await Promise.all([getCopy(), getLocale()]);
  const doc = buildOpportunityExport(opportunity, { copy, locale, generatedAt: new Date() });
  return (
    <>
      <PrintToolbar backHref={`/opportunities/${id}`} backLabel={copy("Back to the opportunity")} hint={copy("In the print dialog, choose “Save as PDF” as the destination.")} />
      <article>
        <OpportunityDocument op={doc} />
      </article>
    </>
  );
}
