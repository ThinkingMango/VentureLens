import { getCopy } from "@/i18n/server";
import { Onboarding } from "@/components/onboarding";
import { IdeaMemory } from "@/components/idea-memory";
import { NotificationSettings } from "@/components/notification-settings";
import { AccountData } from "@/components/account-data";
export async function generateMetadata() {
  const copy = await getCopy();
  return { title: copy("Founder profile") };
}
export default function Page() {
  return (
    <>
      <Onboarding editing />
      <NotificationSettings />
      <IdeaMemory />
      <AccountData />
    </>
  );
}
