import { PasswordScreen } from "@/components/password-screen";
export const metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <PasswordScreen mode="recover" />;
}
