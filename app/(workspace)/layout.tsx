import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { WorkspaceProvider } from "@/components/demo-provider";
import { loadWorkspace } from "@/lib/workspace";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await loadWorkspace();
  if (!data.onboarded) redirect("/onboarding");
  return (
    <WorkspaceProvider key={data.userId} initialData={data}>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
