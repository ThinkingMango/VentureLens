import { getCopy } from "@/i18n/server";
import { AuthScreen } from "@/components/auth-screen";
export async function generateMetadata() {
  const copy = await getCopy();
  return {
    title: copy("Sign up"),
    description: copy(
      "Sign in or create an account with your email. No password needed.",
    ),
    robots: { index: false, follow: false },
  };
}
export default function Page() {
  return <AuthScreen />;
}
