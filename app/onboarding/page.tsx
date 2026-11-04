import { getCopy } from "@/i18n/server";
import { Onboarding } from "@/components/onboarding";
import { WorkspaceProvider } from "@/components/demo-provider";
import { loadWorkspace } from "@/lib/workspace";
export async function generateMetadata() {
  const copy = await getCopy();
  return {
    title: copy("Founder onboarding"),
    robots: { index: false, follow: false },
  };
}
export const dynamic = "force-dynamic";
export default async function Page() {
  const data = await loadWorkspace();
  return (
    <WorkspaceProvider key={data.userId} initialData={data}>
      <Onboarding />
    </WorkspaceProvider>
  );
}
