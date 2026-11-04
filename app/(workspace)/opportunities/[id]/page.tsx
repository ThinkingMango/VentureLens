import { notFound } from "next/navigation";
import { opportunities } from "@/lib/demo-data";
import { OpportunityDetail } from "@/components/opportunity-detail";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return {
    title:
      opportunities.find((o) => o.id === id)?.title || "Opportunity not found",
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const opportunity = opportunities.find((o) => o.id === id);
  if (!opportunity) notFound();
  return <OpportunityDetail opportunity={opportunity} initialTab={query.tab} />;
}
