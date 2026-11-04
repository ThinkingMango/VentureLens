import { getTranslations } from "next-intl/server";
import { messageKey } from "./config";
export async function getCopy() {
  const t = await getTranslations("ui");
  return (source: string) => t(messageKey(source));
}
