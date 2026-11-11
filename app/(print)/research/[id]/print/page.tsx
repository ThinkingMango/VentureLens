import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { getCopy } from "@/i18n/server";
import { requireUser } from "@/lib/workspace";
import { researchDetail } from "@/lib/research-service";
import { buildReportExport } from "@/lib/report-export";
import { PrintToolbar, ReportDocument } from "@/components/print-document";

export async function generateMetadata() {
  const copy = await getCopy();
  return { title: copy("Print report"), robots: { index: false, follow: false } };
}

/** A completed report as a printable document. The brief is added only with `?brief=1` ("Include my brief"). */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ brief?: string | string[] }> }) {
  const [{ id }, { brief }] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, user } = await requireUser();
  const detail = await researchDetail(supabase, user.id, id);
  if (!detail || detail.status !== "completed" || !detail.report) notFound();
  const [copy, locale] = await Promise.all([getCopy(), getLocale()]);
  const doc = buildReportExport(
    { id: detail.id, created_at: detail.created_at, completed_at: detail.completed_at, report: detail.report, outcome: detail.outcome },
    { copy, locale, generatedAt: new Date(), includeBrief: brief === "1", brief: detail.configuration.brief },
  );
  return (
    <>
      <PrintToolbar backHref={`/research/${id}`} backLabel={copy("Back to the report")} hint={copy("In the print dialog, choose “Save as PDF” as the destination.")} />
      <article>
        <ReportDocument doc={doc} />
      </article>
    </>
  );
}
