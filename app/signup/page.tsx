import { getCopy } from "@/i18n/server";
import { AuthScreen } from "@/components/auth-screen";
export async function generateMetadata() {
  const copy = await getCopy();
  return { title: copy("Sign up") };
}
export default function Page() {
  return <AuthScreen signup />;
}
