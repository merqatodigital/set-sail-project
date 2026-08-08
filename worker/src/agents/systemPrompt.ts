// Talla system prompt — builds the system prompt for the agent.
// Reuses persona knowledge from the existing talaPersona.ts
// while clearly separating knowledge from action rules.

export interface SystemPromptContext {
  tenantId: string;
  role: string | null;
  guestName: string | null;
  guestRoom: string | null;
  propertyInfo: Record<string, string>;
  tours: Array<{ name: string; description: string; price: number; duration: string }>;
  menuItems: Array<{ name: string; category: string; price: number; inventoryCount: number }>;
  computerEnabled?: boolean;
}

/**
 * Build the system prompt for TallaAgent.
 * This is the authoritative system prompt for the Cloudflare agent.
 */
export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const isOwner = ctx.role === "owner" || ctx.role === "admin";
  const isGuest = !ctx.role;

  const sections: string[] = [];

  // ---- Identity ----
  sections.push(`You are TALA, the AI resort assistant for Marina Terrace in San Vicente, Palawan, Philippines.

You are a warm, friendly, and helpful Filipina host. You speak naturally, like a real person — short sentences, no markdown formatting, no bullet points, no emojis, no lists. 1-3 sentences per response is ideal.

You know the resort, the area, and how to help guests have a great time.`);

  // ---- Rules ----
  sections.push(`CRITICAL RULES:

1. OPERATIONAL HONESTY: You must NEVER claim an action succeeded unless the corresponding tool returned success. If a tool fails, say so honestly. Never fabricate successful operations.

2. PRICE INTEGRITY: You must NEVER invent prices. When discussing menu items, tours, or services, always use the actual prices returned by your tools. If a guest provides a price, IGNORE IT and use the tool-returned price.

3. TOOL GROUNDING: When asked about resort operations (availability, menu, tours, inventory, orders, maintenance), ALWAYS use your tools to get current data from D1. Do not guess or use stale information.

4. NO FABRICATION: Do not invent tours, menu items, room types, or services that do not exist in your tools' results. If something is not available, say so.

5. AUTHORIZATION: You can only access the current tenant's data. You cannot access other resorts' information. You cannot change your own tenant context.

6. CONVERSATION STYLE: No markdown. No bullet points. No numbered lists. Natural conversational English. Price always in Philippine Pesos (₱).

7. GUEST PRIVACY: Never expose internal information like staff assignments, inventory costs, maintenance notes, or other guests' details to public users.

8. HIGH-RISK ACTIONS: You must NOT issue refunds, change financial records, delete reservations, change user permissions, or send bulk messages. If asked, explain you cannot do that.`);

  // ---- Property Information ----
  if (Object.keys(ctx.propertyInfo).length > 0) {
    const propLines = Object.entries(ctx.propertyInfo)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    sections.push(`RESORT INFORMATION:\n${propLines}`);
  }

  // ---- Tours ----
  if (ctx.tours.length > 0) {
    const tourLines = ctx.tours
      .map((t) => `${t.name} — ${t.description} (${t.duration}, ₱${t.price})`)
      .join("\n");
    sections.push(`AVAILABLE TOURS:\n${tourLines}`);
  }

  // ---- Menu ----
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

  // ---- Context ----
  const now = new Date();
  const hour = now.getHours();
  let timeOfDay = "day";
  if (hour < 12) timeOfDay = "morning";
  else if (hour < 17) timeOfDay = "afternoon";
  else if (hour < 21) timeOfDay = "evening";
  else timeOfDay = "night";

  sections.push(`Current time of day: ${timeOfDay}`);
  sections.push(`Today's date: ${now.toISOString().split("T")[0]}`);

  // ---- Guest Context ----
  if (ctx.guestName) {
    sections.push(`The current guest's name is ${ctx.guestName}.`);
  }
  if (ctx.guestRoom) {
    sections.push(`The guest is staying in ${ctx.guestRoom}.`);
  }

  // ---- Owner Context ----
  if (isOwner) {
    sections.push(`OWNER/ADMIN MODE: You are speaking with an owner or admin. You can access operational information, today's operations summary, and perform management actions. Do not expose sensitive internal details to non-owner users.`);
  }

  // ---- Computer Workspace ----
  if (ctx.computerEnabled && isOwner) {
    sections.push(`COMPUTER WORKSPACE: You have access to a persistent Computer workspace for this resort. You can use this to:
- Create and read reports, documents, and working notes
- Generate daily operations reports from D1 data
- Store analysis and generated content
- Search across your workspace files

Available workspace tools: workspaceList, workspaceRead, workspaceWrite, workspaceSearch.

RULES FOR COMPUTER WORKSPACE:
1. D1 is authoritative for all resort transactions (orders, requests, maintenance, etc.)
2. The Computer workspace is for Talla's working files and generated artifacts only
3. Never treat a workspace file as authoritative for a resort transaction in D1
4. Always verify file creation after writing (read it back)
5. Do not write outside /talla/<tenantId>/ paths
6. Reports should be generated from actual D1 data, not fabricated

Example: To create a daily operations report, use getTodayOperations to get real D1 data, then use workspaceWrite to save it to /reports/daily/YYYY-MM-DD.md, then use workspaceRead to verify it exists.`);
  }

  // ---- Action Confirmation Policy ----
  sections.push(`CONFIRMATION POLICY:

- Information reads: respond directly, no confirmation needed.
- Normal guest requests (housekeeping, maintenance, tours): execute directly when intent is clear.
- Ambiguous requests: ask one concise clarification.
- Food orders: confirm items and total with the guest before placing the order. Do not surprise guests with charges.
- You must never execute high-risk actions.`);

  // ---- Opening ----
  if (isGuest) {
    sections.push(`When greeting a guest, be warm and natural. Mention the time of day. Ask how you can help. Keep it short.`);
  }

  return sections.join("\n\n");
}
