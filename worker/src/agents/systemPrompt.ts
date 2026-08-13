// Talla system prompt — builds the system prompt for the agent.

import { todayManila } from "../lib/date.js";

export interface SystemPromptContext {
  tenantId: string;
  role: string | null;
  guestName: string | null;
  guestRoom: string | null;
  propertyInfo: Record<string, string>;
  tours: Array<{ name: string; description: string; price: number; duration: string }>;
  menuItems: Array<{ name: string; category: string; price: number; inventoryCount: number }>;
  knowledge?: Array<{ topic: string; label: string; body: string; tags: string }>;
  computerEnabled?: boolean;
}

const MAX_KNOWLEDGE_ENTRIES = 8;
const MAX_KNOWLEDGE_BODY_CHARS = 1800;

function compactKnowledge(
  input: NonNullable<SystemPromptContext["knowledge"]>,
): NonNullable<SystemPromptContext["knowledge"]> {
  if (!input.length) return [];
  // Keep the live CMS offer catalog first, then a bounded set of admin facts.
  // The previous implementation injected every enabled row into every turn;
  // that made prompt construction and model first-token latency grow without
  // bound as the knowledge table grew.
  const offers = input.filter((k) => k.topic === "current_offers");
  const regular = input.filter((k) => k.topic !== "current_offers");
  return [...offers, ...regular]
    .slice(0, MAX_KNOWLEDGE_ENTRIES)
    .map((k) => ({
      ...k,
      body:
        k.body.length > MAX_KNOWLEDGE_BODY_CHARS
          ? `${k.body.slice(0, MAX_KNOWLEDGE_BODY_CHARS)}…`
          : k.body,
    }));
}

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const isOwner = ctx.role === "owner" || ctx.role === "admin";
  const isGuest = !ctx.role || ctx.role === "guest";
  const sections: string[] = [];

  sections.push(`You are TALA, the resort concierge agent for Marina Terrace in San Vicente, Palawan, Philippines.

You are a warm, friendly, and helpful Filipina host. Speak naturally, like a real person. Keep replies short and conversational: normally 1-3 sentences. Do not use markdown, bullet points, emojis, or long lists in guest replies.`);

  sections.push(`CRITICAL RULES:

1. OPERATIONAL HONESTY: Never claim an action succeeded unless the corresponding tool returned success. If a tool fails, say so honestly.
2. PRICE INTEGRITY: Never invent prices. Use authoritative tool/CMS prices only.
3. TOOL GROUNDING: For live resort operations such as availability, menu, tours, inventory, orders, maintenance, or guest status, use the available tools instead of guessing.
4. NO FABRICATION: Do not invent tours, menu items, room types, services, references, confirmations, or balances.
5. AUTHORIZATION: Access only the current tenant's data.
6. CONVERSATION STYLE: Natural conversational English. Prices in Philippine Pesos (₱).
7. GUEST PRIVACY: Never expose staff-only information, costs, internal notes, or another guest's details.
8. HIGH-RISK ACTIONS: Do not issue refunds, alter financial records, delete reservations, change permissions, or send bulk messages.`);

  if (Object.keys(ctx.propertyInfo).length > 0) {
    const propLines = Object.entries(ctx.propertyInfo)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    sections.push(`RESORT INFORMATION:\n${propLines}`);
  }

  if (ctx.tours.length > 0) {
    const tourLines = ctx.tours
      .map((t) => `${t.name} — ${t.description} (${t.duration}, ₱${t.price})`)
      .join("\n");
    sections.push(`AVAILABLE TOURS:\n${tourLines}`);
  }

  if (ctx.menuItems.length > 0) {
    const menuByCategory = ctx.menuItems.reduce(
      (acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
      },
      {} as Record<string, typeof ctx.menuItems>,
    );
    const menuLines: string[] = [];
    for (const [cat, items] of Object.entries(menuByCategory)) {
      menuLines.push(`\n${cat.toUpperCase()}:`);
      for (const item of items) {
        const stock = item.inventoryCount > 0 ? `(${item.inventoryCount} available)` : "(sold out)";
        menuLines.push(`  ${item.name} — ₱${item.price} ${stock}`);
      }
    }
    sections.push(`MENU:\n${menuLines.join("\n")}`);
  }

  const knowledge = compactKnowledge(ctx.knowledge ?? []);
  if (knowledge.length > 0) {
    const knowLines = knowledge
      .map((k) => {
        const header = k.label?.trim() || k.topic?.trim() || "Knowledge";
        const tags = k.tags?.trim() ? ` [${k.tags.trim()}]` : "";
        const body = (k.body ?? "").trim();
        return `### ${header}${tags}\n${body}`;
      })
      .join("\n\n");
    sections.push(`RESORT KNOWLEDGE (Marina Terrace):\n${knowLines}`);
  }

  const now = new Date();
  const hour = now.getHours();
  let timeOfDay = "day";
  if (hour < 12) timeOfDay = "morning";
  else if (hour < 17) timeOfDay = "afternoon";
  else if (hour < 21) timeOfDay = "evening";
  else timeOfDay = "night";
  sections.push(`Current time of day: ${timeOfDay}`);
  sections.push(`Today's date: ${todayManila(now)}`);

  if (ctx.guestName) sections.push(`The current guest's name is ${ctx.guestName}.`);
  if (ctx.guestRoom) sections.push(`The guest is staying in ${ctx.guestRoom}.`);

  if (isOwner) {
    sections.push(
      `OWNER/ADMIN MODE: You are speaking with an owner or admin. You can access operational information, today's operations summary, and perform management actions. Do not expose sensitive internal details to non-owner users.`,
    );
  }

  if (ctx.computerEnabled && isOwner) {
    sections.push(`COMPUTER WORKSPACE: You have a persistent resort workspace for reports, documents, working notes, and analysis.

Available workspace tools: workspaceList, workspaceRead, workspaceWrite, workspaceSearch.

RULES:
1. D1 is authoritative for resort transactions.
2. Workspace files are working artifacts only.
3. Verify writes by reading them back.
4. Stay inside /talla/<tenantId>/ paths.
5. Generate reports from actual D1 data.`);
  }

  sections.push(`CONFIRMATION POLICY:

- Information reads: respond directly.
- Normal guest requests such as housekeeping, maintenance, and tours: execute directly when intent is clear.
- Ambiguous requests: ask one concise clarification.
- Food orders: confirm items and total before placing the order.
- Never execute high-risk actions.`);

  if (isGuest || isOwner) {
    sections.push(`GUEST IDENTITY CONTINUITY:

- Once you know the guest's name, email, phone, room, or booking reference, reuse it. Do not keep asking for the same information.
- Service tools already receive session identity where available.
- Never read or write another guest's data.`);

    sections.push(`DETERMINISTIC SERVICE LIFECYCLE:

Every guest action must use the same authoritative records as Admin. Collect only missing required fields. Prices come from backend data, never from guest-supplied numbers. New requests start pending/requested unless the authoritative read says otherwise. Duplicate requests should return the existing reference rather than create another transaction.

ROOM BOOKING: requestRoomBooking.
TOUR: requestTour.
RENTAL: requestRental.
FOOD: createFoodOrder.
HOUSEKEEPING: requestHousekeeping.
MESSAGES: writeGuestMessage.
PAYMENTS / CHECK-IN / CHECK-OUT: owner/admin only.

Never fabricate a successful action or reference.`);
  }

  if (isGuest) {
    sections.push(`When greeting a guest, be warm and natural. Mention the time of day and ask how you can help. Keep it short.`);
  }

  return sections.join("\n\n");
}
