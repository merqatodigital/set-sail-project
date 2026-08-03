import { supabase, isSupabaseConnected } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// TALA Operations Console — data layer for the admin-side TALA workspace
// (operator face). Goals / Tasks / Briefings / Wins live in their own tables
// (see supabase/migrations/20260723090000_create_tala_ops.sql) so bulk
// reads/writes here never touch the monolithic cms_data blob.
//
// Policy mirrors tala_leads: anon can SELECT + INSERT, never UPDATE/DELETE,
// so a visitor can only ever append rows. The admin passkey guards the UI.
// ---------------------------------------------------------------------------

export interface TalaGoal {
  id: string;
  title: string;
  description: string;
  status: "active" | "done";
  target_date: string;
  created_at: string;
}

export interface TalaTask {
  id: string;
  title: string;
  due: string;
  status: "pending" | "done";
  category: "general" | "booking" | "tour" | "staff" | "maintenance";
  created_at: string;
}

export interface TalaBriefing {
  id: string;
  brief_date: string;
  summary: string;
  highlights: string[];
  generated_at: string;
  whatsapp_sent?: boolean;
}

export interface TalaWin {
  id: string;
  brief_date: string;
  text: string;
  created_at: string;
}

/** Append a goal. Returns the new row or null on failure. */
export async function addTalaGoal(input: {
  title: string;
  description?: string;
  target_date?: string;
}): Promise<TalaGoal | null> {
  if (!isSupabaseConnected() || !supabase) return null;
  const { data, error } = await supabase
    .from("tala_goals")
    .insert({
      title: input.title.slice(0, 300),
      description: (input.description ?? "").slice(0, 2000),
      target_date: input.target_date ?? "",
      status: "active",
    })
    .select()
    .single();
  if (error || !data) return null;
  return data as TalaGoal;
}

export async function fetchTalaGoals(): Promise<TalaGoal[]> {
  if (!isSupabaseConnected() || !supabase) return [];
  const { data, error } = await supabase
    .from("tala_goals")
    .select("id,title,description,status,target_date,created_at")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as TalaGoal[];
}

export async function addTalaTask(input: {
  title: string;
  due?: string;
  category?: TalaTask["category"];
}): Promise<TalaTask | null> {
  if (!isSupabaseConnected() || !supabase) return null;
  const { data, error } = await supabase
    .from("tala_tasks")
    .insert({
      title: input.title.slice(0, 300),
      due: input.due ?? "",
      category: input.category ?? "general",
      status: "pending",
    })
    .select()
    .single();
  if (error || !data) return null;
  return data as TalaTask;
}

export async function fetchTalaTasks(): Promise<TalaTask[]> {
  if (!isSupabaseConnected() || !supabase) return [];
  const { data, error } = await supabase
    .from("tala_tasks")
    .select("id,title,due,status,category,created_at")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as TalaTask[];
}

export async function addTalaBriefing(input: {
  brief_date: string;
  summary: string;
  highlights: string[];
}): Promise<TalaBriefing | null> {
  if (!isSupabaseConnected() || !supabase) return null;
  const { data, error } = await supabase
    .from("tala_briefings")
    .insert({
      brief_date: input.brief_date,
      summary: input.summary.slice(0, 4000),
      highlights: input.highlights.slice(0, 20),
    })
    .select()
    .single();
  if (error || !data) return null;
  return data as TalaBriefing;
}

export async function fetchTalaBriefings(): Promise<TalaBriefing[]> {
  if (!isSupabaseConnected() || !supabase) return [];
  const { data, error } = await supabase
    .from("tala_briefings")
    .select("id,brief_date,summary,highlights,generated_at")
    .order("generated_at", { ascending: false });
  if (error || !data) return [];
  return data as TalaBriefing[];
}

/**
 * Generate a briefing server-side via the SQL function (same logic the daily
 * cron job uses). Returns the freshly inserted row, or null on failure.
 * Falls back to the in-browser compute on the client if the RPC is missing.
 */
export async function generateTalaBriefing(): Promise<TalaBriefing | null> {
  if (!isSupabaseConnected() || !supabase) return null;
  const { data, error } = await supabase.rpc("generate_tala_briefing");
  if (error || !data) return null;
  return data as TalaBriefing;
}

/** Mark a briefing as pushed to WhatsApp (so the UI can show sent state). */
export async function markBriefingWhatsappSent(id: string): Promise<boolean> {
  if (!isSupabaseConnected() || !supabase) return false;
  const { error } = await supabase
    .from("tala_briefings")
    .update({ whatsapp_sent: true })
    .eq("id", id);
  return !error;
}

/**
 * Build a wa.me deep link pre-filled with the briefing text, targeting the
 * site's primary WhatsApp number. No API call — the admin taps it and WhatsApp
 * opens with the message ready to send. Full auto-send (Baileys) is later.
 */
export function buildBriefingWhatsAppLink(
  briefing: Pick<TalaBriefing, "summary" | "highlights">,
  wa: { numbers: Array<{ number: string; isPrimary?: boolean }> },
): string {
  const primary =
    wa.numbers.find((n) => n.isPrimary) || wa.numbers[0];
  const digits = (primary?.number || "").replace(/[^0-9]/g, "");
  const base = `https://wa.me/${digits}`;
  const text = [briefing.summary, ...(briefing.highlights ?? [])].join("\n");
  return text.trim() ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export async function addTalaWin(input: {
  brief_date: string;
  text: string;
}): Promise<TalaWin | null> {
  if (!isSupabaseConnected() || !supabase) return null;
  const { data, error } = await supabase
    .from("tala_wins")
    .insert({
      brief_date: input.brief_date,
      text: input.text.slice(0, 2000),
    })
    .select()
    .single();
  if (error || !data) return null;
  return data as TalaWin;
}

export async function fetchTalaWins(): Promise<TalaWin[]> {
  if (!isSupabaseConnected() || !supabase) return [];
  const { data, error } = await supabase
    .from("tala_wins")
    .select("id,brief_date,text,created_at")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as TalaWin[];
}

// ---- Leads (tala_leads) ----------------------------------------------
export interface TalaLead {
  id: string;
  name: string;
  contact: string;
  note: string;
  source: string;
  created_at: string;
}

/** Newest-first list of leads TALA captured (chat + scraped). */
export async function fetchTalaLeads(): Promise<TalaLead[]> {
  if (!isSupabaseConnected() || !supabase) return [];
  const { data, error } = await supabase
    .from("tala_leads")
    .select("id,name,contact,note,source,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return data as TalaLead[];
}

/**
 * Build a wa.me deep link to follow up a lead. No API — the admin taps it and
 * WhatsApp opens with a ready message. (Inbound/auto-reply is a later phase.)
 */
export function buildLeadWhatsAppLink(
  lead: Pick<TalaLead, "name" | "contact" | "note">,
  wa: { numbers: Array<{ number: string; isPrimary?: boolean }> },
): string {
  const primary = wa.numbers.find((n) => n.isPrimary) || wa.numbers[0];
  const digits = (primary?.number || "").replace(/[^0-9]/g, "");
  const base = `https://wa.me/${digits}`;
  const who = lead.name?.trim() ? lead.name.trim().split(" ")[0] : "there";
  const text =
    `Hi ${who}! This is Marina Terrace — following up on your interest in staying / working with us. ` +
    (lead.note?.trim() ? `You mentioned: ${lead.note.trim()} ` : "") +
    `How can we help you book?`;
  return `${base}?text=${encodeURIComponent(text)}`;
}
