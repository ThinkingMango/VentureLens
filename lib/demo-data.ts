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
  "Market potential",
  "Founder fit",
  "Feasibility",
  "Revenue quality",
];
export const sources = [
  {
    title: "Agency proposal workflow interviews",
    type: "Interview synthesis",
    detail: "8 fictional buyer conversations describing proposal bottlenecks.",
    confidence: "Illustrative only",
  },
  {
    title: "Software review themes",
    type: "Review analysis",
    detail: "12 fabricated review excerpts about existing proposal tools.",
    confidence: "Illustrative only",
  },
  {
    title: "Pricing landscape snapshot",
    type: "Competitor comparison",
    detail:
      "4 invented product comparisons used to demonstrate the research format.",
    confidence: "Illustrative only",
  },
];
export const demoNotice =
  "Synthetic demonstration data. Scores, sources, and financial scenarios are illustrative—not verified research or forecasts.";
