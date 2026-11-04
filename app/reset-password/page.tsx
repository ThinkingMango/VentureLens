import { PasswordScreen } from "@/components/password-screen";
import { requireUser } from "@/lib/workspace";
export const metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireUser();
  return <PasswordScreen mode="reset" />;
}
