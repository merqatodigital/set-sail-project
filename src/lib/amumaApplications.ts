import { supabase, isSupabaseConnected } from "./supabase";
import { sendWhatsAppText } from "./whatsappSend";

// ---------------------------------------------------------------------------
// AMUMA Circle — Founding Circle application submission.
// Stores the application in Supabase and sends a WhatsApp notification
// to the team for immediate follow-up.
// ---------------------------------------------------------------------------

export interface AmumaApplicationInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  heardFrom: string;
  message: string;
}

export interface AmumaApplicationResult {
  success: boolean;
  error?: string;
  id?: string;
}

export async function submitAmumaApplication(
  input: AmumaApplicationInput,
): Promise<AmumaApplicationResult> {
  if (!isSupabaseConnected() || !supabase) {
    return { success: false, error: "Database is not connected. Please try again later." };
  }

  // Insert into Supabase
  const { data, error } = await supabase
    .from("amuma_applications")
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone || null,
      country: input.country || null,
      heard_from: input.heardFrom || null,
      message: input.message || null,
      status: "new",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to submit AMUMA application:", error);
    return { success: false, error: "Failed to submit application. Please try again." };
  }

  // Fire-and-forget WhatsApp notification to the team
  const teamNumber = import.meta.env.VITE_WHATSAPP_TEAM_NUMBER as string | undefined;
  if (teamNumber) {
    const text = [
      "🏠 *New AMUMA Founding Circle Application*",
      "",
      `👤 ${input.firstName} ${input.lastName}`,
      `📧 ${input.email}`,
      input.phone ? `📱 ${input.phone}` : null,
      input.country ? `🌍 ${input.country}` : null,
      input.heardFrom ? `🔗 Heard via: ${input.heardFrom}` : null,
      input.message ? `💬 ${input.message}` : null,
      "",
      "Review in the admin dashboard.",
    ]
      .filter(Boolean)
      .join("\n");

    // Don't await — best-effort notification
    sendWhatsAppText(teamNumber, text).catch((err) => {
      console.warn("WhatsApp notification failed for AMUMA application:", err);
    });
  }

  return { success: true, id: data?.id };
}
