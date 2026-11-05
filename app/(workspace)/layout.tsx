import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { WorkspaceProvider } from "@/components/demo-provider";
import { loadWorkspace, requireUser } from "@/lib/workspace";
import { isAdministrator } from "@/lib/admin-access";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await loadWorkspace();
  const { user } = await requireUser();
  if (!data.onboarded) redirect("/onboarding");
  return (
    <WorkspaceProvider key={data.userId} initialData={data}>
      <AppShell isAdmin={isAdministrator(user)}>{children}</AppShell>
    </WorkspaceProvider>
  );
}
