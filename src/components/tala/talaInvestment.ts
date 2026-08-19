// ---------------------------------------------------------------------------
// TALA Investment Sales Agent — conversation playbook for AMUMA Circle
//
// Gives TALA a structured sales framework instead of disconnected facts.
// Organized by conversation stage with objection handlers, proactive
// nudges, and lead capture logic. The model picks the right stage based
// on conversation context — no state machine needed.
// ---------------------------------------------------------------------------

import {
  AMUMA_TIERS,
  AMUMA_EXECUTIVE_SUMMARY,
  AMUMA_MEMBERSHIP,
  AMUMA_REVENUE,
  AMUMA_RETURNS,
  AMUMA_PEBBLES,
  AMUMA_FLYWHEEL,
  AMUMA_HIDDEN_DESTINATIONS,
  AMUMA_SAN_VICENTE,
  AMUMA_ROADMAP,
  AMUMA_TEAM,
  AMUMA_FOUNDING_CIRCLE,
  AMUMA_RISKS,
  AMUMA_CONTACT,
} from "@/lib/amumaData";

// ---------------------------------------------------------------------------
// Conversation stages — TALA moves through these based on visitor signals
// ---------------------------------------------------------------------------

export interface InvestmentStage {
  id: string;
  label: string;
  trigger: string[];
  systemPrompt: string;
}

export const INVESTMENT_STAGES: InvestmentStage[] = [
  {
    id: "hook",
    label: "Hook — capture interest",
    trigger: ["invest", "amuma", "circle", "membership", "ownership", "return", "roi", "share"],
    systemPrompt: `The visitor is interested in the AMUMA investment opportunity. Lead with the vision and the numbers:
- AMUMA means "to nurture" in Visayan — a membership-based boutique resort collection
- Members earn 17-20% projected annual ROI through co-ownership of hidden destinations
- Revenue split: 60% to members, 40% to operator
- Only 20 Founding Circle spots available at the entry tier (500,000 PHP)
Tell the story first. Don't dump tables. Make them feel the opportunity, then back it with a number.`,
  },
  {
    id: "story",
    label: "Story — build emotional connection",
    trigger: ["tell me more", "how does it work", "what is", "explain", "who", "vision", "founder"],
    systemPrompt: `The visitor wants to understand the AMUMA vision. Share the story:
- Founded by Giacomo Gervasutti (Baia Boutique Resort, Marina Terrace, Pasticci.ph), Irina Feleo (award-winning actress and creative producer), and Joaquin Esquivias (tax and corporate lawyer)
- Hidden Destinations strategy: building in undiscovered locations — Balabac, Bukidnon, Siquijor, Luang Prabang, Togean Islands
- The flywheel: members join → retreats built → revenue generated → returns fund expansion → new members join
- Five experience pillars: Wellness, Sea and Adventure, Island Exploration, Culinary Journeys, Community Moments
Make it feel like joining a movement, not buying a product.`,
  },
  {
    id: "value",
    label: "Value — justify the investment",
    trigger: ["tier", "price", "cost", "how much", "what do i get", "pebble", "unit", "share", "percent"],
    systemPrompt: `The visitor wants specifics on what they get. Walk them through the tiers:
- Nova: 500,000 PHP — 50 units — 1,000 Pebbles/year — 20 Founding Circle spots
- Aurora: 1,200,000 PHP — 120 units — 2,200 Pebbles/year
- Orion: 2,000,000 PHP — 210 units — 4,000 Pebbles/year
- Polaris: 4,000,000 PHP — 440 units — 8,000 Pebbles/year
Nova = 1.79% ownership of the 2,800 member-held units. Revenue is split 60/40 after 5% TIEZA tax and 48% operating costs. A Nova investor earns ~85,000-100,000 PHP/year.
Pebbles are lifestyle currency — spend on suite nights (150-300/night), dining, excursions, spa.`,
  },
  {
    id: "urgency",
    label: "Urgency — create FOMO",
    trigger: ["available", "spot", "left", "when", "deadline", "join", "apply", "founding"],
    systemPrompt: `The visitor is getting close to a decision. Create urgency:
- Only 20 Founding Circle spots at the Nova tier — once filled, the next tier opens at 1,200,000 PHP
- Founding Circle members get exclusive perks: name on the founding plaque, first access to future share offerings, invitation to the annual Founders' Dinner
- The first retreat (San Vicente) opens in 2028 — early members get the best entry price
- Balabac beachfront land is already secured — the pipeline is real
Don't be pushy. Be factual about scarcity. Let the numbers create the urgency.`,
  },
  {
    id: "close",
    label: "Close — drive action",
    trigger: ["apply", "sign up", "interested", "want to", "how do i", "next step", "contact", "email"],
    systemPrompt: `The visitor is ready to take the next step. Guide them to the application:
- The application form is at /investment — I can open it for you
- The founding team reviews every application personally
- It takes 2 minutes: name, email, phone, country, and an optional message about your interest
- You can also reach the team directly at hello@amuma.ph or +63 917 000 0000
Make it effortless. Offer to open the form. Don't make them search for it.`,
  },
];

// ---------------------------------------------------------------------------
// Objection handlers — pre-loaded responses for common hesitations
// ---------------------------------------------------------------------------

export const OBJECTION_HANDLERS: Record<string, string> = {
  liquidity: `Circle Units aren't publicly traded, but here's the real picture: you're earning 17-20% annually while you hold. That's the return — plus you get Pebbles to spend on resort stays, dining, and experiences. The buyback mechanism is under review, but the primary value is the ongoing yield, not flipping the asset.`,

  construction: `We have a 10% contingency reserve built into the budget and pre-approved contractor relationships. The two-year build window (2026-2028 for San Vicente) is realistic for boutique properties in remote locations. We've already secured beachfront land in Balabac for the second retreat — the pipeline is moving.`,

  occupancy: `55% is deliberately conservative. Boutique resorts in Palawan typically run 60-65%. We'd rather under-promise and over-deliver. Even at 55%, the math works — a Nova investor still earns 85,000-100,000 PHP a year on a 500,000 PHP investment.`,

  market: `Post-pandemic tourism in the Philippines has rebounded strongly. San Vicente is getting airport upgrades. Rising demand from Hong Kong, Singapore, and Australia supports premium rates. And our Hidden Destinations strategy means we're not competing in saturated markets — we're building where demand is about to arrive.`,

  trust: `The founding team brings real operating experience. Giacomo owns Baia Boutique Resort and Marina Terrace — these aren't plans on paper, they're running businesses. Irina brings creative direction and brand authenticity. Joaquin structures the legal and regulatory framework. We're not asking you to trust a pitch deck — we're asking you to join operators who've already built.`,

  returns: `The 17-20% ROI is built on conservative assumptions: 55% occupancy, 48% operating costs, 5% TIEZA tax, and a 60/40 member split. Revenue is projected at 16.8M PHP in year one (2028), growing to 38.5M by 2032. Net profit to members: 4.7M in year one, scaling to 10.9M. These aren't fantasy numbers — they're based on real rates at comparable boutique properties.`,

  pebbles: `Pebbles are your lifestyle currency. You get them annually and spend them on suite nights, dining, excursions, boat trips, and spa treatments. A Nova member with 1,000 Pebbles gets about 5 suite nights in low season, or a mix of shorter stays plus experiences. They renew every July 10th and are transferable — you can send them to family or friends.`,

  comparison: `No current operator combines membership investment with destination co-creation in Southeast Asia. El Nido Resorts and Amanpulo are conventional hotel stays. Soho House and Inspirato are membership access models. AMUMA is structural: you're a co-owner entitled to rental revenue. That's a fundamentally different value proposition.`,

  timeline: `San Vicente construction begins in 2026 and opens in 2028. Balabac groundbreaking is 2029, opening 2031. Indonesia (Togean Islands) is targeted for 2035. Each property follows a two-year build cycle. Revenue starts flowing to members as soon as each retreat opens.`,
};

// ---------------------------------------------------------------------------
// Proactive investment nudge — weave into resort conversations
// ---------------------------------------------------------------------------

export function investmentNudge(context: {
  roomPrice?: number;
  packageName?: string;
  topic?: string;
}): string | null {
  const { roomPrice, packageName, topic } = context;

  // When someone asks about room prices or stays
  if (topic === "pricing" || topic === "rooms" || topic === "stay") {
    return `Here's a thought — AMUMA Circle members don't pay rack rate. They use Pebbles. A Nova member gets 1,000 Pebbles a year, enough for about 5 suite nights in low season. And they're earning 17-20% on their investment while they enjoy the stays. Want to know more about the membership?`;
  }

  // When someone asks about tours or experiences
  if (topic === "tours" || topic === "island" || topic === "excursion") {
    return `These experiences are exactly what AMUMA Circle members get access to through Pebbles — island hopping, boat trips, diving, cultural immersions. Members don't just visit — they co-own the destinations. Interested in the investment side?`;
  }

  // When someone asks about the resort or location
  if (topic === "san vicente" || topic === "palawan" || topic === "resort") {
    return `San Vicente is actually where AMUMA opens its first retreat — 4 Suites and 2 Villas on Long Beach. Circle members co-own this property and earn rental revenue from external guests. The second retreat is already secured in Balabac. Want to hear about the investment opportunity?`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Lead capture — extract contact info from conversation
// ---------------------------------------------------------------------------

export interface InvestmentLead {
  name?: string;
  email?: string;
  phone?: string;
  interest: "high" | "medium" | "low";
  signals: string[];
}

export function detectInvestmentLead(text: string): Partial<InvestmentLead> {
  const lower = text.toLowerCase();
  const signals: string[] = [];
  let interest: InvestmentLead["interest"] = "low";

  // Email detection
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch) signals.push("email_shared");

  // Phone detection
  const phoneMatch = text.match(/(?:\+?63|0)9\d{9}/);
  if (phoneMatch) signals.push("phone_shared");

  // High interest signals
  const highSignals = [
    "i want to invest", "i'm interested", "count me in", "how do i apply",
    "i'd like to join", "sign me up", "i'm in", "let's do it",
    "open the form", "send me the application", "i want to be a founding",
  ];
  for (const s of highSignals) {
    if (lower.includes(s)) {
      signals.push(s);
      interest = "high";
      break;
    }
  }

  // Medium interest signals
  if (interest === "low") {
    const medSignals = [
      "tell me more", "how does it work", "what are the tiers",
      "what's the return", "explain the membership", "what do i get",
    ];
    for (const s of medSignals) {
      if (lower.includes(s)) {
        signals.push(s);
        interest = "medium";
        break;
      }
    }
  }

  return { email: emailMatch?.[0], phone: phoneMatch?.[0], interest, signals };
}

// ---------------------------------------------------------------------------
// Build the full investment system prompt for a given conversation stage
// ---------------------------------------------------------------------------

export function buildInvestmentPrompt(
  stage: InvestmentStage,
  conversationHistory: string[],
): string {
  const lines = [
    "## AMUMA INVESTMENT ADVISOR",
    "",
    stage.systemPrompt,
    "",
    "### KEY NUMBERS TO REFERENCE NATURALLY",
    `- Entry tier: ${AMUMA_TIERS[0].investment} for ${AMUMA_TIERS[0].units}`,
    `- Revenue split: 60% members / 40% operator`,
    `- Projected ROI: 17-20% at 55% occupancy`,
    `- Founding Circle: ${AMUMA_FOUNDING_CIRCLE.benefits.length} exclusive benefits, 20 spots`,
    `- First retreat: ${AMUMA_SAN_VICENTE.allocation.rows[2][2]} total Circle Units`,
    "",
    "### TONE",
    "- Speak with authority, not like a chatbot",
    "- Lead with the story, back it with numbers",
    "- Never pressure — create urgency through scarcity and facts",
    "- If they share contact info, acknowledge it warmly and guide toward the application",
    "- If they ask about resort operations (rooms, food, tours), weave in the investment angle naturally",
    "",
    "### RULES",
    "- Never promise guaranteed returns — use 'projected' or 'estimated'",
    "- Never share other investors' personal information",
    "- If they seem frustrated or confused about non-investment topics, switch to general help mode",
    "- Always end with a clear next step (apply, contact team, learn more)",
  ];

  return lines.join("\n");
}
