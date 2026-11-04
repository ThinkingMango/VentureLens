import { PasswordScreen } from "@/components/password-screen";
export const metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <PasswordScreen mode="verify" />;
}
