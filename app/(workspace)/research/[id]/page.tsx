import { getCopy } from "@/i18n/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/workspace";
import { researchDetail } from "@/lib/research-service";
import { ResearchRunView } from "@/components/research-run";
export async function generateMetadata() {
  const copy = await getCopy();
  return {
    title: copy("Research run & report"),
    description: copy("Private VentureLens evidence research progress, sources, and complete reports."),
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, user } = await requireUser();
  const detail = await researchDetail(supabase, user.id, id);
  if (!detail) notFound();
  return <ResearchRunView initialData={detail} />;
}
