import { Hono } from "hono";
import type { Supervisor } from "../supervisor/Supervisor.js";

type SupervisorQueueDeps = Pick<Supervisor, "getWorkerActivity">;

export function createSupervisorQueueRoutes(
  supervisor: SupervisorQueueDeps,
): Hono {
  const routes = new Hono();

  // GET /api/status/workers - Get worker activity for safe restart indicator
  routes.get("/status/workers", (c) => {
    const activity = supervisor.getWorkerActivity();
    return c.json(activity);
  });

  return routes;
}
