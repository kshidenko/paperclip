import { Router } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { forbidden } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { logger } from "../middleware/logger.js";
import { inboundGuardrailPrefilterService } from "../services/inbound-guardrail-prefilter.js";

const prefilterRequestSchema = z.object({
  channel: z.enum(["email", "twitter", "social_dm", "other"]),
  messageId: z.string().trim().min(1).max(512).optional(),
  receivedAt: z.string().datetime().optional(),
  sender: z.object({
    id: z.string().trim().min(1).max(512).optional(),
    email: z.string().trim().email().max(512).optional(),
    handle: z.string().trim().min(1).max(512).optional(),
    name: z.string().trim().min(1).max(512).optional(),
  }).optional(),
  subject: z.string().max(5_000).optional(),
  text: z.string().max(80_000).optional(),
  html: z.string().max(120_000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  raw: z.unknown().optional(),
});

export function guardrailRoutes(_db: Db) {
  const router = Router();
  const prefilter = inboundGuardrailPrefilterService();

  function toReasonCode(reason: string): string {
    const normalized = reason
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80);
    return normalized.length > 0 ? normalized : "unknown";
  }

  router.post(
    "/guardrails/prefilter",
    validate(prefilterRequestSchema),
    async (req, res) => {
      if (req.actor.type === "none") {
        throw forbidden("Authentication required");
      }

      const decision = await prefilter.evaluate(req.body);
      const logPayload = {
        event: "guardrail_prefilter_evaluated",
        channel: decision.sanitizedPayload.channel,
        decision: decision.decision,
        source: decision.source,
        reasonCode: toReasonCode(decision.reason),
        modelProvider: decision.model?.provider ?? null,
        modelName: decision.model?.model ?? null,
        hasConfidence: decision.confidence !== null,
        confidence: decision.confidence,
        flags: decision.flags,
      };
      if (decision.source === "failure_policy") {
        logger.warn(logPayload, "guardrail prefilter decision emitted with failure policy");
      } else {
        logger.info(logPayload, "guardrail prefilter decision emitted");
      }
      res.json(decision);
    },
  );

  return router;
}
