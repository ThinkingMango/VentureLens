import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Dashboard } from "@/components/dashboard";
import { ResearchConfig } from "@/components/research-config";
import { ResearchLibrary } from "@/components/research-library";
import { ResearchResults } from "@/components/research-results";
import { DemoOpportunityDetail } from "@/components/opportunity-detail";
import { Onboarding } from "@/components/onboarding";
import { Billing } from "@/components/billing";
import { opportunities, demoOutcome, demoVerifyOutcome } from "@/lib/demo-data";
import { DemoOutcome, DemoVerifyOutcome } from "@/components/research-outcome";
export default async function DemoPage({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ path = [] }, query] = await Promise.all([params, searchParams]);
  if (!path.length) redirect("/demo/dashboard");
  const route = path.join("/");
  if (route === "onboarding") return <Onboarding />;
  const pages: Record<string, React.ReactNode> = {
    dashboard: <Dashboard />,
    research: <ResearchLibrary />,
    "research/new": <ResearchConfig />,
    "research/results": <ResearchResults />,
    "research/no-result": <DemoOutcome outcome={demoOutcome} />,
    "research/verify-example": <DemoVerifyOutcome outcome={demoVerifyOutcome} />,
    saved: <ResearchResults savedOnly />,
    profile: <Onboarding editing />,
    billing: <Billing />,
  };
  let content = pages[route];
  if (path.length === 2 && path[0] === "opportunities") {
    const opportunity = opportunities.find((item) => item.id === path[1]);
    if (opportunity)
      content = (
        <DemoOpportunityDetail opportunity={opportunity} initialTab={typeof query.tab === "string" ? query.tab : undefined} />
      );
  }
  if (!content) notFound();
  return <AppShell>{content}</AppShell>;
}
