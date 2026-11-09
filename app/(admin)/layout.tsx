import { AppShell } from "@/components/app-shell";
import { WorkspaceProvider } from "@/components/demo-provider";
import { loadWorkspace, requireUser } from "@/lib/workspace";
import { isAdministrator } from "@/lib/admin-access";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

// The same workspace shell as app/(workspace)/layout.tsx, without its onboarding redirect: provider settings are an
// operator task, so an administrator who never filled in a founder profile can still reach them. The admin page and
// its API check the administrator claim themselves.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const data = await loadWorkspace();
  const { user } = await requireUser();
  return (
    <WorkspaceProvider key={data.userId} initialData={data}>
      <AppShell isAdmin={isAdministrator(user)}>{children}</AppShell>
    </WorkspaceProvider>
  );
}
