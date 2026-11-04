import { getCopy } from "@/i18n/server";
import { PasswordScreen } from "@/components/password-screen";
import { requireUser } from "@/lib/workspace";
export async function generateMetadata() {
  const copy = await getCopy();
  return {
    title: copy("Choose a new password"),
    robots: { index: false, follow: false },
  };
}
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireUser();
  return <PasswordScreen mode="reset" />;
}
