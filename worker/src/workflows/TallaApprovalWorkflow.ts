// TallaApprovalWorkflow — the first real durable approval workflow for
// TallaAgent.
//
// Lifecycle (native Cloudflare AgentWorkflow):
//   1. prepare + report "waiting approval"
//   2. waitForApproval(step)  → execution durably pauses here
//   3. owner approves  → approveWorkflow() resumes; waitForApproval returns
//   4. step.do("execute-approved-action") runs the EXISTING domain action
//      exactly once (Cloudflare step.do is idempotent across retries)
//   5. report complete
//
// On reject: rejectWorkflow() makes waitForApproval throw WorkflowRejectedError;
// the workflow terminates cleanly and the side effect never runs.
//
// The durable side effect lives INSIDE step.do() so Cloudflare's retry /
// resume behavior cannot execute it twice. We reuse the same repository
// functions the normal TALA tool path uses — no duplicated business logic.

import { WorkflowStep } from "cloudflare:workers";
import { Agent } from "agents";
import {
  AgentWorkflow,
  WorkflowRejectedError,
  type AgentWorkflowEvent,
  type AgentWorkflowStep,
} from "agents/workflows";
import type { Env } from "../env.js";
import { createHousekeepingTask, type CreateHousekeepingTaskInput } from "../db/repos/housekeepingRepo.js";
import { sendGuestEmail, type SendGuestEmailParams } from "../agents/tools/emailTools.js";
import { logEmail } from "../db/repos/emailLogRepo.js";

export interface ApprovalPayload {
  tenantId: string;
  requestedBy: string | null;
  actionName: string;
  actionArgs: Record<string, unknown>;
  reason: string;
  requestedAt: string;
}

export interface ApprovalResult {
  approved: boolean;
  rejected?: boolean;
  workflowId?: string;
  result?: unknown;
  error?: string;
}

export class TallaApprovalWorkflow extends AgentWorkflow<Agent, ApprovalPayload, import("agents/workflows").DefaultProgress, Env> {
  async run(
    event: AgentWorkflowEvent<ApprovalPayload>,
    step: WorkflowStep,
  ): Promise<ApprovalResult> {
    const p = event.payload;
    const workflowId = this.workflowId;
    const db = (this.env as unknown as Env).DB;

    await this.reportProgress({
      step: "prepare",
      status: "running",
      message: `Preparing approval-gated action: ${p.actionName}`,
    });
    await this.reportProgress({
      step: "wait-for-approval",
      status: "pending",
      message: "Awaiting owner approval before executing.",
    });

    try {
      // Durably pauses here until the owner calls approveWorkflow() / rejectWorkflow().
      const approval = await this.waitForApproval<{ reason?: string }>(
        step as AgentWorkflowStep,
        { timeout: "7 days" },
      );

      await this.reportProgress({
        step: "execute",
        status: "running",
        message: `Approved${approval?.reason ? `: ${approval.reason}` : ""}. Executing ${p.actionName}.`,
      });

      // The real side effect runs inside step.do() so it executes exactly once,
      // even across workflow retries/resumes.
      const result = await step.do("execute-approved-action", async () => {
        switch (p.actionName) {
          case "createHousekeepingTask":
            return await createHousekeepingTask(
              db,
              p.tenantId,
              p.actionArgs as unknown as CreateHousekeepingTaskInput,
            );
          case "sendGuestEmail": {
            const emailBinding = (this.env as unknown as Env).EMAIL;
            if (!emailBinding) throw new Error("EMAIL send_email binding is not configured");
            const params = p.actionArgs as unknown as SendGuestEmailParams;
            try {
              const out = await sendGuestEmail(emailBinding, params);
              await logEmail((this.env as unknown as Env).DB, {
                tenantId: p.tenantId,
                direction: "outbound",
                action: "sendGuestEmail",
                recipient: params.recipient,
                subject: params.subject,
                status: "sent",
                messageId: out.messageId,
                workflowId: this.workflowId,
              });
              return out;
            } catch (sendErr) {
              await logEmail((this.env as unknown as Env).DB, {
                tenantId: p.tenantId,
                direction: "outbound",
                action: "sendGuestEmail",
                recipient: params.recipient,
                subject: params.subject,
                status: "failed",
                workflowId: this.workflowId,
                error: (sendErr as Error).message,
              });
              throw sendErr;
            }
          }
          default:
            throw new Error(`Unsupported approval action: ${p.actionName}`);
        }
      });

      await this.reportProgress({
        step: "complete",
        status: "complete",
        message: `Action "${p.actionName}" executed after owner approval.`,
      });

      return { approved: true, workflowId, result };
    } catch (err) {
      if (err instanceof WorkflowRejectedError) {
        await this.reportProgress({
          step: "rejected",
          status: "error",
          message: `Rejected by owner: ${err.reason ?? "no reason provided"}`,
        });
        return { approved: false, rejected: true, workflowId };
      }
      await this.reportProgress({
        step: "error",
        status: "error",
        message: `Approval workflow failed: ${(err as Error).message}`,
      });
      throw err;
    }
  }
}
