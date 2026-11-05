"use client";
import { useCopy } from "@/i18n/use-copy";
import { feedbackSource } from "@/i18n/errors";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/workspace-link";
import {
  ArrowLeft,
  ArrowRight,
  Telescope,
  Check,
  UserRound,
} from "lucide-react";
import { useDemo } from "@/components/demo-provider";
import { PageHeader, DemoNote } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
export function ResearchConfig() {
  const copy = useCopy();
  const { run, setRun, profile, isDemo, href, busy, refresh } = useDemo();
  const [draft, setDraft] = useState(run);
  const [submitting, setSubmitting] = useState(false);
  const requestKey = useRef<string | null>(null);
  const [nameError, setNameError] = useState("");
  const [formError, setFormError] = useState("");
  const router = useRouter();
  return (
    <>
      <Link
        href="/research"
        className="flex w-fit items-center gap-2 text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {copy("My research")}
      </Link>
      <PageHeader
        title={copy("What would you like to explore?")}
        description={
          isDemo
            ? copy(
                "Configure a research brief and preview a clearly labeled demonstration report.",
              )
            : copy("创建证据驱动的研究任务。仅限已授权的开发账号，不连接计费。")
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="surface p-6 md:p-8">
          <form
            className="flex flex-col gap-7"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy || submitting) return;
              if (!draft.name.trim()) {
                setNameError(
                  "Enter a research name, such as Agency workflow research.",
                );
                document.getElementById("research-name")?.focus();
                return;
              }
              setNameError("");
              setFormError("");
              setSubmitting(true);
              try {
                const brief = { ...draft, name: draft.name.trim() };
                if (isDemo) {
                  await setRun(brief);
                  router.push(href("/research/results?demo=1"));
                } else {
                  requestKey.current ??= crypto.randomUUID();
                  const response = await fetch("/api/research", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "start",
                      brief,
                      requestKey: requestKey.current,
                    }),
                  });
                  const result = await response.json();
                  if (!response.ok)
                    throw new Error(feedbackSource(result.code));
                  await refresh().catch(() => undefined);
                  router.push(`/research/${result.id}`);
                }
                router.refresh();
              } catch (error) {
                setFormError(
                  error instanceof Error ? error.message : "研究暂时无法启动。",
                );
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <h2 className="text-lg font-semibold">
              {copy("Set your research focus")}
            </h2>
            <FieldGroup>
              <Field data-invalid={!!nameError}>
                <FieldLabel htmlFor="research-name">
                  {copy("Research name (required)")}
                </FieldLabel>
                <Input
                  id="research-name"
                  value={draft.name}
                  maxLength={100}
                  required
                  aria-invalid={!!nameError}
                  aria-describedby={
                    nameError ? "research-name-error" : "research-name-help"
                  }
                  onChange={(e) => {
                    setDraft({ ...draft, name: e.target.value });
                    setNameError("");
                  }}
                />
                {nameError ? (
                  <FieldError id="research-name-error">
                    {copy(nameError)}
                  </FieldError>
                ) : (
                  <FieldDescription id="research-name-help">
                    {copy(
                      "Use a descriptive name so you can find this brief later. Up to 100 characters.",
                    )}
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="discovery-mode">
                  {copy("发现模式")}
                </FieldLabel>
                <select
                  id="discovery-mode"
                  className="field-select"
                  value={draft.discovery_mode ?? "combined"}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      discovery_mode: e.target.value as
                        "founder" | "market" | "combined",
                    })
                  }
                >
                  <option value="combined">
                    {copy("综合发现 · Combined Discovery")}
                  </option>
                  <option value="founder">
                    {copy("创始人优势 · Founder Advantage")}
                  </option>
                  <option value="market">
                    {copy("市场优先 · Market-First")}
                  </option>
                </select>
                <FieldDescription>
                  {copy(
                    "市场优先不使用个人背景进行机会发现或评分；其余模式结合你的技能和资源。",
                  )}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="sector">
                  {copy("Industry or market")}
                </FieldLabel>
                <select
                  id="sector"
                  className="field-select"
                  value={draft.sector}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      sector: e.target.value as typeof draft.sector,
                    })
                  }
                >
                  {[
                    "Professional services",
                    "B2B SaaS",
                    "Finance & operations",
                    "Education",
                    "Healthcare",
                  ].map((v) => (
                    <option key={v} value={v}>
                      {copy(v)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="model">
                  {copy("Business model")}
                </FieldLabel>
                <select
                  id="model"
                  className="field-select"
                  value={draft.model}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      model: e.target.value as typeof draft.model,
                    })
                  }
                >
                  {[
                    "B2B subscription",
                    "Productized service",
                    "Usage-based software",
                    "Open to possibilities",
                  ].map((v) => (
                    <option key={v} value={v}>
                      {copy(v)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="geography">
                  {copy("Target market")}
                </FieldLabel>
                <select
                  id="geography"
                  className="field-select"
                  value={draft.geography}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      geography: e.target.value as typeof draft.geography,
                    })
                  }
                >
                  {[
                    "United States",
                    "United Kingdom",
                    "European Union",
                    "Global / English-speaking",
                  ].map((v) => (
                    <option key={v} value={v}>
                      {copy(v)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="context">
                  {copy("Anything else to keep in mind?")}{" "}
                  <span className="text-muted-foreground">
                    {copy("(optional)")}
                  </span>
                </FieldLabel>
                <textarea
                  id="context"
                  value={draft.context}
                  onChange={(event) =>
                    setDraft({ ...draft, context: event.target.value })
                  }
                  aria-describedby="context-help"
                  maxLength={1000}
                  className="field-select min-h-24"
                  placeholder={copy(
                    "A buyer group, a problem you’ve noticed, or a niche you know well…",
                  )}
                />
                <FieldDescription id="context-help">
                  {isDemo
                    ? copy(
                        "Up to 1,000 characters. Demo notes stay in memory; results remain fixed synthetic examples.",
                      )
                    : copy(
                        "最多 1,000 字符。研究配置会保存；必要的市场背景会发送至 Qwen 和外部检索服务，请勿包含敏感信息。",
                      )}
                </FieldDescription>
              </Field>
            </FieldGroup>
            {formError && (
              <p role="alert" className="rounded-lg border p-4 text-sm">
                {copy(formError)}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-5">
              <span className="text-sm text-muted-foreground">
                {isDemo
                  ? copy("0 credits used in demo mode")
                  : copy(
                      "开发白名单 · 最多 3 次任务 · 每次估算预算上限 US$0.25",
                    )}
              </span>
              <Button
                type="submit"
                disabled={busy || submitting}
                aria-busy={busy || submitting}
              >
                {busy || submitting
                  ? copy("提交中…")
                  : isDemo
                    ? copy("Preview research results")
                    : copy("启动证据研究")}
                <ArrowRight />
              </Button>
            </div>
          </form>
        </section>
        <aside className="flex flex-col gap-5">
          <section className="surface flex flex-col gap-4 p-6">
            <div className="flex items-center gap-2">
              <UserRound className="size-5 text-primary" />
              <h2 className="font-semibold">{copy("Your founder context")}</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {isDemo
                ? copy(
                    "Reference your experience while exploring. Profile changes do not personalize demo results.",
                  )
                : copy(
                    "研究会保存此刻的画像快照。创始人优势和综合发现模式使用这些信息；市场优先模式不使用。",
                  )}
            </p>
            <dl className="flex flex-col gap-4">
              {[
                ["Experience", profile.industry],
                [
                  "Time available",
                  copy("{hours} / week", { hours: copy(profile.hours) }),
                ],
                ["Starting budget", profile.budget],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm text-muted-foreground">{copy(k)}</dt>
                  <dd className="mt-1 font-medium">{copy(v)}</dd>
                </div>
              ))}
            </dl>
            <Link href="/profile" className="text-sm font-medium text-primary">
              {copy("Edit founder profile")}
              <ArrowRight className="ml-1 inline size-4" />
            </Link>
          </section>
          <section className="flex flex-col gap-4 rounded-xl bg-secondary p-6 text-foreground">
            <Telescope className="size-6 text-primary" />
            <h2 className="font-semibold">
              {copy("A structured view of the possibilities")}
            </h2>
            <ul className="flex flex-col gap-3">
              {[
                "Ranked opportunity hypotheses",
                "Clear buyer and pain profiles",
                "Evidence quality and key risks",
                "Illustrative business economics",
                "Practical validation next steps",
              ].map((t) => (
                <li
                  key={t}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Check className="size-4 shrink-0 text-primary" />
                  {copy(t)}
                </li>
              ))}
            </ul>
          </section>
          <DemoNote />
        </aside>
      </div>
    </>
  );
}
