import type { Copy } from "../i18n/use-copy";
import { formatDate } from "../i18n/config.ts";
import { liveOpportunityView, type ViewSource } from "./opportunity-view.ts";
import { claimsBySection, dimensionLabels, scoreBand } from "./report-presentation.ts";
import { reasonText } from "./outcome-labels.ts";
import { researchModels } from "./research-models.ts";
import type { ResearchOutcome } from "./research-core";
import type { ResearchReport } from "./research-types";
import type { ResearchBrief, WorkspaceOpportunity } from "./workspace-schema";

/**
 * Report export (spec WP-11). A report or one opportunity is turned into an export document, a plain structure of
 * already-translated text, which is then written as Markdown (the download) or rendered as HTML (the print page that
 * the browser saves as PDF). Both use the same document, so the two formats never disagree.
 *
 * Headings and labels are in the reader's language; the research text stays in the language the report was written in,
 * and source quotes stay verbatim in their original language. Sections the payload lacks (older reports) are left out.
 *
 * The founder's profile is never part of an export. Their brief (name, industries, focus, idea) is added only when
 * they tick "Include my brief"; without it the document is titled generically, since the brief name is theirs.
 */

export type ExportFact = { label: string; value: string };
export type ExportSource = {
  number: number;
  title: string;
  url: string | null;
  /** Publisher domain, source type, stance and dates, already translated. */
  details: string[];
  /** The page excerpt, verbatim. */
  quote: string | null;
};
export type ExportClaim = { text: string; kind: string; citations: number[]; confirm: string | null };
export type ExportOpportunity = {
  id: string;
  title: string;
  description: string;
  facts: ExportFact[];
  verdict: { label: string; meaning: string; score: string };
  rationale: string | null;
  pain: { heading: string; text: string };
  dimensions: { heading: string; items: ExportFact[] };
  breakdown: { heading: string; items: ExportFact[]; note: string | null } | null;
  claims: { heading: string; groups: { title: string; claims: ExportClaim[] }[] } | null;
  assumptions: { heading: string; items: string[] } | null;
  economics: { heading: string; items: ExportFact[] };
  risk: { heading: string; text: string; review: ExportFact[] };
  validation: { heading: string; items: string[] } | null;
  sources: { heading: string; note: string; items: ExportSource[] } | null;
  footer: string;
};
export type ExportReport = {
  title: string;
  generatedOn: string;
  facts: ExportFact[];
  verdict: { title: string; text: string } | null;
  summary: { heading: string; text: string } | null;
  limitations: { heading: string; items: string[] } | null;
  notPassed: { heading: string; items: { title: string; buyer: string; reason: string }[] } | null;
  brief: { heading: string; items: ExportFact[] } | null;
  opportunitiesHeading: string;
  opportunities: ExportOpportunity[];
};
/**
 * `shared`: the read-only page behind a shared link (WP-26). It never includes the brief, and it leaves out each
 * opportunity's score rationale, which explains the founder-advantage score from the founder's own background.
 */
export type ExportContext = { copy: Copy; locale: string; generatedAt: Date | string; includeBrief?: boolean; brief?: ResearchBrief | null; shared?: boolean };
export type ExportRun = { id: string; created_at: string; completed_at: string | null; report: ResearchReport; outcome?: ResearchOutcome | null };

const modeLabels = {
  founder: "Founder-led discovery",
  market: "Market-led discovery",
  combined: "Founder + market discovery",
  verify: "Idea check",
} as const;
const confidenceLabels: Record<string, string> = {
  moderate: "Moderate: primary validation still needed",
  limited: "Limited: few independent sources",
};
function confidenceLabel(copy: Copy, level: string) {
  return ["Higher", "Medium", "Lower"].includes(level)
    ? copy("{level} confidence", { level: copy(level) })
    : confidenceLabels[level] ? copy(confidenceLabels[level]) : level;
}
function sectionTitle(copy: Copy, section: string) {
  switch (section) {
    case "buyer": return copy("Buyer");
    case "pain": return copy("Pain");
    case "demand": return copy("Demand");
    case "competition": return copy("Competition");
    case "economics": return copy("Economics");
    default: return copy("Risk");
  }
}
function claimKind(copy: Copy, kind: string) {
  return kind === "observed" ? copy("Observed") : kind === "assumption" ? copy("Assumption") : copy("Inference");
}
function reliabilityLabel(copy: Copy, reliability: ViewSource["reliability"]) {
  switch (reliability) {
    case "primary": return copy("Primary source");
    case "secondary": return copy("Secondary source");
    case "vendor": return copy("Vendor source");
    case "unknown": return copy("Source type unknown");
    default: return null;
  }
}
function stanceLabel(copy: Copy, stance: ViewSource["stance"]) {
  switch (stance) {
    case "supports": return copy("Supports");
    case "contradicts": return copy("Contradicts");
    case "neutral": return copy("Neutral");
    default: return null;
  }
}
function modelName(copy: Copy, model: string | undefined) {
  if (!model) return null;
  return model === "mixed" ? copy("Mixed models") : (researchModels as Record<string, { name: string }>)[model]?.name ?? model;
}
function date(ctx: ExportContext, value: string | Date | null | undefined) {
  if (!value || Number.isNaN(new Date(value).getTime())) return null;
  return formatDate(ctx.locale, value);
}
const nonEmpty = (value: string | null | undefined): value is string => typeof value === "string" && value.trim().length > 0;

/** One opportunity as an export document. */
export function buildOpportunityExport(op: WorkspaceOpportunity, ctx: ExportContext): ExportOpportunity {
  const { copy } = ctx;
  const view = liveOpportunityView(op);
  const numbers = new Map(view.sources.map((source) => [source.key, source.number]));
  const band = scoreBand(view.score);
  const groups = claimsBySection(view.claims).map((group) => ({
    title: sectionTitle(copy, group.section),
    claims: group.claims.map((claim) => ({
      text: claim.text,
      kind: claimKind(copy, claim.kind),
      citations: [...new Set(claim.source_keys.map((key) => numbers.get(key)).filter((n): n is number => n !== undefined))].sort((a, b) => a - b),
      confirm: claim.kind === "assumption" && nonEmpty(claim.confirm) ? claim.confirm : null,
    })),
  }));
  const b = view.breakdown;
  const review = [
    ...(nonEmpty(view.critique) ? [{ label: copy("What the adversarial review found"), value: view.critique }] : []),
    ...(nonEmpty(view.falsification) ? [{ label: copy("How to falsify this opportunity"), value: view.falsification }] : []),
  ];
  return {
    id: view.id,
    title: view.title,
    description: view.description,
    facts: [
      { label: copy("Category"), value: view.category },
      { label: copy("Likely buyer"), value: view.buyer },
      { label: copy("Research score"), value: `${view.score}/100` },
      { label: copy("Confidence"), value: confidenceLabel(copy, view.confidence) },
    ],
    verdict: { label: copy(band.label), meaning: copy(band.meaning), score: `${view.score}/100` },
    rationale: !ctx.shared && nonEmpty(view.rationale) ? view.rationale : null,
    pain: { heading: copy("The problem worth solving"), text: view.pain },
    dimensions: {
      heading: copy("Score breakdown"),
      items: dimensionLabels.flatMap((label, index) => (typeof view.scores[index] === "number" ? [{ label: copy(label), value: String(view.scores[index]) }] : [])),
    },
    breakdown: b
      ? {
          heading: copy("How this score was reached"),
          items: [
            { label: copy("Weighted rating before review"), value: String(b.beforeReview) },
            { label: copy("Adversarial review deduction"), value: b.deduction > 0 ? `−${b.deduction}` : "0" },
            { label: b.cap === 85 ? copy("Evidence cap (3+ independent supporting sources)") : copy("Evidence cap (fewer than 3 independent supporting sources)"), value: String(b.cap) },
            { label: copy("Score"), value: String(b.score) },
          ],
          note: b.capped ? copy("The evidence cap set this score. More independent supporting sources would raise the cap.") : null,
        }
      : null,
    claims: groups.length ? { heading: copy("What the research claims"), groups } : null,
    assumptions: view.assumptions.length ? { heading: copy("The assumptions that matter"), items: view.assumptions } : null,
    economics: {
      heading: copy("Price and cost hypotheses"),
      items: [
        { label: copy("Price hypothesis"), value: view.revenue },
        { label: copy("Delivery cost hypothesis"), value: view.cost },
      ],
    },
    risk: { heading: copy("Key risk to validate"), text: view.risk, review },
    // Next steps (WP-16) export as one line each, with where, done-when and stop-if; older reports keep plain steps.
    validation: view.steps.length
      ? { heading: copy("Next steps"), items: view.steps.map((step) => [
          step.action,
          step.source ? `${copy("Where")}: [${step.source.number}] ${step.source.title}` : step.hint ? `${copy("Where to look (suggestion)")}: ${step.hint}` : null,
          `${copy("Done when")}: ${step.doneWhen}`,
          `${copy("Stop if")}: ${step.stopIf}`,
        ].filter(Boolean).join(" · ")) }
      : view.validation.length ? { heading: copy("Next validation steps"), items: view.validation } : null,
    sources: view.sources.length
      ? {
          heading: copy("Sources"),
          note: copy("Source excerpts are kept in their original language so you can verify them yourself."),
          items: view.sources.map((source) => ({
            number: source.number,
            title: source.title,
            url: source.url,
            details: [
              source.domain,
              reliabilityLabel(copy, source.reliability),
              stanceLabel(copy, source.stance),
              source.retrievedAt
                ? copy("Retrieved: {date} UTC · Published: {published}", { date: date(ctx, source.retrievedAt) ?? source.retrievedAt, published: source.publishedAt ?? copy("Unknown") })
                : null,
            ].filter(nonEmpty),
            quote: nonEmpty(source.quote) ? source.quote : null,
          })),
        }
      : null,
    footer: [
      view.methodologyVersion ? copy("Methodology version {version}", { version: view.methodologyVersion }) : null,
      copy("Generated on {date} by VentureLens", { date: date(ctx, ctx.generatedAt) ?? "" }),
    ].filter(nonEmpty).join(" · "),
  };
}

/** The founder's brief, only when they chose to include it. */
function briefFacts(copy: Copy, brief: ResearchBrief) {
  const list = (values: readonly string[] | undefined) => (values ?? []).map((value) => copy(value)).join(", ");
  return [
    { label: copy("Brief name"), value: brief.name },
    { label: copy("Industries"), value: list(brief.sectors) },
    { label: copy("Business models"), value: list(brief.models) },
    { label: copy("Target market"), value: copy(brief.geography) },
    { label: copy("Run focus"), value: [list(brief.angles), brief.explore_new ? copy("Explore something new") : ""].filter(nonEmpty).join(", ") },
    { label: copy("Extra context"), value: brief.context },
    { label: copy("Your idea"), value: brief.idea ? [brief.idea.title, brief.idea.buyer, brief.idea.pain, brief.idea.offer, brief.idea.price_hint].filter(nonEmpty).join(" — ") : "" },
  ].filter((fact) => nonEmpty(fact.value));
}

/** A completed report as an export document. `run.report.opportunities` must be the full payload (with excerpts). */
export function buildReportExport(run: ExportRun, ctx: ExportContext): ExportReport {
  const { copy } = ctx;
  const report = run.report;
  const opportunities = Array.isArray(report.opportunities) ? report.opportunities : [];
  const verified = report.mode === "verify" ? opportunities[0] : undefined;
  const notPassed = (run.outcome?.candidates ?? []).filter((candidate) => candidate.reason !== "PASSED");
  const includeBrief = !ctx.shared && !!ctx.includeBrief && !!ctx.brief;
  return {
    title: includeBrief && ctx.brief ? ctx.brief.name : copy("VentureLens research report"),
    generatedOn: copy("Generated on {date} by VentureLens", { date: date(ctx, ctx.generatedAt) ?? "" }),
    facts: [
      report.mode && modeLabels[report.mode] ? { label: copy("Research mode"), value: copy(modeLabels[report.mode]) } : null,
      modelName(copy, report.model) ? { label: copy("Model"), value: modelName(copy, report.model) as string } : null,
      nonEmpty(report.methodology) ? { label: copy("Methodology"), value: report.methodology } : null,
      date(ctx, run.completed_at ?? report.generated_at) ? { label: copy("Report completed"), value: date(ctx, run.completed_at ?? report.generated_at) as string } : null,
    ].filter((fact): fact is ExportFact => fact !== null),
    verdict: verified
      ? {
          title: verified.confidence === "moderate"
            ? copy("Supported by independent evidence (moderate confidence)")
            : copy("Supported by independent evidence (limited confidence)"),
          text: copy("Independent sources describe the problem you named, so the idea passed the evidence rules. That is not proof that buyers will pay: the score compares evidence, it is not a chance of success. Test it with buyers next."),
        }
      : null,
    summary: nonEmpty(report.summary) ? { heading: copy("Research summary"), text: report.summary } : null,
    limitations: report.limitations?.length ? { heading: copy("Limitations"), items: report.limitations } : null,
    notPassed: notPassed.length
      ? { heading: copy("Ideas that did not pass"), items: notPassed.map((candidate) => ({ title: candidate.title, buyer: candidate.buyer, reason: reasonText(copy, candidate.reason) })) }
      : null,
    brief: includeBrief && ctx.brief ? { heading: copy("Your brief"), items: briefFacts(copy, ctx.brief) } : null,
    opportunitiesHeading: copy("Opportunities"),
    opportunities: opportunities.map((op) => buildOpportunityExport(op, ctx)),
  };
}

// Markdown writing. Research text is untrusted model output, so it is escaped: it can never add headings, links, HTML
// or tables to the document, whatever it contains.

/** Escapes Markdown and inline HTML in a line of text, and folds line breaks into spaces. */
export function mdText(value: string) {
  return value.replace(/\r?\n+/g, " ").replace(/[\\`*_[\]<>#|~]/g, (char) => `\\${char}`).trim().replace(/^([-+])(\s)/, "\\$1$2").replace(/^(\d+)([.)])(\s)/, "$1\\$2$3");
}
/** A paragraph that keeps the author's paragraph breaks. */
function mdParagraphs(value: string) {
  return value.split(/\n\s*\n/).map((part) => mdText(part)).filter(Boolean).join("\n\n");
}
/** A link target: only http(s), with the characters that would end a Markdown link encoded. */
export function mdUrl(url: string) {
  const codes: Record<string, string> = { "(": "%28", ")": "%29", "<": "%3C", ">": "%3E" };
  return url.replace(/[()<>\s]/g, (char) => codes[char] ?? encodeURIComponent(char));
}
function fact(item: ExportFact) {
  return `- **${mdText(item.label)}:** ${mdText(item.value)}`;
}
function heading(level: number, text: string) {
  return `${"#".repeat(Math.min(6, level))} ${mdText(text)}`;
}
function opportunityBlocks(op: ExportOpportunity, level: number): string[] {
  const blocks: string[] = [heading(level, op.title)];
  if (nonEmpty(op.description)) blocks.push(mdParagraphs(op.description));
  blocks.push(op.facts.map(fact).join("\n"));
  blocks.push(`**${mdText(op.verdict.label)} · ${op.verdict.score}**: ${mdText(op.verdict.meaning)}`);
  if (op.rationale) blocks.push(mdParagraphs(op.rationale));
  blocks.push(heading(level + 1, op.pain.heading), mdParagraphs(op.pain.text));
  blocks.push(heading(level + 1, op.dimensions.heading), op.dimensions.items.map(fact).join("\n"));
  if (op.breakdown) {
    blocks.push(heading(level + 2, op.breakdown.heading), op.breakdown.items.map(fact).join("\n"));
    if (op.breakdown.note) blocks.push(`_${mdText(op.breakdown.note)}_`);
  }
  if (op.claims) {
    blocks.push(heading(level + 1, op.claims.heading));
    for (const group of op.claims.groups) {
      blocks.push(heading(level + 2, group.title));
      blocks.push(group.claims.map((claim) => {
        const cites = claim.citations.map((n) => `[${n}]`).join("");
        const line = `- **${mdText(claim.kind)}:** ${mdText(claim.text)}${cites ? ` ${cites}` : ""}`;
        return claim.confirm ? `${line}\n  - ${mdText(claim.confirm)}` : line;
      }).join("\n"));
    }
  }
  if (op.assumptions) blocks.push(heading(level + 1, op.assumptions.heading), op.assumptions.items.map((item) => `- ${mdText(item)}`).join("\n"));
  blocks.push(heading(level + 1, op.economics.heading), op.economics.items.map(fact).join("\n"));
  blocks.push(heading(level + 1, op.risk.heading), mdParagraphs(op.risk.text));
  for (const item of op.risk.review) blocks.push(heading(level + 2, item.label), mdParagraphs(item.value));
  if (op.validation) blocks.push(heading(level + 1, op.validation.heading), op.validation.items.map((item, index) => `${index + 1}. ${mdText(item)}`).join("\n"));
  if (op.sources) {
    blocks.push(heading(level + 1, op.sources.heading), `_${mdText(op.sources.note)}_`);
    for (const source of op.sources.items) {
      const title = source.url ? `[${mdText(source.title)}](${mdUrl(source.url)})` : mdText(source.title);
      const lines = [`**[${source.number}]** ${title}`];
      if (source.url) lines.push(`<${mdUrl(source.url)}>`);
      if (source.details.length) lines.push(mdText(source.details.join(" · ")));
      // A backslash line break, which survives editors that trim trailing spaces.
      blocks.push(lines.join("\\\n"));
      if (source.quote) blocks.push(source.quote.split(/\r?\n/).filter((line) => line.trim()).map((line) => `> ${mdText(line)}`).join("\n>\n"));
    }
  }
  blocks.push(`_${mdText(op.footer)}_`);
  return blocks;
}

export function opportunityMarkdown(op: ExportOpportunity) {
  return `${opportunityBlocks(op, 1).join("\n\n")}\n`;
}
export function reportMarkdown(doc: ExportReport) {
  const blocks: string[] = [heading(1, doc.title), `_${mdText(doc.generatedOn)}_`];
  if (doc.facts.length) blocks.push(doc.facts.map(fact).join("\n"));
  if (doc.verdict) blocks.push(heading(2, doc.verdict.title), mdParagraphs(doc.verdict.text));
  if (doc.summary) blocks.push(heading(2, doc.summary.heading), mdParagraphs(doc.summary.text));
  if (doc.limitations) blocks.push(heading(2, doc.limitations.heading), doc.limitations.items.map((item) => `- ${mdText(item)}`).join("\n"));
  if (doc.brief) blocks.push(heading(2, doc.brief.heading), doc.brief.items.map(fact).join("\n"));
  if (doc.notPassed) {
    blocks.push(heading(2, doc.notPassed.heading), doc.notPassed.items.map((item) => `- **${mdText(item.title)}** (${mdText(item.buyer)}): ${mdText(item.reason)}`).join("\n"));
  }
  if (doc.opportunities.length) {
    blocks.push(heading(2, doc.opportunitiesHeading));
    doc.opportunities.forEach((op, index) => {
      if (index > 0) blocks.push("---");
      blocks.push(...opportunityBlocks({ ...op, title: `${index + 1}. ${op.title}` }, 3));
    });
  }
  return `${blocks.join("\n\n")}\n`;
}

/** `reportToMarkdown` and `opportunityToMarkdown` (spec WP-11): the builders and the writer in one call. */
export function reportToMarkdown(run: ExportRun, ctx: ExportContext) {
  return reportMarkdown(buildReportExport(run, ctx));
}
export function opportunityToMarkdown(op: WorkspaceOpportunity, ctx: ExportContext) {
  return opportunityMarkdown(buildOpportunityExport(op, ctx));
}

/** A safe, readable file name: the title's letters and digits (any script), hyphenated, with the date. */
export function exportFileName(title: string, generatedAt: Date | string, extension = "md") {
  const slug = title.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "") || "venturelens";
  const day = new Date(generatedAt).toISOString().slice(0, 10);
  return `${slug}-${day}.${extension}`;
}
