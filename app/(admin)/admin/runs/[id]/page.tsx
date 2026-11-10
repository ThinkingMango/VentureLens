import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminRunDetail } from "@/components/admin-run-detail";
import { requireAdministrator } from "@/lib/admin-guard";
import { runInspection } from "@/lib/admin-runs";
import { getCopy } from "@/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const copy = await getCopy();
  return { title: copy("Research run"), robots: { index: false, follow: false } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdministrator();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const inspection = await runInspection(user, id);
  if (!inspection) notFound();
  return <AdminRunDetail inspection={inspection} />;
}
