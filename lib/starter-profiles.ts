import type { Profile } from "./workspace-schema.ts";

/**
 * Starter profiles (WP-02): four common founder situations. Choosing one fills the profile form; the founder edits it
 * and nothing is saved until they confirm. Free text is English source copy, shown in the interface language through
 * copy(), so the founder starts from text in their own language. Their name and languages are never overwritten.
 * Every value is one the profile form accepts: hours, budget, strength, revenue target and risk are fixed options,
 * and role, industry and goal are among the form's suggested answers.
 */
export type StarterProfile = {
  id: string;
  title: string;
  description: string;
  profile: Omit<Required<Profile>, "name" | "languages">;
};

export const starterProfiles = [
  {
    id: "engineer-side",
    title: "Engineer, 5–10 h/week",
    description: "A software engineer with a day job, building something small on evenings and weekends.",
    profile: {
      role: "Employee exploring entrepreneurship",
      industry: "B2B SaaS",
      skills: "Software engineering, APIs and automation; comfortable shipping a small product end to end.",
      hours: "5–10 hours",
      budget: "Under $1,000",
      goal: "Build a sustainable side business",
      interests: "Developer tools, workflow automation and software for small businesses.",
      pain_points: "Teams copying data between tools by hand, and spreadsheets that quietly run real operations.",
      distribution: "Former colleagues, and a small following in developer communities.",
      strength: "Technical",
      revenue_target: "$1–5k/mo",
      risk_tolerance: "Low",
      exclusions: "No hardware, and nothing that needs a sales team to sell.",
    },
  },
  {
    id: "consultant-leaving",
    title: "Consultant leaving corporate",
    description: "Years of client work and a network of buyers, ready to turn expertise into a product.",
    profile: {
      role: "Independent professional",
      industry: "Professional services",
      skills: "Ten years of consulting: process redesign, stakeholder interviews and writing proposals that win work.",
      hours: "20–40 hours",
      budget: "$5,000–15,000",
      goal: "Productize my expertise",
      interests: "Operations, procurement and compliance in mid-sized companies.",
      pain_points: "Clients paying again and again for the same diagnostic work.",
      distribution: "Former clients and partners at mid-sized companies who trust my work.",
      strength: "Balanced",
      revenue_target: "$5–20k/mo",
      risk_tolerance: "Medium",
      exclusions: "Nothing that needs venture funding.",
    },
  },
  {
    id: "creator-audience",
    title: "Creator with an audience",
    description: "An audience that already listens, looking for something they would pay for.",
    profile: {
      role: "Creator or community builder",
      industry: "Marketing & media",
      skills: "Making videos and newsletters; building and moderating an online community.",
      hours: "10–20 hours",
      budget: "$1,000–5,000",
      goal: "Create a small, profitable business",
      interests: "Education, and the hobbies my audience shares.",
      pain_points: "My audience keeps asking for tools and templates I do not sell.",
      distribution: "About 20,000 followers and a newsletter with engaged readers.",
      strength: "Sales & marketing",
      revenue_target: "$5–20k/mo",
      risk_tolerance: "Medium",
      exclusions: "No physical inventory.",
    },
  },
  {
    id: "operator-traditional",
    title: "Operator in a traditional industry",
    description: "Deep hands-on knowledge of an industry that still runs on paper and phone calls.",
    profile: {
      role: "Small business owner",
      industry: "Logistics & transportation",
      skills: "Fifteen years running warehouse and delivery operations; I know the suppliers, the paperwork and the regulations.",
      hours: "10–20 hours",
      budget: "$5,000–15,000",
      goal: "Create a small, profitable business",
      interests: "Logistics, field services and back-office work in traditional firms.",
      pain_points: "Dispatch and paperwork still run on phone calls, paper forms and group chats.",
      distribution: "Owners and managers of local logistics and trade businesses.",
      strength: "Operations",
      revenue_target: "$5–20k/mo",
      risk_tolerance: "Low",
      exclusions: "No consumer apps.",
    },
  },
] as const satisfies readonly StarterProfile[];

export const starterProfileIds = starterProfiles.map(starter => starter.id) as [string, ...string[]];
/** The free-text fields of a starter profile, which are shown in the interface language. */
export const starterTextFields = ["skills", "interests", "pain_points", "distribution", "exclusions"] as const;
