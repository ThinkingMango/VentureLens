export const founderRoles = [
  "Aspiring founder",
  "Exploring a side business",
  "Experienced founder",
  "Independent professional",
  "Student or recent graduate",
  "Employee exploring entrepreneurship",
  "Small business owner",
  "Creator or community builder",
  "Returning to work or changing careers",
  "Still exploring my options",
] as const;

export const founderIndustries = [
  "Professional services",
  "B2B SaaS",
  "Finance & operations",
  "Healthcare",
  "Education",
  "Retail & e-commerce",
  "Marketing & media",
  "Real estate & property",
  "Travel & hospitality",
  "Manufacturing & engineering",
  "Logistics & transportation",
  "Supply chain & procurement",
  "Food & agriculture",
  "Energy & sustainability",
  "Legal & compliance",
  "HR & recruitment",
  "Nonprofits & social impact",
  "Consumer products & services",
  "No specific industry yet",
] as const;

export const founderGoals = [
  "Build a sustainable side business",
  "Transition to full-time entrepreneurship",
  "Find a scalable startup opportunity",
  "Expand my consulting practice",
  "Validate an idea I already have",
  "Create a small, profitable business",
  "Productize my expertise",
  "Grow an existing business",
  "Build a business with social impact",
  "Learn and explore before committing",
] as const;

// Ordered from the specific (what a newcomer could not copy) to the general.
export const skillSuggestions = [
  "Senior leadership and P&L or budget ownership",
  "Deep knowledge of a region or cross-border market",
  "Supply chain, sourcing and supplier management",
  "Regulation, compliance and risk",
  "Research and analysis",
  "Sales and customer relationships",
  "Marketing and content",
  "Software and automation",
  "Operations and project management",
  "Design and creativity",
  "I am starting out and still exploring my strengths.",
] as const;

// Suggested interests for profile v2 (WP-02): added to the free-text answer, which the founder then edits.
export const interestSuggestions = [
  "Health and wellbeing",
  "Education and learning",
  "Climate and sustainability",
  "Software for small businesses",
  "Food and hospitality",
  "Money and personal finance",
  "Creative tools",
  "Local and home services",
] as const;

// Short explanations shown when a founder hovers over or focuses the info icon next to an industry.
export const founderIndustryHints: Partial<Record<(typeof founderIndustries)[number], string>> = {
  "Professional services":
    "Expertise sold by the hour or project. E.g. consulting, accounting, architecture, IT services.",
  "B2B SaaS":
    "Subscription software sold to businesses. E.g. CRM, invoicing, scheduling or analytics tools.",
  "Finance & operations":
    "Money and back-office work. E.g. banking, insurance, bookkeeping, payroll, FP&A.",
  Healthcare:
    "Care and the systems around it. E.g. clinics, pharmacy, medical devices, wellness, elder care.",
  Education:
    "Teaching and learning. E.g. schools, tutoring, online courses, corporate training.",
  "Retail & e-commerce":
    "Selling products to shoppers. E.g. shops, online stores, marketplaces, Amazon sellers.",
  "Marketing & media":
    "Reaching and engaging audiences. E.g. agencies, advertising, PR, publishing, content creation.",
  "Real estate & property":
    "Buildings and land. E.g. agency, property management, development, construction, facilities.",
  "Travel & hospitality":
    "Trips and guest experiences. E.g. hotels, restaurants, tour operators, events, airlines.",
  "Manufacturing & engineering":
    "Designing and making physical things. E.g. factories, industrial equipment, electronics, automotive.",
  "Logistics & transportation":
    "Moving goods and people. E.g. freight, shipping, warehousing, couriers, fleet management.",
  "Supply chain & procurement":
    "Sourcing and buying for organisations. E.g. supplier management, purchasing, import/export, inventory.",
  "Food & agriculture":
    "Growing, producing and selling food. E.g. farming, food processing, F&B brands, catering.",
  "Energy & sustainability":
    "Power and the environment. E.g. solar, utilities, EV charging, recycling, ESG reporting.",
  "Legal & compliance":
    "Law and regulation. E.g. law firms, contracts, regulatory affairs, risk and audit.",
  "HR & recruitment":
    "Finding and managing people. E.g. hiring, staffing agencies, payroll, training, employee benefits.",
  "Nonprofits & social impact":
    "Mission-driven work. E.g. charities, NGOs, social enterprises, community and public programmes.",
  "Consumer products & services":
    "Things people buy for themselves. E.g. beauty, fitness, pets, home services, apparel.",
  "No specific industry yet":
    "That is fine. VentureLens will lean on your skills and interests instead of one industry.",
};
