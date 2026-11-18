import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createSupervisorQueueRoutes } from "../../src/routes/supervisor-queue.js";

function createTestApp() {
  const supervisor = {
    getWorkerActivity: () => ({
      activeWorkers: 1,
      hasActiveWork: true,
      interruptibleSessionCount: 1,
      queueLength: 1,
      queuedSessionMessageCount: 0,
    }),
  };
  const app = new Hono();
  app.route("/api", createSupervisorQueueRoutes(supervisor));
  return { app };
}

describe("supervisor queue routes", () => {
  it("preserves the public worker activity path under /api", async () => {
    const { app } = createTestApp();
    const response = await app.request("/api/status/workers");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      activeWorkers: 1,
      hasActiveWork: true,
      interruptibleSessionCount: 1,
    });
  });
});
