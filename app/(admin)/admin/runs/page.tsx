import { AdminRuns } from "@/components/admin-runs";
import { requireAdministrator } from "@/lib/admin-guard";
import { listRuns } from "@/lib/admin-runs";
import { parseRunFilters } from "@/lib/admin-runs-core";
import { researchErrors } from "@/lib/research-core";
import { getCopy } from "@/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const copy = await getCopy();
  return { title: copy("Research runs"), robots: { index: false, follow: false } };
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAdministrator();
  const filters = parseRunFilters(await searchParams);
  return <AdminRuns list={await listRuns(user, filters)} filters={filters} errorCodes={Object.keys(researchErrors)} />;
}
