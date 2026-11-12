import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createTranslator } from "next-intl";
import ts from "typescript";
import {
  locales,
  negotiateLocale,
  isLocale,
  formatDate,
  formatNumber,
  messageKey,
} from "../i18n/config.ts";
import {
  projectSchema,
  profileSchema,
  emptyProfile,
} from "../lib/workspace-schema.ts";
import { opportunities, researchReports } from "../lib/demo-data.ts";
const catalogs = Object.fromEntries(
  locales.map((locale) => [
    locale,
    JSON.parse(
      readFileSync(
        new URL(`../messages/${locale}.json`, import.meta.url),
        "utf8",
      ),
    ),
  ]),
);
const argumentsOf = (text) =>
  [
    ...new Set([...text.matchAll(/\{(\w+)(?:\}|,)/g)].map((match) => match[1])),
  ].sort();

test("language negotiation validates preferences, qualities, scripts, regions, and fallbacks", () => {
  for (const [cookie, header, expected] of [
    ["zh-Hant", "en", "zh-Hant"],
    ["ar", "zh-TW", "zh-Hant"],
    [undefined, "zh-HK", "zh-Hant"],
    [undefined, "zh-MO", "zh-Hant"],
    [undefined, "zh-CN", "zh-Hans"],
    [undefined, "zh-SG", "zh-Hans"],
    [undefined, "zh", "zh-Hans"],
    [undefined, "zh-Hans-TW", "zh-Hans"],
    [undefined, "zh-Hant-CN", "zh-Hant"],
    [undefined, "en;q=0.4,zh-Hant;q=0.9", "zh-Hant"],
    [undefined, "zh;q=0,en;q=0.5", "en"],
    [undefined, "zh;q=invalid,en;q=1", "en"],
    [undefined, "fr,de;q=0.8", "en"],
    ["../zh-Hant", "en", "en"],
    [undefined, "", "en"],
    [undefined, "zh-Hant;q=0,en;q=0", "en"],
  ])
    assert.equal(negotiateLocale(cookie, header), expected);
  assert.equal(isLocale("zh-TW"), false);
  assert.equal(isLocale("zh-Hant"), true);
});

test("catalogs have key and interpolation parity and every ICU message formats", () => {
  for (const locale of locales) {
    assert.deepEqual(
      Object.keys(catalogs[locale]).sort(),
      Object.keys(catalogs.en).sort(),
    );
    for (const namespace of Object.keys(catalogs.en)) {
      assert.deepEqual(
        Object.keys(catalogs[locale][namespace]).sort(),
        Object.keys(catalogs.en[namespace]).sort(),
      );
      const t = createTranslator({
        locale,
        namespace,
        messages: catalogs[locale],
        onError: (error) => {
          throw error;
        },
      });
      for (const [key, message] of Object.entries(
        catalogs[locale][namespace],
      )) {
        assert.ok(!message.includes("\uFFFD"), `${locale}:${namespace}.${key}: invalid text encoding`);
        const args = argumentsOf(message);
        assert.deepEqual(
          args,
          argumentsOf(catalogs.en[namespace][key]),
          `${locale}:${namespace}.${key}`,
        );
        const values = Object.fromEntries(
          args.map((name) => [
            name,
            /count|total|step|points|score/.test(name) ? 2 : "Example",
          ]),
        );
        assert.equal(typeof t(key, values), "string");
      }
    }
  }
});

test("every literal translation call is present in all catalogs", () => {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(`${dir}/${entry.name}`)
        : [`${dir}/${entry.name}`],
    );
  for (const path of [...walk("components"), ...walk("app")].filter((path) =>
    /\.tsx$/.test(path),
  )) {
    const source = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(source) === "copy" &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        for (const locale of locales)
          assert.ok(
            catalogs[locale].ui[messageKey(node.arguments[0].text)],
            `${locale}: ${path}: ${node.arguments[0].text}`,
          );
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
});

test("Chinese labels never replace persisted canonical enum values", () => {
  const brief = {
    name: "用户自己的研究",
    sectors: ["Professional services", "Healthcare"],
    models: ["B2B subscription", "Productized service"],
    geography: "United States",
    context: "Keep my text unchanged",
    discovery_mode: "market",
  };
  // WP-03: a brief saved before run focus reads as no angles and "explore something new" off.
  assert.deepEqual(projectSchema.parse(brief), { ...brief, angles: [], explore_new: false });
  assert.equal(projectSchema.safeParse({ ...brief, angles: ["无需融资"] }).success, false, "angles are canonical English values too");
  assert.equal(
    projectSchema.safeParse({ ...brief, sectors: ["专业服务"] }).success,
    false,
  );
  assert.equal(
    projectSchema.safeParse({ ...brief, models: ["B2B subscription", "产品化服务"] }).success,
    false,
  );
  const profile = { ...emptyProfile, name: "自訂姓名", skills: "自訂內容" };
  assert.equal(profileSchema.parse(profile).name, "自訂姓名");
  for (const file of [
    "components/onboarding.tsx",
    "components/research-config.tsx",
    "components/research-results.tsx",
  ]) {
    const ast = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function visit(node) {
      if (
        ts.isJsxOpeningElement(node) &&
        node.tagName.getText(ast) === "option"
      ) {
        assert.ok(
          node.attributes.properties.some(
            (prop) => prop.name?.getText(ast) === "value",
          ),
          `${file}: option missing canonical value`,
        );
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
});

test("locale formatting is deterministic, uses UTC, and retains USD amounts", () => {
  const instant = "2026-11-04T23:45:00Z";
  assert.match(formatDate("en", instant), /2026/);
  assert.match(formatDate("zh-Hans", instant), /2026/);
  assert.notEqual(formatDate("en", instant), formatDate("zh-Hant", instant));
  for (const locale of locales) {
    assert.match(
      formatNumber(locale, 149, { style: "currency", currency: "USD" }),
      /149/,
    );
    assert.match(formatNumber(locale, 0.25, { style: "percent" }), /25/);
  }
});

test("demo narratives are translated while IDs, scores, and source counts remain stable", () => {
  assert.deepEqual(
    opportunities.map((item) => item.id),
    [
      "proposal-copilot",
      "customer-insights",
      "finance-briefing",
      "workflow-audit",
    ],
  );
  assert.deepEqual(
    opportunities.map((item) => item.score),
    [84, 83, 79, 76],
  );
  for (const locale of locales) {
    const t = createTranslator({
      locale,
      namespace: "ui",
      messages: catalogs[locale],
      onError: (error) => {
        throw error;
      },
    });
    const copy = (source) => t(messageKey(source));
    for (const opportunity of opportunities) {
      for (const field of ["title", "description", "buyer", "pain", "risk"])
        assert.ok(copy(opportunity[field]));
      const report = researchReports[opportunity.id];
      assert.equal(report.sources.length, 3);
      for (const [field, value] of Object.entries(report))
        if (field !== "sources") assert.ok(copy(value));
      for (const source of report.sources)
        for (const value of Object.values(source)) assert.ok(copy(value));
    }
  }
});

test("labels and messages passed to copy() through variables are translated in every catalogue", async () => {
  // The literal-call test above cannot see these: they reach copy() as variables, and useCopy falls back silently.
  const { stageLabels, researchErrors } = await import("../lib/research-core.ts");
  const { feedback } = await import("../i18n/errors.ts");
  const { shareWording } = await import("../lib/share-core.ts");
  const shareText = Object.fromEntries(Object.entries(shareWording).flatMap(([kind, text]) => Object.entries(text).map(([part, source]) => [`share.${kind}.${part}`, source])));
  const dynamic = { ...stageLabels, ...researchErrors, ...feedback, ...shareText };
  for (const [name, source] of Object.entries(dynamic))
    for (const locale of locales)
      assert.ok(catalogs[locale].ui[messageKey(source)], `${locale}: ${name} → ${source}`);
});

test("translation sources are written in English, never in Chinese", () => {
  // A Chinese source string shows Chinese to English users whenever its catalogue entry is missing.
  const han = /[一-鿿]/;
  const files = ["app", "components", "lib", "i18n"].flatMap(dir =>
    readdirSync(dir, { recursive: true }).filter(f => /\.tsx?$/.test(f)).map(f => `${dir}/${f}`),
  ).filter(path => !["i18n/demo.ts", "i18n/glossary.ts", "i18n/config.ts", "lib/demo-data.ts"].includes(path));
  for (const path of files) {
    const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(source) === "copy" && ts.isStringLiteral(node.arguments[0]))
        assert.doesNotMatch(node.arguments[0].text, han, `${path}: copy("${node.arguments[0].text}")`);
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return import("../lib/research-core.ts").then(({ stageLabels, researchErrors }) => {
    for (const value of [...Object.values(stageLabels), ...Object.values(researchErrors)]) assert.doesNotMatch(value, han, value);
  });
});
