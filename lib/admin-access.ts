export const ADMIN_EMAIL = "ventures@smartmango.ai";

type Identity = {
  email?: string;
  email_confirmed_at?: string | null;
  app_metadata?: Record<string, unknown>;
};

export function isAdministrator(user: Identity | null | undefined): boolean {
  if (!user?.email_confirmed_at) return false;
  return (
    user.email?.toLowerCase() === ADMIN_EMAIL ||
    user.app_metadata?.role === "admin" ||
    user.app_metadata?.is_admin === true
  );
}
