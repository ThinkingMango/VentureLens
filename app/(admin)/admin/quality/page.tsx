import { AdminQuality } from "@/components/admin-quality";
import { requireAdministrator } from "@/lib/admin-guard";
import { qualityReport } from "@/lib/admin-runs";
import { parseMetricWindow } from "@/lib/quality-metrics";
import { getCopy } from "@/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const copy = await getCopy();
  return { title: copy("Research quality"), robots: { index: false, follow: false } };
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAdministrator();
  const { days } = await searchParams;
  return <AdminQuality report={await qualityReport(user, parseMetricWindow(days))} />;
}
