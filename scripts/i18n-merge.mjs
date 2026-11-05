// Merge UI copy into all three message catalogues.
// Usage: node scripts/i18n-merge.mjs entries.json
// entries.json: [{ "en": "English source", "hans": "简体", "hant": "繁體" }, ...]
// The key is messageKey(en) from i18n/config.ts; missing hans/hant fall back to en.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "messages");
const key = (s) => { let h = 2166136261; for (const c of s.replace(/\s+/g, " ").trim()) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return "m" + (h >>> 0).toString(36); };
const entries = JSON.parse(readFileSync(process.argv[2], "utf8"));
const files = { en: "en", hans: "zh-Hans", hant: "zh-Hant" };
const catalogs = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, JSON.parse(readFileSync(`${root}/${f}.json`, "utf8"))]));
let added = 0;
for (const e of entries) {
  const k = key(e.en);
  if (!(k in catalogs.en.ui)) added++;
  for (const lang of Object.keys(files)) catalogs[lang].ui[k] = e[lang] ?? e.en;
}
for (const [k, f] of Object.entries(files)) writeFileSync(`${root}/${f}.json`, JSON.stringify(catalogs[k], null, 2) + "\n");
console.log(`merged ${entries.length} entries (${added} new keys)`);
