import { notFound } from "next/navigation";
import { z } from "zod";
import { loadWorkspace } from "@/lib/workspace";
import { LiveOpportunityDetail } from "@/components/live-workspace";
export const metadata = {
  title: "Opportunity",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const data = await loadWorkspace();
  const opportunity = data.opportunities.find((item) => item.id === id);
  if (!opportunity) notFound();
  return <LiveOpportunityDetail opportunity={opportunity} />;
}
