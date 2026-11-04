import { Onboarding } from "@/components/onboarding";
import { WorkspaceProvider } from "@/components/demo-provider";
import { loadWorkspace } from "@/lib/workspace";
export const metadata = {
  title: "Founder onboarding",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page() {
  const data = await loadWorkspace();
  return (
    <WorkspaceProvider key={data.userId} initialData={data}>
      <Onboarding />
    </WorkspaceProvider>
  );
}
