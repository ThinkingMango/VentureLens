import { getLocale } from "next-intl/server";
import { getCopy } from "@/i18n/server";
import { loadSharedReport } from "@/lib/shares";
import { buildReportExport } from "@/lib/report-export";
import { ReportDocument } from "@/components/print-document";

export async function generateMetadata() {
  const copy = await getCopy();
  return { title: copy("Shared research report") };
}

/**
 * A report shared by its founder (WP-26). Anyone with the link can read it; nothing else is shown: no brief, no
 * profile, no score rationale (it draws on the founder's background), no sprints, ratings or notes. A link that has
 * expired (after 90 days), was turned off, or whose report was deleted shows a plain notice.
 */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [shared, copy, locale] = await Promise.all([loadSharedReport(token).catch(() => null), getCopy(), getLocale()]);
  if (!shared) {
    return (
      <article>
        <h1>{copy("This link is no longer available")}</h1>
        <p className="text-muted-foreground">{copy("Links last 90 days. This one has expired, or the person who shared it turned it off or deleted the report.")}</p>
      </article>
    );
  }
  const doc = buildReportExport(
    { id: shared.id, created_at: shared.created_at, completed_at: shared.completed_at, report: shared.report, outcome: shared.outcome },
    { copy, locale, generatedAt: shared.completed_at ?? shared.created_at, shared: true },
  );
  return (
    <article>
      <ReportDocument doc={doc} />
    </article>
  );
}
