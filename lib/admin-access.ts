export const ADMIN_EMAIL = "ventures@smartmango.ai";

type Identity = {
  email?: string;
  email_confirmed_at?: string | null;
};

export function isAdministrator(user: Identity | null | undefined): boolean {
  return !!user?.email_confirmed_at && user.email?.toLowerCase() === ADMIN_EMAIL;
}
