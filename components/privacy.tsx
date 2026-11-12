"use client";
import { useCopy, useFormats } from "@/i18n/use-copy";

import Link from "next/link";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mailto, privacyEmail, privacyUpdatedAt, supportEmail } from "@/lib/contact";
import type { DisclosedProvider, ProviderDisclosure } from "@/lib/provider-disclosure";

// A catalogue source string, optionally with ICU values (model names are proper nouns and stay untranslated).
type Text = string | { source: string; values: Record<string, string> };
type Section = {
  id: string;
  title: string;
  body?: Text[];
  items?: [string, Text][];
  after?: Text[];
};
const textKey = (text: Text) =>
  typeof text === "string" ? text : `${text.source}|${JSON.stringify(text.values)}`;

const highlights = [
  "We collect only what the service needs: your email, the profile and briefs you write, and the research we generate for you.",
  "We never sell your data, show ads, or use third-party analytics or tracking cookies.",
  "Your founder profile and research brief are sent to an AI model provider when you start a research run.",
  "You can ask us to access, export, correct, or delete your data at any time.",
];

function buildSections(disclosure: ProviderDisclosure): Section[] {
  return [
    {
      id: "who-we-are",
      title: "Who we are",
      body: [
        "VentureLens AI is operated by SmartMango (smartmango.ai). This notice explains what personal information we collect when you use VentureLens AI, why we collect it, who processes it on our behalf, and the choices you have.",
        "It covers the website, the private workspace, and the research service. It does not cover the third-party websites that appear as sources in a research report.",
      ],
    },
    {
      id: "what-we-collect",
      title: "Information we collect",
      body: ["We collect information you give us and a small amount of technical information needed to run the service:"],
      items: [
        ["Account", "Your email address, when your account was created and confirmed, and when you last signed in. We use passwordless sign-in, so we never receive or store a password."],
        ["Founder profile", "Your name, role, industry, skills, available hours, budget range, and goal, exactly as you enter them. If you add them: your interests, problems you have seen, the audiences you can reach, your main strength, income target, appetite for risk, things you will not do, and the languages you work in."],
        ["Research briefs", "The brief name, sector, business model, geography, and any context notes you add."],
        ["Research results", "Run status, generated opportunities and scores, and excerpts, titles, and links from public web pages used as evidence, with their retrieval dates."],
        ["Saved items", "Opportunities you save, your notes, and the validation tasks you mark as complete."],
        ["Usage and cost records", "For each research stage: the AI provider and model used, token and web-search counts, and the estimated cost. These records enforce the per-run budget and free-run limits."],
        ["Product usage events", "Which actions you take in the workspace, such as starting a research run and how it ended, recorded as event names, codes, and counts. They never contain the text of your profile, briefs, reports, or notes."],
        ["Technical data", "Essential cookies (described below) and standard server logs kept by our hosting provider, such as IP address, browser type, and request times."],
        ["Support messages", "Anything you include when you email us."],
      ],
      after: [
        "The demo workspace needs no account. Demo changes stay in your browser's memory until you refresh, and nothing you do in the demo is stored on our servers.",
        "Please do not put confidential business information, or personal information about other people, in your profile or briefs.",
      ],
    },
    {
      id: "how-we-use",
      title: "How we use your information",
      items: [
        ["Provide the service", "To create your account, keep you signed in, save your workspace, and show your research history."],
        ["Run research", "To generate opportunity hypotheses, search the web for evidence, score candidates, and save the report to your account."],
        ["Protect accounts and costs", "To verify sign-ins, grant free research runs, enforce run limits and budgets, and prevent abuse."],
        ["Support and reliability", "To answer your messages and to diagnose failed runs and errors."],
        ["Improve the product", "To measure, in aggregate, how research runs perform and which features are used."],
        ["Service messages", "To send sign-in codes and essential notices about your account or this policy. We do not send marketing email."],
        ["Research notifications", "To email you when a research run finishes or stops, if you leave this on in your profile. The email names the run and its outcome; your profile, briefs and reports are not included."],
        ["Weekly progress emails", "While you have an active validation sprint, to email you once a week with your next task, its details and the opportunity's title, unless you turn this off in your profile or with the link in the email."],
      ],
      after: [
        "We do not sell or rent your personal information, use it for advertising, or train our own AI models on your content.",
        "Where data protection law requires a legal basis, we rely on performing our contract with you (running your account and research), our legitimate interests (security, abuse prevention, and improving reliability), and your consent where we ask for it.",
      ],
    },
    {
      id: "ai-processing",
      title: "How AI research processes your data",
      body: [
        "When you start a research run, your founder profile and research brief are sent to an AI model provider, which uses them to draft opportunity hypotheses and to search the web for evidence. Search queries are generated from your brief.",
        "So that new research does not repeat itself, the titles, buyers and categories of ideas from your recent runs are sent too. You can clear this idea memory on your profile page.",
        ...modelProcessing(disclosure),
        "Providers process these requests under their own API terms. Nothing is sent to an AI provider until you start a run, and the demo never calls a live AI provider.",
      ],
    },
    {
      id: "service-providers",
      title: "Service providers we share data with",
      body: ["We share personal information only with providers that help us run VentureLens AI, and only as needed for that purpose:"],
      items: [
        ["Supabase", "Database, authentication, and sign-in emails."],
        ["Vercel", "Website hosting, background research jobs, and server logs."],
        ["Hostinger", "Notification emails, sent from our mailbox: your email address, and the run's name and outcome or your next sprint task and the opportunity's title."],
        ...modelProcessors(disclosure),
      ],
      after: [
        "Payments are not connected during the beta. Before checkout opens, we will update this notice to name the payment processor.",
        "We may also disclose information if required by law, to protect the rights and safety of our users or the public, or as part of a merger or acquisition, in which case this notice will continue to apply.",
      ],
    },
    {
      id: "cookies",
      title: "Cookies",
      body: ["We use only essential cookies:"],
      items: [
        ["Sign-in session", "Set by our authentication provider to keep you signed in. Removed when you log out or the session expires."],
        ["Language preference", "Remembers the interface language you chose, for up to one year."],
      ],
      after: ["We do not use analytics, advertising, or cross-site tracking cookies."],
    },
    {
      id: "transfers",
      title: "International transfers",
      body: [
        disclosure.processesInChina
          ? "Our providers may process your information in countries other than the one you live in, including the United States and, for Qwen research runs, mainland China. Where the law requires it, we rely on appropriate safeguards for these transfers."
          : "Our providers may process your information in countries other than the one you live in, including the United States. Where the law requires it, we rely on appropriate safeguards for these transfers.",
      ],
    },
    {
      id: "retention",
      title: "How long we keep your information",
      body: [
        "We keep your account, profile, briefs, research, and saved items while your account is active, so you can return to your research history.",
        "When your account is deleted, your profile, briefs, research runs, evidence, saved items, sprints, feedback and email settings are deleted with it. The cost records of your research (the model, token counts and cost of each call) are kept for our cost accounting, without any link to you. Copies in provider backups and logs expire on those providers' schedules.",
        "If your account received free research runs, we keep a one-way code made from your email address (a SHA-256 hash, not the address itself) for 12 months after you delete it, so a new account with the same address does not receive the free runs again.",
        "Product usage events are kept to measure the product over time. When your account is deleted, they are kept without any link to you.",
        "When you delete a research run, its report, opportunities, sources and sprints are deleted. Its cost records (the model, token counts and cost of each call) are kept for our cost accounting, without any link to you or the run.",
        "We keep support emails only as long as needed to resolve your request and keep a reasonable record of it.",
      ],
    },
    {
      id: "your-rights",
      title: "Your rights and choices",
      body: [
        "Depending on where you live, you may have the right to access, correct, export, or delete your personal information, to object to or restrict certain processing, and to withdraw consent. We extend these choices to every user.",
        "You can update your founder profile, download all of your data as a file, and delete your account yourself on your profile page at any time. For anything else, email us from the address on your account. We may need to confirm your identity, and we aim to respond within 30 days.",
        "If you are not satisfied with our response, you can contact your local data protection authority.",
      ],
    },
    {
      id: "security",
      title: "Security",
      body: [
        "Database access rules ensure that each account can read only its own records. Sign-in uses single-use, expiring email codes instead of passwords, connections are encrypted with HTTPS, and service keys never leave our servers.",
        "No system is perfectly secure. If you believe your account has been compromised, contact us right away.",
      ],
    },
    {
      id: "children",
      title: "Children",
      body: [
        "VentureLens AI is intended for adults. It is not directed at children under 16, and we do not knowingly collect their personal information. If you believe a child has given us information, contact us and we will delete it.",
      ],
    },
    {
      id: "changes",
      title: "Changes to this notice",
      body: [
        "We will update this notice when our practices change, and revise the date at the top of the page. If a change materially affects how we use your information, we will tell you by email or in the app before it takes effect.",
      ],
    },
  ];
}

const primaryProcessing: Record<DisclosedProvider["provider"], string> = {
  qwen: "Research runs currently use {model} through Alibaba Cloud Model Studio, which processes requests in mainland China (Beijing region).",
  gemini: "Research runs currently use {model} through the Google Gemini API.",
  claude: "Research runs currently use {model} through the Anthropic Claude API.",
};
const fallbackProcessing: Record<DisclosedProvider["provider"], string> = {
  qwen: "If it is unavailable, a run may fall back to {model} through Alibaba Cloud Model Studio, which processes requests in mainland China (Beijing region).",
  gemini: "If it is unavailable, a run may fall back to {model} through the Google Gemini API.",
  claude: "If it is unavailable, a run may fall back to {model} through the Anthropic Claude API.",
};

/** The paragraphs that name the AI providers new research runs use, following the saved research policy. */
export function modelProcessing(disclosure: ProviderDisclosure): Text[] {
  if (!disclosure.known)
  return [
      "Research runs use Qwen through Alibaba Cloud Model Studio, which processes requests in mainland China (Beijing region), the Google Gemini API, or the Anthropic Claude API, as chosen by an administrator.",
      "An administrator chooses the provider for all new runs. A run that has already started keeps the settings it started with.",
    ];
  const model = (provider: DisclosedProvider) => ({ model: provider.modelName });
  return [
    { source: primaryProcessing[disclosure.primary.provider], values: model(disclosure.primary) },
    disclosure.fallback
      ? { source: fallbackProcessing[disclosure.fallback.provider], values: model(disclosure.fallback) }
      : "Automatic fallback to another provider is turned off, so no other AI provider receives your data.",
    "An administrator chooses the provider for all new runs, and this section always shows the current choice. A run that has already started keeps the settings it started with.",
  ];
}

const processorRoles: Record<DisclosedProvider["provider"], Record<"primary" | "fallback" | "either", string>> = {
  qwen: {
    primary: "Primary AI model (Qwen) and web search for research runs.",
    fallback: "Fallback AI model (Qwen) and web search for research runs.",
    either: "AI model (Qwen) and web search for research runs.",
  },
  gemini: {
    primary: "Primary AI model (Gemini) and web search for research runs.",
    fallback: "Fallback AI model (Gemini) and web search for research runs.",
    either: "AI model (Gemini) and web search for research runs.",
  },
  claude: {
    primary: "Primary AI model (Claude) and web search for research runs.",
    fallback: "Fallback AI model (Claude) and web search for research runs.",
    either: "AI model (Claude) and web search for research runs.",
  },
};

/** Service-provider rows for the AI processors new runs may use, primary first. Unused providers are not listed. */
export function modelProcessors(disclosure: ProviderDisclosure): [string, Text][] {
  if (!disclosure.known)
    return disclosure.providers.map((p) => [p.processor, processorRoles[p.provider].either]);
  return [
    [disclosure.primary.processor, processorRoles[disclosure.primary.provider].primary],
    ...(disclosure.fallback
      ? [[disclosure.fallback.processor, processorRoles[disclosure.fallback.provider].fallback] as [string, Text]]
      : []),
  ];
}

export function Privacy({ disclosure }: { disclosure: ProviderDisclosure }) {
  const copy = useCopy();
  const format = useFormats();
  const sections = buildSections(disclosure);
  const say = (text: Text) =>
    typeof text === "string" ? copy(text) : copy(text.source, text.values);
  return (
    <PublicShell>
      <main id="main-content">
        <section className="hero-bg">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-5 pb-12 pt-16 md:px-8 md:pt-20">
            <Badge variant="secondary" className="gap-1.5">
              <ShieldCheck className="size-3.5" />
              {copy("Last updated {date}", { date: format.date(privacyUpdatedAt) })}
            </Badge>
            <h1 className="text-balance text-4xl font-semibold md:text-5xl">
              {copy("Privacy Policy")}
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              {copy(
                "VentureLens AI helps you research business opportunities. To do that, we handle some personal information. Here is exactly what we collect, why, and how to control it.",
              )}
            </p>
          </div>
        </section>
        <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-20 md:px-8 lg:grid-cols-[14rem_1fr]">
          <nav
            aria-label={copy("On this page")}
            className="hidden lg:block"
          >
            <div className="sticky top-28 flex flex-col gap-1 text-sm">
              <p className="mb-2 font-semibold">{copy("On this page")}</p>
              {[{ id: "summary", title: "At a glance" }, ...sections, { id: "contact", title: "Contact us" }].map(
                (section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-secondary hover:text-primary"
                  >
                    {copy(section.title)}
                  </a>
                ),
              )}
            </div>
          </nav>
          <div className="flex min-w-0 flex-col gap-10">
            <section id="summary" className="surface flex scroll-mt-24 flex-col gap-4 p-6">
              <h2 className="text-xl font-semibold">{copy("At a glance")}</h2>
              <ul className="flex flex-col gap-3">
                {highlights.map((text) => (
                  <li key={text} className="flex items-start gap-3 text-sm leading-relaxed">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    {copy(text)}
                  </li>
                ))}
              </ul>
            </section>
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="flex scroll-mt-24 flex-col gap-3"
              >
                <h2 className="text-2xl font-semibold">{copy(section.title)}</h2>
                {section.body?.map((text) => (
                  <p key={textKey(text)} className="leading-relaxed text-muted-foreground">
                    {say(text)}
                  </p>
                ))}
                {section.id === "ai-processing" && disclosure.settingsUpdatedAt && (
                  <p className="text-sm text-muted-foreground">
                    {copy("AI provider settings last changed {date}.", {
                      date: format.date(disclosure.settingsUpdatedAt),
                    })}
                  </p>
                )}
                {section.items && (
                  <dl className="divide-y rounded-lg border">
                    {section.items.map(([term, text]) => (
                      <div
                        key={term}
                        className="grid gap-1 p-4 sm:grid-cols-[12rem_1fr] sm:gap-4"
                      >
                        <dt className="font-medium">{copy(term)}</dt>
                        <dd className="text-sm leading-relaxed text-muted-foreground">
                          {say(text)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {section.after?.map((text) => (
                  <p key={textKey(text)} className="leading-relaxed text-muted-foreground">
                    {say(text)}
                  </p>
                ))}
              </section>
            ))}
            <section
              id="contact"
              className="surface flex scroll-mt-24 flex-col gap-4 p-6"
            >
              <h2 className="text-2xl font-semibold">{copy("Contact us")}</h2>
              <p className="leading-relaxed text-muted-foreground">
                {copy(
                  "For privacy questions or data requests, email our privacy team. For help using VentureLens AI, contact support.",
                )}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <a href={mailto(privacyEmail, "VentureLens privacy request")}>
                    <Mail />
                    {privacyEmail}
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={mailto(supportEmail)}>
                    <Mail />
                    {supportEmail}
                  </a>
                </Button>
              </div>
              <Link
                href="/support"
                className="flex w-fit items-center gap-1 text-sm font-medium text-primary"
              >
                {copy("Visit the Support page")}
                <ArrowRight className="size-4" />
              </Link>
            </section>
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
