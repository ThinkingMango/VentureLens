type Identity = {
  email?: string;
  email_confirmed_at?: string | null;
  app_metadata?: Record<string, unknown>;
};

// Administrators are identified only by a server-managed claim in app_metadata
// (set with the service role or the Supabase dashboard). Email addresses and
// user_metadata never grant access.
export function isAdministrator(user: Identity | null | undefined): boolean {
  if (!user?.email_confirmed_at) return false;
  return (
    user.app_metadata?.role === "admin" ||
    user.app_metadata?.is_admin === true
  );
}
