import { getCopy } from "@/i18n/server";
import { PasswordScreen } from "@/components/password-screen";
export async function generateMetadata() {
  const copy = await getCopy();
  return {
    title: copy("Reset your password"),
    robots: { index: false, follow: false },
  };
}
export default function Page() {
  return <PasswordScreen mode="recover" />;
}
