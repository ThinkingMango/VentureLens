import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/workspace";
import { isAdministrator } from "@/lib/admin-access";

/**
 * The first call of every operator page. A signed-out visitor is redirected to sign-in by requireUser; a signed-in
 * user without the administrator claim gets a plain 404, so the page does not reveal that it exists.
 */
export async function requireAdministrator() {
  const { user } = await requireUser();
  if (!isAdministrator(user)) notFound();
  return user;
}
