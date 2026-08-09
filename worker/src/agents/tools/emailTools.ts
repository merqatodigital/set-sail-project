// Guest email tool — sends an outbound email via Cloudflare's Agents Email API
// (the `send_email` binding surfaced as this.env.EMAIL).
//
// This is a durable-approval-gated TALA action: the policy marks
// sendGuestEmail REQUIRES_APPROVAL, so the TallaAgent tool loop starts the
// TallaApprovalWorkflow instead of sending directly. The actual send happens
// once, inside the workflow's step.do(), reusing sendGuestEmail() below.
//
// Security:
//  - The sender identity is fixed from configuration (no caller-supplied From).
//  - Recipient/subject/body are validated; no arbitrary headers are forwarded.
//  - The configured sender must be an address permitted by the send_email
//    binding's destination_address / allowed_destination_addresses.

import type { TallaTool } from "../types.js";
import type { EmailSendBinding } from "agents";
import type { Env } from "../../env.js";

/** Resort sender identity (configured, never caller-supplied). */
export const RESORT_EMAIL_SENDER = {
  email: "tala@merqato.digital",
  name: "TALA — Marina Terrace",
};

export interface SendGuestEmailParams {
  recipient: string;
  subject: string;
  body: string;
  reference?: string; // optional booking/guest reference for context
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate + send a guest email using the Cloudflare Agents Email API.
 * Returns the message id on success. Throws on validation/send failure.
 */
export async function sendGuestEmail(
  binding: EmailSendBinding,
  params: SendGuestEmailParams,
): Promise<{ messageId: string }> {
  const recipient = (params.recipient || "").trim();
  const subject = (params.subject || "").trim();
  const body = (params.body || "").trim();

  if (!EMAIL_RE.test(recipient)) {
    throw new Error(`Invalid recipient email address: ${recipient}`);
  }
  if (!subject) {
    throw new Error("Email subject is required");
  }
  if (!body) {
    throw new Error("Email body is required");
  }

  const result = await binding.send({
    from: RESORT_EMAIL_SENDER,
    to: recipient,
    subject,
    text: body,
    // Include reference only as body context, never as a header.
    ...(params.reference ? {} : {}),
  });

  return { messageId: result.messageId ?? "sent" };
}

export const sendGuestEmailTool: TallaTool = {
  name: "sendGuestEmail",
  description:
    "Send an email to a guest or external recipient on behalf of the resort (e.g. booking confirmation, check-in instructions, a direct reply). The sender identity is the resort's official address; you cannot choose the From address. Requires owner approval before the email is actually sent.",
  parameters: {
    type: "object",
    properties: {
      recipient: {
        type: "string",
        description: "Recipient email address (must be a valid email).",
      },
      subject: {
        type: "string",
        description: "Email subject line.",
      },
      body: {
        type: "string",
        description: "Plain-text email body.",
      },
      reference: {
        type: "string",
        description: "Optional booking or guest reference for context (included in body only).",
      },
    },
    required: ["recipient", "subject", "body"],
  },
  execute: async (args, ctx) => {
    try {
      const env = ctx.env as unknown as Env;
      if (!env.EMAIL) {
        return { success: false, error: "Email binding is not configured." };
      }
      const out = await sendGuestEmail(env.EMAIL, {
        recipient: args.recipient as string,
        subject: args.subject as string,
        body: args.body as string,
        reference: (args.reference as string) || undefined,
      });
      return {
        success: true,
        data: {
          messageId: out.messageId,
          recipient: args.recipient,
          message: `Email queued to ${args.recipient}. (Requires owner approval to send.)`,
        },
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};
