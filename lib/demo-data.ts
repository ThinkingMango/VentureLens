export type Opportunity = {
  id: string;
  title: string;
  category: string;
  description: string;
  buyer: string;
  score: number;
  confidence: string;
  revenue: string;
  cost: string;
  icon: "file" | "headset" | "chart" | "workflow";
  scores: number[];
  pain: string;
  risk: string;
};
export const opportunities: Opportunity[] = [
  {
    id: "proposal-copilot",
    title: "AI proposal copilot for agencies",
    category: "Professional services",
    description:
      "Turn discovery calls and past work into client-ready proposals for boutique agencies.",
    buyer: "Agency owners · 5–25 employees",
    score: 87,
    confidence: "Higher",
    revenue: "$149–299",
    cost: "$35–70",
    icon: "file",
    scores: [92, 85, 88, 82, 86],
    pain: "Agency owners lose billable time translating discovery notes into detailed scopes and proposals.",
    risk: "Established proposal platforms may bundle similar capabilities. Access to client data requires careful permissions.",
  },
  {
    id: "customer-insights",
    title: "Customer feedback intelligence",
    category: "B2B SaaS",
    description:
      "Surface actionable product insights from scattered support tickets and customer conversations.",
    buyer: "Product leads · Early-stage SaaS",
    score: 83,
    confidence: "Medium",
    revenue: "$99–249",
    cost: "$25–55",
    icon: "headset",
    scores: [86, 88, 79, 80, 82],
    pain: "Small product teams struggle to prioritize customer feedback distributed across several tools.",
    risk: "Integration maintenance and security reviews may slow adoption. Generic sentiment analysis is easily commoditized.",
  },
  {
    id: "finance-briefing",
    title: "Financial briefing assistant",
    category: "Finance & operations",
    description:
      "Translate monthly financial reports into clear, decision-ready briefs for small business owners.",
    buyer: "Fractional CFOs · Small businesses",
    score: 79,
    confidence: "Medium",
    revenue: "$79–199",
    cost: "$20–50",
    icon: "chart",
    scores: [83, 75, 85, 72, 80],
    pain: "Fractional finance teams spend hours explaining recurring financial movements to non-finance founders.",
    risk: "Incorrect financial interpretations can cause material harm. Human review and strict data isolation are essential.",
  },
  {
    id: "workflow-audit",
    title: "Workflow audit for consultancies",
    category: "Professional services",
    description:
      "Identify repeatable automation opportunities inside client operations and delivery workflows.",
    buyer: "Operations consultants · Solo–10",
    score: 76,
    confidence: "Lower",
    revenue: "$89–179",
    cost: "$25–60",
    icon: "workflow",
    scores: [80, 73, 79, 72, 76],
    pain: "Consultants manually map client processes before they can identify realistic automation opportunities.",
    risk: "Each client process may require extensive customization, weakening recurring-revenue economics.",
  },
];
export const scoreLabels = [
  "Buyer pain",
  "Demand",
  "Unit economics",
  "Delivery feasibility",
  "Founder advantage",
];
export type DemoSource = {
  title: string;
  type: string;
  detail: string;
  observation: string;
  implication: string;
  limitation: string;
};
export type DemoReport = {
  approach: string;
  buyerJob: string;
  alternative: string;
  trigger: string;
  firstTest: string;
  sources: DemoSource[];
};
export const researchReports: Record<string, DemoReport> = {
  "proposal-copilot": {
    approach:
      "Draft a scope of work from an approved discovery transcript and a library of past agency projects. Flag missing deliverables, suggest milestone language, and require the agency owner to approve scope and pricing before sharing.",
    buyerJob:
      "Send a well-scoped proposal within one business day of a discovery call without pulling senior staff off client work.",
    alternative:
      "Copy an old proposal, rewrite the scope in a document, and request a partner review.",
    trigger:
      "Several proposals due in the same week, or scope creep on a recently won project.",
    firstTest:
      "With permission, turn three anonymized discovery notes into draft scopes. Ask owners to compare editing time and missing deliverables against their usual process.",
    sources: [
      {
        title: "Proposal preparation is a founder bottleneck",
        type: "Interview synthesis",
        detail: "Example synthesis of 8 fictional agency-owner conversations.",
        observation:
          "In the fictional sample, 6 of 8 owners described rewriting project scopes after discovery calls; 5 said partner review delayed sending.",
        implication:
          "Test scope completeness and review time rather than promising faster writing alone.",
        limitation:
          "Invented convenience sample. No interviews took place; these counts cannot establish market demand.",
      },
      {
        title: "Templates help formatting, not scoping",
        type: "Review analysis",
        detail: "Example analysis of 12 fabricated software-review excerpts.",
        observation:
          "The example reviews praise reusable layouts but describe copying deliverables and pricing between unrelated projects.",
        implication:
          "A narrow scope-review workflow may be more useful than another proposal editor.",
        limitation:
          "No real reviews or products were analyzed. Frequency and severity remain unverified.",
      },
      {
        title: "A subscription needs recurring proposal volume",
        type: "Pricing scenario",
        detail:
          "Four invented product packages compared against a $149–299 monthly assumption.",
        observation:
          "The demonstration scenario assumes an agency prepares at least four proposals per month and retains final pricing control.",
        implication:
          "Recruit buyers with recurring proposal work and test willingness to pay through a paid pilot.",
        limitation:
          "Invented prices, not competitor quotes. Acquisition, churn, and review labor are excluded.",
      },
    ],
  },
  "customer-insights": {
    approach:
      "Group permissioned support tickets and call notes into recurring customer problems. Attach a traceable excerpt to each theme and let product leads confirm or reject the grouping before using it in roadmap decisions.",
    buyerJob:
      "Prepare a weekly feedback brief that connects recurring problems to specific customer accounts.",
    alternative:
      "Tag support tickets manually and collect call notes in a spreadsheet before planning meetings.",
    trigger:
      "Feedback volume grows across support and sales, but no analyst owns synthesis.",
    firstTest:
      "Manually synthesize 100 anonymized tickets for two product teams. Have each lead check theme accuracy and identify whether the brief changes a prioritization decision.",
    sources: [
      {
        title: "Feedback is scattered across team tools",
        type: "Interview synthesis",
        detail: "Example synthesis of 6 fictional product-lead conversations.",
        observation:
          "In the invented sample, leads described reading tickets and sales notes separately, with duplicate requests counted as distinct problems.",
        implication:
          "Test deduplication and account-level context before adding sentiment scoring.",
        limitation:
          "No real participants or tickets. The workflow and sample size are illustrative.",
      },
      {
        title: "Traceability matters more than a summary",
        type: "Workflow scenario",
        detail:
          "A fabricated weekly planning session for a 12-person SaaS team.",
        observation:
          "The example team rejects a theme when it cannot see which customers reported the problem.",
        implication:
          "Every generated theme should retain a reviewable source excerpt and account context.",
        limitation:
          "A hypothetical workflow, not observed user behavior or a measured adoption signal.",
      },
      {
        title: "Integration costs may dominate early delivery",
        type: "Pricing scenario",
        detail:
          "A $99–249 monthly subscription scenario with $25–55 delivery costs.",
        observation:
          "The example budget assumes a single ticketing integration and excludes enterprise security reviews.",
        implication:
          "Begin with a permissioned export and measure setup effort before committing to integrations.",
        limitation:
          "Assumed costs only. No vendor quotes, tested pricing, or revenue forecast.",
      },
    ],
  },
  "finance-briefing": {
    approach:
      "Create a first-draft monthly narrative from structured financial statements. Reference the originating line items, flag unexplained movements, and require a finance professional to approve every brief.",
    buyerJob:
      "Explain cash movements and operating performance to several small-business clients each month.",
    alternative:
      "Export accounting reports and manually write a client-specific email or presentation.",
    trigger:
      "A fractional CFO adds clients but cannot add proportional reporting capacity.",
    firstTest:
      "Have two finance professionals review briefs from anonymized historical reports. Log every numerical or interpretive error before testing time savings.",
    sources: [
      {
        title: "Monthly commentary repeats across clients",
        type: "Interview synthesis",
        detail:
          "Example synthesis of 5 fictional fractional-CFO conversations.",
        observation:
          "The fictional sample describes recurring explanations of cash timing, margin changes, and overdue receivables.",
        implication:
          "A constrained commentary draft may reduce repetition while leaving interpretation with the CFO.",
        limitation:
          "No interviews occurred. Neither time savings nor demand has been measured.",
      },
      {
        title: "A plausible explanation can still be wrong",
        type: "Quality-review scenario",
        detail:
          "A fabricated review of 10 generated financial commentary drafts.",
        observation:
          "The example review flags unsupported causal explanations even where the underlying arithmetic is correct.",
        implication:
          "Separate numerical observations from inferred causes and require explicit reviewer approval.",
        limitation:
          "Invented test cases, not a model benchmark or evidence of financial accuracy.",
      },
      {
        title: "Review labor constrains the delivery margin",
        type: "Pricing scenario",
        detail:
          "A $79–199 monthly subscription scenario with $20–50 delivery costs.",
        observation:
          "The sample delivery budget excludes accounting cleanup, professional liability, and founder review time.",
        implication:
          "Measure human review cost per brief before testing a recurring subscription.",
        limitation:
          "These are assumptions, not market-tested prices or financial advice.",
      },
    ],
  },
  "workflow-audit": {
    approach:
      "Turn consultant interview notes into a draft process inventory. Highlight repetitive handoffs and missing information, then let the consultant verify feasibility and choose which automation to recommend.",
    buyerJob:
      "Translate client discovery into a defensible automation shortlist without rebuilding the audit from scratch.",
    alternative:
      "Document interviews in spreadsheets and draw custom process maps for each engagement.",
    trigger:
      "A consultancy wins several discovery engagements with similar operational workflows.",
    firstTest:
      "Co-deliver one manual audit with an operations consultant. Track which steps can be reused and which require client-specific judgment.",
    sources: [
      {
        title: "Discovery artifacts are hard to reuse",
        type: "Interview synthesis",
        detail:
          "Example synthesis of 4 fictional operations-consultant conversations.",
        observation:
          "The hypothetical consultants use similar interview questions but recreate their final process inventory for each client.",
        implication:
          "Test reuse of the inventory structure rather than assuming end-to-end automation.",
        limitation:
          "An invented sample; no interviews, paid engagements, or validated demand.",
      },
      {
        title: "A process description omits important exceptions",
        type: "Workflow scenario",
        detail: "A fabricated client onboarding audit with 14 process steps.",
        observation:
          "The example audit finds that approval exceptions and informal handoffs are absent from the initial notes.",
        implication:
          "Generated recommendations need a consultant review and an explicit list of unknowns.",
        limitation:
          "No actual client workflow was audited. The steps and findings are synthetic.",
      },
      {
        title: "One-off engagements challenge recurring revenue",
        type: "Pricing scenario",
        detail:
          "An $89–179 monthly subscription scenario with $25–60 delivery costs.",
        observation:
          "The sample assumes consultants use the tool across multiple engagements rather than buying it for a single audit.",
        implication:
          "Test repeat usage with consultants who have a steady client pipeline.",
        limitation:
          "Subscription frequency, pricing, and costs have not been tested.",
      },
    ],
  },
};
// Re-exported for existing imports; live UI imports it from ./demo-notice so it does not pull in the fixtures.
export { demoNotice } from "./demo-notice.ts";
