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

// Short explanations for the founder-journey question.
export const founderRoleHints: Partial<Record<(typeof founderRoles)[number], string>> = {
  "Aspiring founder":
    "You want to start a business but have not launched one yet.",
  "Exploring a side business":
    "You plan to build something alongside a job or other commitments, at least at first.",
  "Experienced founder":
    "You have started or run a business before, whether it succeeded or not.",
  "Independent professional":
    "You work for yourself already. E.g. freelancer, consultant, contractor or solo practitioner.",
  "Student or recent graduate":
    "You are studying or finished in the last few years and are weighing your first venture.",
  "Employee exploring entrepreneurship":
    "You have a full-time job and are testing whether founding is right for you.",
  "Small business owner":
    "You run an established business. E.g. a shop, agency, clinic or trade business.",
  "Creator or community builder":
    "You have an audience or community. E.g. newsletter, YouTube, podcast, meetup group.",
  "Returning to work or changing careers":
    "You are coming back after a break or moving into a new field, and see a business as one path.",
  "Still exploring my options":
    "No fixed plan yet. VentureLens will suggest a range of directions to compare.",
};

// Short explanations for the goals question.
export const founderGoalHints: Partial<Record<(typeof founderGoals)[number], string>> = {
  "Build a sustainable side business":
    "Steady extra income from a few hours a week, without quitting your job.",
  "Transition to full-time entrepreneurship":
    "Grow something that can replace your salary so you can leave employment.",
  "Find a scalable startup opportunity":
    "An idea that could grow fast and large, possibly with investors. E.g. software or a platform.",
  "Expand my consulting practice":
    "Win more or bigger clients, add services, or raise your rates in work you already do.",
  "Validate an idea I already have":
    "Test whether customers really want your idea before investing more time or money.",
  "Create a small, profitable business":
    "A business that pays you well without needing to become large. E.g. a niche service or shop.",
  "Productize my expertise":
    "Turn what you know into something sellable without your hours. E.g. courses, templates, software.",
  "Grow an existing business":
    "Add customers, products or markets to a business you already run.",
  "Build a business with social impact":
    "A business whose main purpose includes helping people or the planet, while paying its way.",
  "Learn and explore before committing":
    "See what is possible and build understanding before choosing a direction.",
};
