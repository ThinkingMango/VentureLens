export type Capital = "under2k" | "mid" | "more";
export type Stance = "testing" | "paused" | "killed";
export type Confidence = "Limited" | "Moderate" | "Strong";

export type Brief = {
  craft: string;
  hours: number;
  capital: Capital;
  reach: string;
  geography: string;
  goal: string;
};

export type Profile = Brief & { name: string };

export type Source = {
  id: string;
  title: string;
  domain: string;
  excerpt: string;
  ageDays: number;
  kind: "independent" | "vendor";
};

export type Dimension = {
  id: string;
  label: string;
  score: number;
  weight: number;
};

export type Task = { id: string; label: string; done: boolean };

export type Interview = { id: string; who: string; note: string; at: string };

export type Opportunity = {
  id: string;
  title: string;
  buyer: string;
  pain: string;
  instead: string;
  hypothesis: string;
  score: number;
  confidence: Confidence;
  dimensions: Dimension[];
  sources: Source[];
  critique: { point: string; deduction: number }[];
  falsify: string;
  question: string;
  touch: "low" | "high";
  needsSpend: boolean;
  markets: string[];
  tasks: Task[];
  interviews: Interview[];
  saved: boolean;
  status: Stance;
};

export type Dropped = { title: string; reason: string };

export type Run = {
  id: string;
  name: string;
  createdAt: string;
  brief: Brief;
  opportunityIds: string[];
  dropped: Dropped[];
};

export type Checkin = {
  week: string;
  opportunityId: string;
  stance: "still" | "paused" | "killed";
};

export const CAPITALS: { id: Capital; label: string; hint: string }[] = [
  { id: "under2k", label: "Under $2,000", hint: "Time is the budget" },
  { id: "mid", label: "$2,000–10,000", hint: "A small test is possible" },
  { id: "more", label: "More than $10,000", hint: "You can buy a pilot" },
];

export const HOURS = [5, 10, 20, 30];

export const GEOS = [
  "United States",
  "United Kingdom",
  "Hong Kong",
  "Mainland China",
  "Global",
];

export const STALE_DAYS = 60;

const dropped: Dropped = {
  title: "Photo menus for independent restaurants",
  reason:
    "The only page that described demand was a vendor selling the tool. No second domain. Dropped.",
};

export const seedProfile: Profile = {
  name: "Maya Chen",
  craft: "Produced pitches for a 20-person brand studio",
  hours: 10,
  capital: "mid",
  reach: "Former clients and producers still in my phone",
  geography: "United States",
  goal: "A recurring offer I can run beside a job",
};

const proposal: Opportunity = {
  id: "proposal-studio",
  title: "Proposal studio for boutique agencies",
  buyer: "Owners of creative studios with 8–25 people",
  pain: "Senior people rewrite proposals at night, and nobody can say which sections actually win.",
  instead: "A shared doc, an old PDF, and a producer who “knows the voice.”",
  hypothesis:
    "Studios will pay monthly for a seat that drafts only from their won proposals and logs which version was sent.",
  score: 78,
  confidence: "Moderate",
  dimensions: [
    { id: "pain", label: "Pain clarity", score: 84, weight: 25 },
    { id: "evidence", label: "Evidence", score: 76, weight: 20 },
    { id: "reach", label: "Reach", score: 80, weight: 20 },
    { id: "economics", label: "Recurring economics", score: 72, weight: 20 },
    { id: "solo", label: "Solo feasibility", score: 74, weight: 15 },
  ],
  sources: [
    {
      id: "s1",
      title: "How small agencies staff new business",
      domain: "agencyweek.example",
      excerpt:
        "Owners at studios under 30 people still write or heavily rewrite the final proposal. Dedicated new-business staff shows up later.",
      ageDays: 18,
      kind: "independent",
    },
    {
      id: "s2",
      title: "Where owner hours actually go",
      domain: "studioops.example",
      excerpt:
        "Proposal weeks were the most cited reason principals missed delivery. Several described staying until midnight before a pitch.",
      ageDays: 74,
      kind: "independent",
    },
    {
      id: "s3",
      title: "A forum thread on reusing old decks",
      domain: "operators.example",
      excerpt:
        "People paste last quarter’s deck into a new doc and then spend the evening taking the previous client’s name out.",
      ageDays: 9,
      kind: "independent",
    },
    {
      id: "s4",
      title: "Proposal software roundup",
      domain: "pitchtools.example",
      excerpt:
        "Vendors claim studios are replacing documents with their product. The page is selling the category.",
      ageDays: 40,
      kind: "vendor",
    },
  ],
  critique: [
    {
      point: "A careful producer already keeps a folder of won work. The habit exists without software.",
      deduction: 8,
    },
    {
      point: "Studios may refuse to put client names into another tool. Trust is the product.",
      deduction: 6,
    },
    {
      point: "No independent source shows what studios pay for proposal help today.",
      deduction: 4,
    },
  ],
  falsify:
    "If five owners who sent a proposal last month cannot name how many hours it took, the pain is folklore.",
  question: "How many hours did the last proposal take, and who owned it?",
  touch: "high",
  needsSpend: false,
  markets: ["United States", "United Kingdom"],
  tasks: [
    { id: "t1", label: "Write the one question you will ask", done: true },
    { id: "t2", label: "List 15 studios you can reach without buying a list", done: false },
    { id: "t3", label: "Hold five conversations", done: false },
    { id: "t4", label: "Keep or kill, in writing", done: false },
  ],
  interviews: [],
  saved: true,
  status: "testing",
};

const intake: Opportunity = {
  id: "intake-desk",
  title: "After-hours intake for solo law practices",
  buyer: "Solo lawyers and two-person practices",
  pain: "After six the phone becomes voicemail, and the matter starts with whoever calls back first.",
  instead: "An answering service that takes a name and a number, and a full inbox in the morning.",
  hypothesis:
    "A monthly line that captures the conflict check and the reason for calling, then hands over a morning brief.",
  score: 74,
  confidence: "Moderate",
  dimensions: [
    { id: "pain", label: "Pain clarity", score: 80, weight: 25 },
    { id: "evidence", label: "Evidence", score: 73, weight: 20 },
    { id: "reach", label: "Reach", score: 68, weight: 20 },
    { id: "economics", label: "Recurring economics", score: 76, weight: 20 },
    { id: "solo", label: "Solo feasibility", score: 70, weight: 15 },
  ],
  sources: [
    {
      id: "l1",
      title: "After-hours calls at small firms",
      domain: "practicebar.example",
      excerpt:
        "Solo respondents said evening calls are often the consult that decides the matter, and most still land in voicemail.",
      ageDays: 22,
      kind: "independent",
    },
    {
      id: "l2",
      title: "What clients do when nobody picks up",
      domain: "civicadvice.example",
      excerpt:
        "People described calling the next listed lawyer the same night rather than waiting for a morning callback.",
      ageDays: 61,
      kind: "independent",
    },
    {
      id: "l3",
      title: "Intake product comparison",
      domain: "lawstack.example",
      excerpt:
        "A vendor overview of intake tools. Useful for the category, not for proof that anyone is in pain.",
      ageDays: 15,
      kind: "vendor",
    },
  ],
  critique: [
    {
      point: "Conflict checks and confidentiality make a generic bot a liability, not a shortcut.",
      deduction: 10,
    },
    {
      point: "Answering services already sell this job. You need a reason to switch, not a nicer transcript.",
      deduction: 6,
    },
  ],
  falsify:
    "If five solos say a missed evening call has never cost them a consult, stop.",
  question: "When did a missed evening call last cost you a consult?",
  touch: "high",
  needsSpend: true,
  markets: ["United States"],
  tasks: [
    { id: "i1", label: "Find five solos who still use voicemail", done: false },
    { id: "i2", label: "Ask about the last missed consult", done: false },
    { id: "i3", label: "Price one month against their answering bill", done: false },
  ],
  interviews: [],
  saved: true,
  status: "paused",
};

const recall: Opportunity = {
  id: "recall-briefs",
  title: "Recall briefs for independent consultants",
  buyer: "Solo consultants with a few dozen past clients",
  pain: "They remember the room, not the decision, and walk into a renewal from memory.",
  instead: "A notes app, and search that fails on the nickname they actually use.",
  hypothesis:
    "A monthly brief that resurfaces the last decision, the open risk, and who to write before a renewal date.",
  score: 69,
  confidence: "Limited",
  dimensions: [
    { id: "pain", label: "Pain clarity", score: 71, weight: 25 },
    { id: "evidence", label: "Evidence", score: 62, weight: 20 },
    { id: "reach", label: "Reach", score: 77, weight: 20 },
    { id: "economics", label: "Recurring economics", score: 66, weight: 20 },
    { id: "solo", label: "Solo feasibility", score: 80, weight: 15 },
  ],
  sources: [
    {
      id: "r1",
      title: "Renewal notes from a consultant community",
      domain: "fractional.example",
      excerpt:
        "Several independents said they reopen an engagement by rereading email, because their notes name the project and not the decision.",
      ageDays: 27,
      kind: "independent",
    },
    {
      id: "r2",
      title: "What gets lost between retainers",
      domain: "fieldnotes.example",
      excerpt:
        "A long gap makes the consultant look new. Clients notice when last quarter’s risk is forgotten.",
      ageDays: 48,
      kind: "independent",
    },
  ],
  critique: [
    {
      point: "A calendar reminder and a decent note already do most of this. The bar is habit, not software.",
      deduction: 8,
    },
    {
      point: "Limited evidence. The score cannot be read as strong demand.",
      deduction: 6,
    },
  ],
  falsify:
    "If five consultants can open the last decision in under a minute, they do not need a brief.",
  question: "Can you open the last decision you made for this client in under a minute?",
  touch: "low",
  needsSpend: false,
  markets: ["United States", "United Kingdom", "Hong Kong"],
  tasks: [
    { id: "c1", label: "Ask five consultants to find a last decision live", done: false },
    { id: "c2", label: "Note whether they were embarrassed by the search", done: false },
  ],
  interviews: [],
  saved: false,
  status: "testing",
};

export const seedOpportunities: Opportunity[] = [proposal, intake, recall];

export const seedRuns: Run[] = [
  {
    id: "run-seed",
    name: "Recurring offers from studio work",
    createdAt: "2026-10-28T15:00:00.000Z",
    brief: {
      craft: seedProfile.craft,
      hours: seedProfile.hours,
      capital: seedProfile.capital,
      reach: seedProfile.reach,
      geography: seedProfile.geography,
      goal: seedProfile.goal,
    },
    opportunityIds: ["proposal-studio", "intake-desk", "recall-briefs"],
    dropped: [dropped],
  },
];

export function isoWeek(date = new Date()) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function capitalLabel(id: Capital) {
  return CAPITALS.find((c) => c.id === id)?.label ?? id;
}

export function fitNotes(opp: Opportunity, profile: Profile) {
  const notes: string[] = [];
  if (profile.hours <= 8 && opp.touch === "high") {
    notes.push("This needs selling time your week does not have.");
  }
  if (profile.capital === "under2k" && opp.needsSpend) {
    notes.push("The early test here usually costs money, not just evenings.");
  }
  if (
    profile.geography !== "Global" &&
    !opp.markets.includes(profile.geography)
  ) {
    notes.push(
      `Sources were gathered for ${opp.markets.join(" and ")}. Your market is ${profile.geography}. Treat the score as a hint.`,
    );
  }
  if (notes.length === 0) {
    notes.push("Fits the hours, budget, and market on your profile.");
  }
  return notes;
}

export function staleCount(opps: Opportunity[]) {
  return opps.reduce(
    (n, opp) => n + opp.sources.filter((s) => s.ageDays >= STALE_DAYS).length,
    0,
  );
}

export function pickMove(opps: Opportunity[]) {
  const byScore = (list: Opportunity[]) =>
    [...list].sort((a, b) => b.score - a.score);
  const testing = opps.filter((o) => o.saved && o.status === "testing");
  if (testing.length) return { opp: byScore(testing)[0], kind: "testing" as const };
  const paused = opps.filter((o) => o.saved && o.status === "paused");
  if (paused.length) return { opp: byScore(paused)[0], kind: "paused" as const };
  const open = opps.filter((o) => o.status !== "killed");
  if (open.length) return { opp: byScore(open)[0], kind: "unsaved" as const };
  return null;
}

export function openTask(opp: Opportunity) {
  return opp.tasks.find((t) => !t.done) ?? null;
}

export const DROPPED = dropped;
