// ---------------------------------------------------------------------------
// AMUMA Circle — the digital-nomad investment tier for the San Vicente resorts
// (Marina Terrace and BAIA). Every figure on the /investment page comes from
// this module so numbers live in exactly one place. Content is taken verbatim
// in substance from the AMUMA Circle Business Plan; nothing here is invented.
// ---------------------------------------------------------------------------

export interface AmumaTier {
  name: string;
  investment: string;
  units: string;
  pebbles: string;
  availability: string;
}

export const AMUMA_CONTACT = {
  email: "hello@amuma.ph",
  legalEmail: "legal@amuma.ph",
  phone: "+63 917 000 0000",
  founder: "Giacomo Gervasutti, Founder & Vision Director",
};

export const AMUMA_MEANING =
  "AMUMA is an ancestral Visayan word meaning to nurture, to care for, and to tend with attention.";

export const AMUMA_EXECUTIVE_SUMMARY = [
  "AMUMA is a membership-based boutique resort collection rooted in the ancestral Visayan word meaning to nurture, to care for, and to tend with attention. The venture reimagines luxury hospitality by inviting members to become co-creators of destinations rather than mere guests.",
  "Through the AMUMA Circle membership model, holders of Circle Units participate directly in the shared rental revenue pool, earning projected annual returns of 17–20% based on conservative occupancy assumptions. The first chapter opens in San Vicente, Palawan, with an intimate collection of 4 Suites and 2 Villas designed along the pristine coastline of Long Beach.",
  "AMUMA's Hidden Destinations strategy deliberately avoids saturated tourism hubs, building instead in undiscovered locations across the Philippines, Laos, Indonesia, and Timor. With four investment tiers ranging from ₱500,000 to ₱4,000,000, the Founding Circle offers early members exclusive access, naming rights on the founding plaque, and priority in future share offerings. The venture is led by an experienced founding team combining hospitality ownership, creative production, and legal strategy, positioning AMUMA to define a new category of mindful, member-owned travel.",
];

export const AMUMA_MEMBERSHIP = {
  intro:
    "AMUMA Circle transforms hotel ownership into a participatory membership. Members acquire Circle Units, which function as investment shares in a specific destination. Each unit grants holders two distinct values: co-creation rights in the destination's development, and revenue participation in the shared rental pool generated when suites and villas are booked by external guests.",
  flywheelNote:
    "This structure aligns member incentives with operational performance, creating a flywheel where engaged members attract new members, new members fund new retreats, and each retreat generates revenue that flows back to the Circle.",
  coCreation:
    "Members vote on key design and programming decisions, receive early access to future retreat offerings, and are listed as Founding Circle members. Each destination allocates a fixed number of Circle Units that correspond to its accommodations, ensuring every member's stake maps directly to real physical assets.",
  revenue:
    "Profits after operating expenses and taxes are distributed 60% to Circle Members and 40% to the AMUMA Operator. Members track expected yearly profits in real time through the Member Portal, giving full transparency into occupancy, rates, and operating costs.",
};

export const AMUMA_PEBBLES = {
  intro:
    "Pebbles is AMUMA's internal lifestyle currency, distributed annually to every Circle Member. Pebbles can be spent exclusively within the AMUMA ecosystem on suite and villa nights, dining, excursions, boat trips, spa treatments, and experiences.",
  cycle:
    "The currency renews on a fixed annual cycle: Pebbles expire each 9 July and a new batch is released on 10 July. This expiry model encourages consistent engagement while ensuring that members experience the full breadth of each destination throughout the year. Pebbles are also transferable — members may send or receive Pebbles as gifts within the Member Portal.",
  generosity:
    "A Nova member receiving 1,000 Pebbles annually can enjoy approximately 5 suite nights per year in low season, or a combination of shorter stays complemented by dining, spa treatments, and boat excursions. Higher tiers such as Polaris, with 8,000 Pebbles, unlock extended villa stays and full culinary journeys across multiple seasons.",
  rates: {
    head: ["Accommodation", "Low Season", "Mid Season", "High Season"],
    rows: [
      ["Suites", "150 Pebbles", "250 Pebbles", "300 Pebbles"],
      ["Villas", "275 Pebbles", "420 Pebbles", "500 Pebbles"],
    ],
  },
};

export const AMUMA_HIDDEN_DESTINATIONS = {
  intro:
    "AMUMA's land acquisition and development strategy is anchored in the belief that the most meaningful travel experiences are found where tourism has not yet arrived. The Hidden Destinations strategy commits the company to building exclusively in undiscovered locations — places with extraordinary natural beauty but minimal commercial development.",
  advantages: [
    "Lower land acquisition costs.",
    "Authentic cultural and ecological experiences.",
    "First-mover positioning in destinations poised for future growth.",
  ],
  philippines: [
    "Remote islands of Balabac in Palawan",
    "The mountains of Bukidnon",
    "The island province of Siquijor",
    "Sibuyan Island in Romblon",
    "Future locations including Sagada and Batanes",
  ],
  southeastAsia: [
    "The UNESCO town of Luang Prabang in Laos",
    "The Togean Islands of Indonesia",
    "Exploration of Timor for long-term expansion",
  ],
  screening:
    "Each destination is selected through a rigorous screening process evaluating accessibility, natural assets, local community openness, and regulatory feasibility. AMUMA Holding has already secured beachfront land in Balabac for the second retreat, demonstrating the pipeline's credibility.",
};

export const AMUMA_TIERS: AmumaTier[] = [
  { name: "Nova", investment: "₱500,000", units: "50 Units", pebbles: "1,000", availability: "20 spots (Founding Circle)" },
  { name: "Aurora", investment: "₱1,200,000", units: "120 Units", pebbles: "2,200", availability: "Open" },
  { name: "Orion", investment: "₱2,000,000", units: "210 Units", pebbles: "4,000", availability: "Open" },
  { name: "Polaris", investment: "₱4,000,000", units: "440 Units", pebbles: "8,000", availability: "Open" },
];

export const AMUMA_TIERS_NOTE =
  "Each tier provides proportional ownership in the Member Investment Pool. Nova's 50 units represent 1.79% ownership of the total 4,400 Circle Units allocated for San Vicente, of which 2,800 are member-held and 1,600 are developed by AMUMA Holding as proof of work. Early tiers also receive priority access to future offerings and are eligible for the annual Founders' Dinner.";

export const AMUMA_REVENUE = {
  intro:
    "AMUMA's revenue model is built on nightly external rates that reflect the boutique positioning of each property. Rates are quoted per night for 2 guests, including breakfast, and vary by season. The indicative rates at AMUMA San Vicente establish the pricing architecture that will be adapted to each destination.",
  rates: {
    head: ["Accommodation", "Low Season", "Mid Season", "High Season"],
    rows: [
      ["Suite", "₱7,500", "₱12,500", "₱15,000"],
      ["Villa", "₱13,000", "₱20,000", "₱25,000"],
    ],
  },
  split:
    "Profits are calculated after operating expenses and a 5% tourism tax on gross revenue under TIEZA zoning rules. Net profits are then distributed 60% to Circle Members and 40% to the AMUMA Operator. This structure ensures that operational excellence directly benefits the membership base, creating a strong incentive for the operator to maximize occupancy and rate.",
};

export const AMUMA_RETURNS = {
  intro:
    "AMUMA's financial projections are built on deliberately conservative assumptions. The core assumption is 55% average annual occupancy, which is below the typical boutique resort benchmark of 60–65%, providing a comfortable buffer against market variability. Combined with the boutique positioning that commands premium rates, this yields a projected annual ROI of 17–20%.",
  novaExample: [
    ["Investment", "₱500,000"],
    ["Circle Units", "50 shares"],
    ["Ownership (of 2,800 member units)", "1.79%"],
    ["Annual Pebbles", "1,000"],
    ["Member Pool Share of Net Profit", "60%"],
    ["Estimated Annual Return", "~₱85,000 – ₱100,000"],
    ["Projected ROI", "17–20%"],
    ["Experience Value (Pebbles)", "~5 suite nights, or multiple short stays plus spa, dining and excursions"],
  ],
};

export const AMUMA_FLYWHEEL = [
  { title: "Members Join", body: "New Circle Members acquire units and receive Pebbles, funding initial construction." },
  { title: "Retreats Built", body: "Capital is deployed to construct boutique properties in hidden destinations." },
  { title: "Experiences Generate Revenue", body: "External guests book suites and villas at premium rates." },
  { title: "Returns Fund Expansion", body: "Profits are distributed to members, while the operator's 40% share funds the next project." },
  { title: "New Members Join", body: "Proven returns attract additional Circle Members." },
  { title: "New Destinations Appear", body: "Expansion capital activates the next hidden location." },
];

export const AMUMA_FLYWHEEL_NOTE =
  "The flywheel's compounding effect means that each new destination increases the total experience value for all members, as Pebbles can be spent across the entire collection. A member who joins at the Nova tier gains access to every future retreat without additional investment.";

export const AMUMA_PILLARS = [
  { icon: "Sparkles", title: "Wellness", body: "Morning yoga and meditation on dedicated decks, massage therapies using local techniques, and deliberately slow moments structured into each day." },
  { icon: "Waves", title: "Sea & Adventure", body: "Boat excursions to hidden coves, snorkeling over pristine reefs, island hopping, and guided fishing trips with local boatmen." },
  { icon: "Compass", title: "Island Exploration", body: "Guided treks to hidden beaches, waterfalls, and mountain trails, plus visits to local villages that reveal authentic island life." },
  { icon: "UtensilsCrossed", title: "Culinary Journeys", body: "Seasonal menus built from local ingredients, shared dinners under the open sky, seafood feasts caught the same morning, and hands-on cooking with village chefs." },
  { icon: "Users", title: "Community Moments", body: "Long shared tables, sunset gatherings on the beach, and spontaneous encounters that turn fellow guests and staff into a genuine community." },
];

export const AMUMA_SAN_VICENTE = {
  intro:
    "AMUMA's inaugural property is located on the pristine coastline of Long Beach in San Vicente, Palawan — one of the longest white-sand beaches in the Philippines. The retreat is designed as an intimate collection of 4 Suites and 2 Villas, deliberately small to preserve exclusivity and minimize environmental footprint.",
  architecture:
    "Architecture follows an open, breathable design language using natural wood and stone, with private courtyards and plunge pools in the villas that blur the boundary between indoor comfort and tropical nature.",
  allocation: {
    head: ["Accommodation", "Count", "Circle Units per Type", "Total Circle Units"],
    rows: [
      ["Suites", "4", "600", "2,400"],
      ["Villas", "2", "1,000", "2,000"],
      ["Total", "6", "—", "4,400"],
    ],
  },
  proofOfWork:
    "Of the 4,400 total Circle Units, AMUMA Holding develops the first 1,600 units (covering 1 Suite and 1 Villa) as proof of work — demonstrating the company's own capital commitment. Circle Members provide the remaining 2,800 units. The second retreat will follow in Balabac, where AMUMA already owns beachfront land, accelerating the timeline for the next chapter.",
};

export const AMUMA_ROADMAP = [
  ["2026", "San Vicente construction begins; first Circle Members join the Founding Circle."],
  ["2028", "San Vicente opens; first guests arrive and rental income begins flowing to members."],
  ["2029", "Balabac groundbreaking; new Circle Units offered for the second retreat."],
  ["2030", "Philippines expansion land acquisition; new destination programming launched."],
  ["2031", "Balabac opens as the beachfront flagship of the collection."],
  ["2032", "Indonesia land acquisition for the Togean Islands; simultaneous groundbreaking of Bukidnon or Sibuyan Island."],
  ["2033", "Bukidnon or Sibuyan Island opens, beginning the Philippines expansion phase."],
  ["2035", "First international AMUMA opens at the Togean Islands, Indonesia."],
];

export const AMUMA_ROADMAP_NOTE =
  "This timeline assumes successful fundraising and normal construction permitting. The two-year gap between groundbreaking and opening (2026–2028, 2029–2031) reflects realistic construction durations for boutique properties in remote locations, including logistics for materials and labor.";

export const AMUMA_TEAM = [
  {
    name: "Giacomo Gervasutti",
    role: "Founder & Vision Director",
    body: "Italian entrepreneur and owner of Baia Boutique Resort, the Marina Terrace restaurant and accommodations, and the Pasticci.ph private dining club. Giacomo brings hands-on hospitality operating experience and the aesthetic discipline of Italian boutique hospitality.",
  },
  {
    name: "Irina Feleo",
    role: "Cofounder & Creative Director",
    body: "Award-winning Filipino actress and creative producer. Irina shapes the AMUMA brand narrative, experience programming, and cultural authenticity across all destinations.",
  },
  {
    name: "Joaquin Esquivias",
    role: "Chief Legal & Strategy Officer",
    body: "Entrepreneur and tax & corporate lawyer. Joaquin structures the membership entity, navigates TIEZA zoning, and ensures regulatory compliance across Philippine and international jurisdictions.",
  },
];

export const AMUMA_PORTAL = {
  intro:
    "The Member Portal is AMUMA's digital backbone — a web application that serves as the central hub for all member activity, designed for transparency, convenience, and community.",
  features: [
    ["Reservations", "Reserve suites and villas using Pebbles, with live availability across all destinations."],
    ["Experience Booking", "Island hopping, private cars, airport transfers, and scooter rentals booked directly."],
    ["In-Resort Orders", "Food and beverages within resorts, plus internal services such as massages, spa treatments, and private dinners."],
    ["Financial Dashboard", "Real-time Pebble balance monitoring and tracking of expected yearly profits."],
    ["Gifting & Transfers", "Send or receive Pebbles as gifts to fellow members."],
    ["Direct Communication", "Message resort staff directly for personalized service."],
    ["Club Updates", "Event invitations, development progress tracking, and club news."],
    ["Governance", "Internal voting on key decisions affecting the collection."],
  ],
  closing:
    "The portal is the primary tool for member retention and engagement, converting one-time investors into active, lifelong participants in the AMUMA community.",
};

export const AMUMA_MARKET = {
  intro:
    "The global boutique hospitality sector has grown steadily, driven by travelers seeking authentic, localized experiences over standardized luxury. In the Philippines, the tourism industry rebounded strongly post-pandemic, with international arrivals recovering and domestic tourism showing robust growth.",
  macroTrends: [
    "The rise of the experience economy has shifted consumer preference toward immersive, meaningful travel.",
    "The growth of fractional and membership-based ownership models — from private clubs to branded residences — has educated affluent travelers on the value of shared access over outright ownership.",
  ],
  competitors:
    "Established resort operators (e.g. El Nido Resorts, Amanpulo) dominate the premium Palawan segment but focus on conventional hotel stays. Private clubs like Soho House and exclusive models like Inspirato demonstrate the appetite for membership-based access.",
  differentiation:
    "No current operator combines membership investment with destination co-creation in the Philippine and Southeast Asian hidden-destination space. AMUMA's differentiation is structural: members are not just customers but co-owners entitled to rental revenue. This aligns the entire business around member value in a way that traditional resort models cannot replicate.",
  external: [
    "TIEZA zoning provides tax incentives that lower the effective tax burden on tourism enterprises.",
    "Infrastructure development in Palawan, including the planned San Vicente airport upgrades, improves accessibility.",
    "Rising regional demand from high-net-worth individuals in Hong Kong, Singapore, and Australia supports premium rate sustainability.",
  ],
};

export const AMUMA_OPERATIONS = {
  intro:
    "AMUMA's operational model is designed for lean, high-quality delivery across multiple remote destinations. Each property operates with a small, locally hired team overseen by a central management layer.",
  staffing: [
    ["General Manager", "Overall property leadership, guest relations, and local community engagement (1 per property)."],
    ["Hospitality Staff", "Front desk, housekeeping, and concierge (6–8 per property, reflecting the 6-unit scale)."],
  ],
};

export const AMUMA_FINANCIALS = {
  intro:
    "The financial plan projects AMUMA's performance across a five-year horizon following the opening of San Vicente. All figures are in Philippine pesos (₱) and are based on conservative assumptions. Revenue generation begins in 2028, the scheduled opening year.",
  assumptions: {
    head: ["Financial Assumption", "Value", "Notes"],
    rows: [
      ["Average Annual Occupancy", "55%", "Conservative; boutique resorts typically run 60–65%"],
      ["RevPAR (Blended Rate)", "~₱8,500", "Weighted average of suite & villa rates across seasons"],
      ["Operating Expenses (% of Gross)", "48%", "Staffing, F&B, energy, maintenance, marketing"],
      ["Tourism Tax (TIEZA)", "5%", "Fixed on gross revenue under TIEZA zoning"],
      ["Member Profit Share", "60%", "Of net profit after expenses & taxes"],
      ["Operator Share", "40%", "AMUMA Operator retained earnings"],
    ],
  },
  income: {
    head: ["Line Item (₱M)", "2028", "2029", "2030", "2031", "2032"],
    rows: [
      ["Room Revenue", "12.0", "16.4", "20.1", "23.8", "27.5"],
      ["F&B & Experiences Revenue", "4.8", "6.6", "8.0", "9.5", "11.0"],
      ["Gross Revenue", "16.8", "23.0", "28.1", "33.3", "38.5"],
      ["Operating Expenses (48%)", "(8.1)", "(11.0)", "(13.5)", "(16.0)", "(18.5)"],
      ["Tourism Tax (5%)", "(0.8)", "(1.2)", "(1.4)", "(1.7)", "(1.9)"],
      ["Net Profit", "7.9", "10.8", "13.2", "15.6", "18.1"],
      ["Member Share (60%)", "4.7", "6.5", "7.9", "9.4", "10.9"],
      ["Operator Share (40%)", "3.2", "4.3", "5.3", "6.2", "7.2"],
    ],
  },
  cashflow: {
    head: ["Line Item (₱M)", "2028", "2029", "2030", "2031", "2032"],
    rows: [
      ["Beginning Cash", "2.0", "8.4", "15.7", "24.0", "33.9"],
      ["Net Cash from Operations", "7.9", "10.8", "13.2", "15.6", "18.1"],
      ["Member Distributions", "(1.5)", "(3.5)", "(4.9)", "(5.7)", "(6.5)"],
      ["Capital Expenditure (CapEx)", "(0.0)", "(0.0)", "(0.0)", "(0.0)", "(0.0)"],
      ["Ending Cash", "8.4", "15.7", "24.0", "33.9", "45.5"],
    ],
  },
  useOfFunds: {
    head: ["Category", "Allocation", "Amount (₱)", "Description"],
    rows: [
      ["Infrastructure & Construction", "55%", "~27.5M", "Site preparation, buildings, pools, solar, water systems"],
      ["Operational Setup & Pre-Opening", "15%", "7.5M", "Staffing, training, licenses, F&B initial stock"],
      ["Technology & Member Portal", "10%", "5.0M", "PMS integration, webapp development, cybersecurity"],
      ["Marketing & Founding Circle", "10%", "5.0M", "Brand launch, investor events, PR, digital campaigns"],
      ["Reserves & Contingency", "10%", "5.0M", "Cost overruns, regulatory buffers, working capital"],
      ["Total", "100%", "50.0M", "—"],
    ],
  },
  structure:
    "AMUMA employs a single, clearly defined financing structure — a member equity model. There is no debt facility in the current structure; all development capital comes from Circle Member subscriptions and AMUMA Holding's own equity contribution. This keeps the model simple and fully aligned: members are genuine shareholders in the underlying real estate and operating vehicle.",
};

export const AMUMA_FOUNDING_CIRCLE = {
  intro:
    "The Founding Circle is AMUMA's inaugural membership cohort, limited to 20 exclusive Nova spots at ₱500,000 each. Founding Circle members receive exceptional privileges that recognize their early belief in the vision.",
  benefits: [
    "50 membership stakes (1.79% of the Member Investment Pool).",
    "1,000 annual Pebbles for stays and experiences.",
    "Early access to all future retreats before public offering.",
    "Name on the founding plaque at the San Vicente Retreat.",
    "First access to future share offerings across the collection.",
    "Annual private video update from the founding team.",
    "Invitation to the annual Founders' Dinner.",
    "Listing as a Founding Circle member on the AMUMA website.",
  ],
  process:
    "Prospective Founding Circle members apply through a structured process that allows AMUMA to curate a high-quality community. Applications are reviewed by the founding team to ensure alignment with the AMUMA ethos of nurturing, caring, and tending with attention.",
};

export const AMUMA_RISKS = {
  head: ["Risk Category", "Risk Description", "Mitigation"],
  rows: [
    ["Construction Delays", "Remote locations may face logistical delays.", "A 10% contingency reserve; phasing construction to prioritize the first suite and villa; pre-approved contractor relationships."],
    ["Market Conditions", "Travel demand may soften.", "A conservative 55% occupancy assumption; a diversified member base across geographies; flexible rate structures."],
    ["Regulatory & Tax Changes", "TIEZA zoning rules may change.", "Legal counsel on zoning; regular regulatory monitoring; contingency in tax design."],
    ["Operational Challenges", "Staffing remote properties is complex.", "Local hiring with rigorous training; competitive compensation; cross-training of staff."],
    ["Liquidity Limitations", "Circle Units are not freely tradeable.", "Clear member communication; a structured buyback mechanism under review; transparent financial reporting."],
  ],
};

export const AMUMA_LEGAL = {
  securities:
    "Circle Units offered in connection with this business plan are not registered as securities under U.S. law. Accordingly, securities are not offered in the United States or to U.S. persons (as defined under Regulation S of the U.S. Securities Act of 1933). All offerings are conducted outside the U.S. in compliance with applicable local laws.",
  forwardLooking:
    "Projections, estimates, and forward-looking statements are based on current expectations and involve risks and uncertainties. Past performance of Baia Boutique Resort or other entities of Giacomo Gervasutti does not indicate future results. Actual outcomes may differ materially.",
  ip:
    "All AMUMA brand assets, including the name, logo, Pebbles currency system, and proprietary membership model, are protected under Philippine and international copyright and trademark law.",
  governance:
    "The venture is governed under the laws of the Republic of the Philippines. Any disputes shall be submitted to the exclusive jurisdiction of the courts of Makati City. For inquiries, contact legal@amuma.ph. All rights reserved. Copyright © 2026 AMUMA Collection.",
};

export const AMUMA_CLOSING =
  "We invite you to join the AMUMA Circle as a Founding Member and help nurture the hidden destinations of Southeast Asia.";

export const AMUMA_HEARD_OPTIONS = [
  "Marina Terrace",
  "BAIA Boutique Resort",
  "A friend or existing member",
  "Social media",
  "Press or article",
  "Event or introduction",
  "Other",
];
