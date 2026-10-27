import type { SessionSandboxAvailability } from "@vibeallday/shared";
import { describe, expect, it, vi } from "vitest";
import {
  createVersionRoutes,
  type CurrentVersionInfo,
  type DeviceBridgeStatus,
} from "../../src/routes/version.js";

describe("version readiness", () => {
  it.each([false, true])(
    "starts independent probes together (fresh=%s)",
    async (fresh) => {
      const current = Promise.withResolvers<CurrentVersionInfo>();
      const bridge = Promise.withResolvers<DeviceBridgeStatus>();
      const sandbox = Promise.withResolvers<SessionSandboxAvailability>();
      const getCurrentVersionInfo = vi.fn(() => current.promise);
      const getDeviceBridgeStatus = vi.fn(() => bridge.promise);
      const getSessionSandboxAvailability = vi.fn(() => sandbox.promise);
      const routes = createVersionRoutes({
        getCurrentVersionInfo,
        getDeviceBridgeStatus,
        getSessionSandboxAvailability,
      });
      let settled = false;
      const response = routes.request(fresh ? "/?fresh=1" : "/").then((r) => {
        settled = true;
        return r;
      });
      try {
        await vi.waitFor(() => {
          expect(getCurrentVersionInfo).toHaveBeenCalledTimes(1);
          expect(getDeviceBridgeStatus).toHaveBeenCalledWith({
            forceRefresh: fresh,
          });
          expect(getSessionSandboxAvailability).toHaveBeenCalledWith({
            forceRefresh: fresh,
          });
        });
        current.resolve({ version: "0.9.2-3-g123", installSource: "source" });
        await Promise.resolve();
        expect(settled).toBe(false);
      } finally {
        current.resolve({ version: "0.9.2-3-g123", installSource: "source" });
        bridge.resolve({ state: "unavailable" });
        sandbox.resolve({ state: "unsupported-platform", platform: "test" });
        await response;
      }
      expect(await (await response).json()).toMatchObject({
        current: "0.9.2-3-g123",
        deviceBridgeState: "unavailable",
        sessionSandboxing: { state: "unsupported-platform", platform: "test" },
      });
    },
  );
});
