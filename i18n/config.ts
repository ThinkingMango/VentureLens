export const locales = ["en", "zh-Hans", "zh-Hant"] as const;
export type Locale = (typeof locales)[number];
export const localeCookie = "venturelens-locale";
export const localeNames: Record<Locale, string> = {
  en: "English",
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
};
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && locales.includes(value as Locale);
}
export function negotiateLocale(
  preference?: string,
  acceptLanguage = "",
): Locale {
  if (isLocale(preference)) return preference;
  const languages = acceptLanguage
    .split(",")
    .map((entry, order) => {
      const [tag, ...parameters] = entry.trim().split(";");
      const quality = parameters.find((p) => p.trim().startsWith("q="));
      const q = quality ? Number(quality.trim().slice(2)) : 1;
      return { tag: tag.toLowerCase(), q, order };
    })
    .filter(({ q }) => Number.isFinite(q) && q > 0 && q <= 1)
    .sort((a, b) => b.q - a.q || a.order - b.order);
  for (const { tag } of languages) {
    if (/^en(?:-|$)/.test(tag)) return "en";
    if (/^zh(?:-|$)/.test(tag)) {
      if (tag.split("-").includes("hant")) return "zh-Hant";
      if (tag.split("-").includes("hans")) return "zh-Hans";
      return /-(tw|hk|mo)(?:-|$)/.test(tag) ? "zh-Hant" : "zh-Hans";
    }
  }
  return "en";
}
export function messageKey(source: string) {
  let hash = 2166136261;
  for (const character of source.replace(/\s+/g, " ").trim()) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return `m${(hash >>> 0).toString(36)}`;
}
export function formatDate(
  locale: string,
  value: string | Date,
  includeTime = false,
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
    timeZone: "UTC",
  }).format(new Date(value));
}
export function formatNumber(
  locale: string,
  value: number,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(locale, options).format(value);
}
