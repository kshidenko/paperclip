import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "../middleware/logger.js";
import { guardrailRoutes } from "../routes/guardrails.js";

describe("guardrail routes", () => {
  afterEach(() => {
    delete process.env.GROQ_API_KEY;
    vi.restoreAllMocks();
  });

  it("requires authentication for prefilter endpoint", async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).actor = { type: "none", source: "none" };
      next();
    });
    app.use("/api", guardrailRoutes({} as any));
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err?.status ?? 500).json({ error: err?.message ?? "Internal server error" });
    });

    const res = await request(app)
      .post("/api/guardrails/prefilter")
      .send({ channel: "email", text: "hello" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Authentication required");
  });

  it("returns a decision envelope for authenticated calls", async () => {
    process.env.GROQ_API_KEY = "groq_test_key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              decision: "allow",
              reason: "benign_message",
              confidence: 0.95,
              signals: ["no_injection_pattern"],
            }),
          },
        }],
      }),
    } as Response);

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).actor = { type: "agent", agentId: "agent-1", companyId: "company-1", source: "agent_jwt" };
      next();
    });
    app.use("/api", guardrailRoutes({} as any));
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err?.status ?? 500).json({ error: err?.message ?? "Internal server error" });
    });

    const res = await request(app)
      .post("/api/guardrails/prefilter")
      .send({
        channel: "email",
        sender: { email: "ops@vendor.com" },
        text: "Please find invoice attached.",
      });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe("allow");
    expect(res.body.source).toBe("classifier");
    expect(res.body.sanitizedPayload.text).toBe("Please find invoice attached.");
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "guardrail_prefilter_evaluated",
        decision: "allow",
        source: "classifier",
      }),
      "guardrail prefilter decision emitted",
    );
  });

  it("logs failure policy evaluations at warn level", async () => {
    delete process.env.GROQ_API_KEY;

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).actor = { type: "agent", agentId: "agent-1", companyId: "company-1", source: "agent_jwt" };
      next();
    });
    app.use("/api", guardrailRoutes({} as any));
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err?.status ?? 500).json({ error: err?.message ?? "Internal server error" });
    });

    const res = await request(app)
      .post("/api/guardrails/prefilter")
      .send({
        channel: "email",
        sender: { email: "ops@vendor.com" },
        text: "Please find invoice attached.",
      });

    expect(res.status).toBe(200);
    expect(res.body.source).toBe("failure_policy");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "guardrail_prefilter_evaluated",
        decision: "block",
        source: "failure_policy",
        reasonCode: "missing_groq_api_key",
      }),
      "guardrail prefilter decision emitted with failure policy",
    );
  });
});

vi.mock("../middleware/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));
