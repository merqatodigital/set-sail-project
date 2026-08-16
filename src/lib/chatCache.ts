/**
 * Pre-cached answers for the 80% of questions that repeat.
 * These return INSTANTLY — no LLM call needed.
 * Update these when your info changes.
 */

interface CachedAnswer {
  keywords: string[];
  answer: string;
}

const CACHED_ANSWERS: CachedAnswer[] = [
  {
    keywords: ["wifi", "wi-fi", "internet", "password"],
    answer: `📶 Our WiFi network:\n\n• Network: MarinaTerrace_Guest\n• Password: Palawan2025!\n\nSpeed: ~30Mbps (fiber). Good enough for video calls and remote work. We also have a Starlink backup for outages.`,
  },
  {
    keywords: ["check-in", "check in", "arrival time"],
    answer: `🏨 Check-in is from 2:00 PM.\n\nEarly check-in is possible if the room is ready (subject to availability). Just message us your arrival time and we'll do our best!`,
  },
  {
    keywords: ["check-out", "check out", "departure"],
    answer: `🏨 Check-out is at 12:00 noon.\n\nLate check-out until 2:00 PM is complimentary if we don't have incoming guests. Beyond that, it's 50% of the room rate.`,
  },
  {
    keywords: ["airport", "transfer", "pickup", "van", "transport"],
    answer: `🚐 Airport Transfer Options:\n\n• Puerto Princesa Airport → Resort: ₱1,500 (private van, ~45 min)\n• Shared van: ₱500/person (scheduled times)\n• Tricycle: ₱200 (budget option, ~30 min)\n\nWe'll arrange it for you! Just tell us your flight number and arrival time.`,
  },
  {
    keywords: ["payment", "pay", "gcash", "cash", "card", "credit"],
    answer: `💳 Payment Methods:\n\n• GCash ✅\n• Maya ✅\n• Cash (PHP/USD) ✅\n• Bank transfer (BDO/BPI) ✅\n• Credit cards (3% fee) ✅\n\nWe require 50% deposit to confirm booking, balance on check-in.`,
  },
  {
    keywords: ["island hopping", "tour", "elnido", "coron", "lagoon"],
    answer: `🚤 Tour Packages:\n\n**Island Hopping Tour A** (Big Lagoon, Small Lagoon, Secret Lagoon, Seven Commandos, Shimizu Island)\n• ₱1,800/person (min 4 pax)\n• Includes lunch, life vest, snorkel gear\n• 8:00 AM - 4:00 PM\n\n**Tour B** (Cadugnon, Helicopter Island, Matinloc Shrine, Hidden Beach)\n• ₱1,600/person\n• Same inclusions\n\n**Underground River Day Trip**\n• ₱2,500/person (includes permits, lunch, van)\n\nWant me to check availability for specific dates?`,
  },
  {
    keywords: ["room", "rate", "price", "cost", "how much", "booking"],
    answer: `🏨 Room Rates (per night):\n\n• **Garden View Room** — ₱2,500\n• **Sea Breeze Room** — ₱3,500\n• **Deluxe Terrace Suite** — ₱5,000\n• **Full Villa (4 pax)** — ₱7,500\n\nAll rooms include: breakfast, WiFi, hot shower, daily housekeeping.\n\nWhich dates are you looking at? I can check availability for you.`,
  },
  {
    keywords: ["breakfast", "food", "meal", "restaurant", "eat"],
    answer: `🍳 Meal Options:\n\n**Included:** Breakfast (7-10 AM) — Filipino + Continental\n\n**Add-on Meals:**\n• Lunch: ₱350/person\n• Dinner: ₱450/person\n• Full board (3 meals): ₱700/person/day\n\n**Dietary:** We accommodate vegetarian, vegan, and halal. Just let us know in advance!\n\nWe also have a shared kitchen for guests who prefer to cook.`,
  },
  {
    keywords: ["location", "where", "address", "directions", "how to get"],
    answer: `📍 Marina Terrace is located in [Your Barangay], El Nido, Palawan.\n\n**Getting here:**\n• From Puerto Princesa: 4-5 hrs by van (we can arrange)\n• From El Nido town proper: 10 min by tricycle\n• From Lio Airport: 15 min by van\n\nGoogle Maps: [your maps link]\n\nWe'll send you a pin location once your booking is confirmed!`,
  },
  {
    keywords: ["cancel", "refund", "cancellation"],
    answer: `📋 Cancellation Policy:\n\n• 7+ days before check-in: Full refund\n• 3-6 days before: 50% refund\n• 0-2 days before: No refund\n\nTo cancel, just reply here with your booking reference or email us. We process refunds within 3-5 business days via GCash or bank transfer.`,
  },
];

/**
 * Try to match a message against cached answers.
 * Returns the cached answer if found, or null to fall through to LLM.
 */
export function getCachedAnswer(message: string): string | null {
  const lower = message.toLowerCase();

  for (const cached of CACHED_ANSWERS) {
    const matchCount = cached.keywords.filter((kw) => lower.includes(kw)).length;
    if (matchCount >= 1) {
      return cached.answer;
    }
  }

  return null;
}
