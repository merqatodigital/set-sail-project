// DailyResortBriefingWorkflow — Cloudflare Workflow for autonomous resort briefing.
//
// Architecture:
//   Cron/Manual trigger → Workflow → TallaAgent (SAME agent loop as Ask TALA)
//   → tool calls (D1 ops + Supabase bookings/knowledge) → reasoning
//   → operational briefing → D1 artifact → (best-effort) Computer workspace
//
// The Workflow is trigger/retry infrastructure only. The briefing intelligence
// is the existing TallaAgent — invoked via its internal /briefing endpoint —
// so the Morning Brief uses the SAME reasoning TALA applies interactively.

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { Env } from "../env.js";
import { sanitizeBriefing } from "./sanitizeBriefing.js";
// Workflow input parameters
export interface BriefingParams {
  tenantId: string;
  date?: string; // YYYY-MM-DD, defaults to today
  timezone?: string; // IANA timezone, defaults to tenant setting
}

// Workflow result
export interface BriefingResult {
  success: boolean;
  tenantId: string;
  date: string;
  artifactPath: string | null;
  artifactVerified: boolean;
  degraded: boolean;
  degradedReasons: string[];
  error: string | null;
  completedAt: string;
  agentDriven: boolean;
}

export class DailyResortBriefingWorkflow extends WorkflowEntrypoint<Env, BriefingParams> {
  async run(event: WorkflowEvent<BriefingParams>, step: WorkflowStep): Promise<BriefingResult> {
    const params = event.payload;
    const tenantId = params.tenantId;
    const date = params.date || new Date().toISOString().split("T")[0];

    const degradedReasons: string[] = [];

    try {
      // Step 1: Load tenant context and validate
      await step.do("load-tenant-context", async () => {
        const tenant = await this.env.DB.prepare(
          "SELECT tenant_id FROM tenant_members WHERE tenant_id = ? LIMIT 1",
        )
          .bind(tenantId)
          .first();

        if (!tenant) {
          throw new Error(`Tenant ${tenantId} not found in D1`);
        }

        return { tenantId, valid: true };
      });

      // Step 2: Invoke the SAME TallaAgent used by interactive Ask TALA.
      // The agent reasons over Marina Terrace knowledge, live Supabase
      // bookings, and D1 operational tools, selects what it needs, and returns
      // the operational briefing. The Workflow does NOT assemble the narrative.
      const briefingContent = await step.do("generate-briefing", async () => {
        const doId = this.env.TALLA_AGENT.idFromName(tenantId);
        const stub = this.env.TALLA_AGENT.get(doId);
        const res = await stub.fetch(
          new Request("https://talla-agent/briefing", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Tenant-Id": tenantId,
            },
            body: JSON.stringify({}),
          }),
        );
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`TallaAgent briefing failed (HTTP ${res.status}): ${errText}`);
        }
        const data = (await res.json()) as { content?: string };
        if (!data.content) {
          throw new Error("TallaAgent returned empty briefing");
        }
        // Strip any model chain-of-thought before persisting/displaying.
        return sanitizeBriefing(data.content);
      });

      // Step 3: Store artifact in D1 (reliable cross-invocation persistence)
      const relativePath = `briefings/${date}-morning-brief.md`;
      const artifactResult = await step.do("write-artifact", async () => {
        await this.env.DB.prepare(
          `INSERT INTO workflow_artifacts (tenant_id, workflow_type, artifact_type, artifact_path, content, content_length)
           VALUES (?, 'daily-briefing', 'morning_brief', ?, ?, ?)
           ON CONFLICT(tenant_id, workflow_type, artifact_path)
           DO UPDATE SET content = excluded.content, content_length = excluded.content_length, created_at = datetime('now')`,
        )
          .bind(tenantId, relativePath, briefingContent, briefingContent.length)
          .run();

        return {
          relativePath,
          absolutePath: `/talla/${tenantId}/${relativePath}`,
          contentLength: briefingContent.length,
        };
      });
      const artifactPath = artifactResult.relativePath;

      // Step 4: Write to Computer workspace (best-effort, for local proof)
      await step.do("write-computer-workspace", async () => {
        if (this.env.TALLA_COMPUTER_ENABLED !== "true") return;

        try {
          const doId = this.env.TALLA_AGENT.idFromName(tenantId);
          const stub = this.env.TALLA_AGENT.get(doId);
          await stub.fetch(
            new Request("https://talla-agent/computer/write", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Tenant-Id": tenantId,
                "X-User-Role": "owner",
                "X-User-Id": "workflow",
              },
              body: JSON.stringify({
                path: relativePath,
                content: briefingContent,
              }),
            }),
          );
        } catch {
          // Computer workspace write is best-effort — D1 is the source of truth
        }
      });

      // Step 5: Verify artifact — read back from D1
      const verification = await step.do("verify-artifact", async () => {
        const row = await this.env.DB.prepare(
          `SELECT content, content_length FROM workflow_artifacts
           WHERE tenant_id = ? AND workflow_type = 'daily-briefing' AND artifact_path = ?`,
        )
          .bind(tenantId, relativePath)
          .first<{ content: string; content_length: number }>();

        if (!row) {
          throw new Error(`Artifact not found in D1: ${relativePath}`);
        }

        const contentMatches = row.content === briefingContent;
        const sizeMatches = row.content_length === briefingContent.length;

        return {
          contentLength: briefingContent.length,
          verifiedSize: row.content_length,
          contentMatches,
          ready: contentMatches && sizeMatches,
          path: artifactResult.relativePath,
        };
      });
      const artifactVerified = verification.ready;

      return {
        success: true,
        tenantId,
        date,
        artifactPath,
        artifactVerified,
        degraded: degradedReasons.length > 0,
        degradedReasons,
        error: null,
        completedAt: new Date().toISOString(),
        agentDriven: true,
      };
    } catch (err) {
      const errorMsg = (err as Error).message;
      console.error(`[Workflow] Briefing generation failed: ${errorMsg}`);

      return {
        success: false,
        tenantId,
        date,
        artifactPath: null,
        artifactVerified: false,
        degraded: true,
        degradedReasons: [...degradedReasons, errorMsg],
        error: errorMsg,
        completedAt: new Date().toISOString(),
        agentDriven: true,
      };
    }
  }
}
