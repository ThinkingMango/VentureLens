import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { localeCookie, negotiateLocale } from "./config";

export default getRequestConfig(async () => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = negotiateLocale(
    cookieStore.get(localeCookie)?.value,
    headerStore.get("accept-language") ?? "",
  );
  return {
    locale,
    timeZone: "UTC",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
