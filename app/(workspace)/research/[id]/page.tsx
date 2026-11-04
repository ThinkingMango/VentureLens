import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/workspace";
import { researchDetail } from "@/lib/research-service";
import { ResearchRunView } from "@/components/research-run";
export const metadata = { title: "研究任务与报告", description: "VentureLens 私有证据研究进度、来源与完整报告。" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, user } = await requireUser();
  const detail = await researchDetail(supabase, user.id, id);
  if (!detail) notFound();
  return <ResearchRunView initialData={detail} />;
}
