import { describe, expect, it, vi } from "vitest";
import type { Process } from "../../src/supervisor/Process.js";
import {
  SessionActivationCoordinator,
  type SessionActivationCoordinatorOptions,
} from "../../src/supervisor/SessionActivationCoordinator.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function coordinator(
  overrides: Partial<SessionActivationCoordinatorOptions> = {},
): SessionActivationCoordinator {
  return new SessionActivationCoordinator({
    defaultPermissionMode: "default",
    getProcess: () => undefined,
    getProcessForSession: () => undefined,
    unregisterProcess: () => {},
    assertProviderOwnershipSettled: () => {},
    assertSessionSandboxSettings: () => {},
    restartProcess: async () => null,
    ...overrides,
  });
}

describe("SessionActivationCoordinator", () => {
  it("snapshots after queued changes and uses applied effort rather than an unsent selection", async () => {
    const gate = deferred<void>();
    const process = {
      id: "process-1",
      sessionId: "source",
      isTerminated: false,
      permissionMode: "bypassPermissions",
      requestedModel: "default",
      resolvedModel: "resolved-source",
      model: "default",
      thinking: { type: "adaptive" },
      appliedEffort: "high",
      effort: "max",
      serviceTier: "priority",
    } as unknown as Process;
    const state = coordinator({ getProcessForSession: () => process });
    const change = state.enqueueConfiguration("source", async () => {
      await gate.promise;
      Object.assign(process, {
        permissionMode: "default",
        appliedEffort: "low",
      });
    });
    const snapshot = state.snapshotLaunchSettings(
      "project" as never,
      "source",
      "claude",
    );
    gate.resolve();
    await change;
    expect(await snapshot).toEqual({
      permissionMode: "default",
      requestedModel: "resolved-source",
      thinking: { type: "adaptive" },
      effort: "low",
      serviceTier: "priority",
    });
  });

  describe("the effort dimension carries ultracode", () => {
    function liveProcess(overrides: Record<string, unknown> = {}) {
      return {
        id: "process-1",
        sessionId: "session-1",
        projectPath: "/tmp/project",
        permissionMode: "default",
        isTerminated: false,
        hasUnverifiedProviderOwnership: false,
        state: { type: "idle" },
        requestedModel: "opus",
        resolvedModel: "opus",
        model: "opus",
        serviceTier: undefined,
        thinking: { type: "adaptive" },
        effort: "high",
        appliedEffort: "high",
        ultracode: false,
        appliedUltracode: false,
        supportsEffortChange: true,
        supportsSetModel: true,
        supportsThinkingModeChange: true,
        supportsServiceTierChange: true,
        getProviderRuntimeStatus: () => undefined,
        setEffort: vi.fn(async () => true),
        setMaxThinkingTokens: vi.fn(async () => true),
        updateThinkingConfig: vi.fn(),
        ...overrides,
      } as unknown as Process & {
        setEffort: ReturnType<typeof vi.fn>;
        setMaxThinkingTokens: ReturnType<typeof vi.fn>;
      };
    }

    /**
     * An ultracode-only change is a change to the effort dimension, because
     * the provider writes effort and ultracode as one settings object. It must
     * take the live path and restate the unchanged effort level.
     */
    it("applies an ultracode-only change live, with the current effort", async () => {
      const process = liveProcess();
      const restartProcess = vi.fn(async () => null);
      const state = coordinator({
        getProcess: () => process,
        restartProcess,
      });

      await state.reconfigureProcess("process-1", { ultracode: true });

      expect(process.setEffort).toHaveBeenCalledWith("high", true);
      expect(restartProcess).not.toHaveBeenCalled();
    });

    /** A thinking change beside it is a second dimension, so it relaunches. */
    it("relaunches when thinking changes alongside ultracode", async () => {
      const process = liveProcess();
      const restartProcess = vi.fn(async () => null);
      const state = coordinator({
        getProcess: () => process,
        restartProcess,
      });

      await state.reconfigureProcess("process-1", {
        thinking: { type: "disabled" },
        ultracode: true,
      });

      expect(process.setEffort).not.toHaveBeenCalled();
      expect(process.setMaxThinkingTokens).not.toHaveBeenCalled();
      expect(restartProcess).toHaveBeenCalledTimes(1);
      expect(restartProcess.mock.calls[0]?.[3]).toMatchObject({
        thinking: { type: "disabled" },
        ultracode: true,
      });
    });

    /** Changing the effort alone must not clear a standing ultracode. */
    it("restates a standing ultracode when only the effort changes", async () => {
      const process = liveProcess({
        ultracode: true,
        appliedUltracode: true,
      });
      const state = coordinator({ getProcess: () => process });

      await state.reconfigureProcess("process-1", { effort: "low" });

      expect(process.setEffort).toHaveBeenCalledWith("low", true);
    });

    /**
     * A Claude process holds an effort change until the turn boundary, so the
     * decision has to measure against the latest selection rather than the
     * last value the provider accepted. Measuring against the applied value
     * made a request that reverts a still-queued selection read as "no
     * change": it was dropped, and the stale queued pair landed at the
     * boundary anyway.
     */
    it("re-queues a selection that reverts one still waiting for the boundary", async () => {
      const process = liveProcess({
        state: { type: "in-turn" },
        // What the pending-aware getters report while a change is queued.
        ultracode: true,
        appliedUltracode: false,
      });
      const restartProcess = vi.fn(async () => null);
      const state = coordinator({
        getProcess: () => process,
        restartProcess,
      });

      await state.reconfigureProcess("process-1", { ultracode: false });

      expect(process.setEffort).toHaveBeenCalledWith("high", false);
      expect(restartProcess).not.toHaveBeenCalled();
    });
  });

  it("exposes one settled activation result to concurrent waiters", async () => {
    const activationGate = deferred<Process>();
    const state = coordinator();

    const activation = state.startActivation(
      "session-1",
      () => activationGate.promise,
    );
    const waiter = state.waitForActivation("session-1");
    let waiterSettled = false;
    void waiter.finally(() => {
      waiterSettled = true;
    });

    await Promise.resolve();
    expect(waiterSettled).toBe(false);

    const process = { id: "process-1" } as Process;
    activationGate.resolve(process);
    await expect(activation).resolves.toBe(process);
    await expect(waiter).resolves.toBe(true);
    await expect(state.waitForActivation("session-1")).resolves.toBe(false);
  });

  it("flushes the latest standing policy before reload and propagates write failures", async () => {
    const gate = deferred<void>();
    const writes: string[] = [];
    let fail = false;
    const state = coordinator({
      sessionMetadataService: {
        recordEffectiveLaunchSettings: async (
          _id: string,
          value: { permissionMode: string },
        ) => {
          writes.push(value.permissionMode);
          if (fail) throw new Error("disk unavailable");
        },
        flushPendingWrites: async () => {
          writes.push("flushed");
        },
      } as unknown as NonNullable<
        SessionActivationCoordinatorOptions["sessionMetadataService"]
      >,
    });
    const process = {
      id: "process-1",
      sessionId: "session-1",
      permissionMode: "bypassPermissions",
    } as Process;
    const pending = state.enqueueConfiguration("session-1", async () => {
      await gate.promise;
      Object.assign(process, { permissionMode: "default" });
    });
    const reload = state.prepareForServerReload(process);
    expect(writes).toEqual([]);
    gate.resolve();
    await pending;
    await reload;
    expect(writes).toEqual(["default", "flushed"]);
    fail = true;
    await expect(state.prepareForServerReload(process)).rejects.toThrow(
      "disk unavailable",
    );
    expect(writes).toEqual(["default", "flushed", "default"]);
  });

  describe("stopping process launch settings", () => {
    function stoppingFixture() {
      const gate = deferred<void>();
      const writes: string[] = [];
      let owner: Process | undefined;
      const state = coordinator({
        getProcessForSession: () => owner,
        sessionMetadataService: {
          recordEffectiveLaunchSettings: async (
            _id: string,
            value: { permissionMode: string },
          ) => {
            writes.push(value.permissionMode);
          },
        } as unknown as NonNullable<
          SessionActivationCoordinatorOptions["sessionMetadataService"]
        >,
      });
      const process = {
        id: "process-1",
        sessionId: "session-1",
        permissionMode: "default",
        isTerminated: false,
      } as Process;
      owner = process;
      // A configuration transition still running holds the scheduled save.
      const busy = state.enqueueConfiguration("session-1", () => gate.promise);
      Object.assign(process, { permissionMode: "plan" });
      state.scheduleLaunchSettingsPersistence(process, "permissionMode");
      const stop = (successor?: Process) => {
        Object.assign(process, { isTerminated: true });
        owner = successor;
        state.discardProcess(process);
      };
      return { state, process, writes, gate, busy, stop };
    }

    it("saves a mode change whose scheduled save the stop overtook", async () => {
      const { state, process, writes, gate, busy, stop } = stoppingFixture();

      const settled = state.settleStoppingProcessLaunchSettings(process);
      expect(state.settleStoppingProcessLaunchSettings(process)).toBe(settled);
      stop();
      gate.resolve();
      await busy;
      await settled;

      expect(writes).toEqual(["plan"]);
    });

    it("leaves the session to a successor that owns it by then", async () => {
      const { state, process, writes, gate, busy, stop } = stoppingFixture();

      const settled = state.settleStoppingProcessLaunchSettings(process);
      stop({ id: "process-2", sessionId: "session-1" } as Process);
      gate.resolve();
      await busy;
      await settled;

      expect(writes).toEqual([]);
    });
  });

  it("runs configuration transitions in request order", async () => {
    const firstGate = deferred<void>();
    const state = coordinator();
    const transitions: string[] = [];

    const first = state.enqueueConfiguration("session-1", async () => {
      transitions.push("first-start");
      await firstGate.promise;
      transitions.push("first-end");
      return 1;
    });
    const second = state.enqueueConfiguration("session-1", async () => {
      transitions.push("second");
      return 2;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(transitions).toEqual(["first-start"]);

    firstGate.resolve();
    await expect(first).resolves.toBe(1);
    await expect(second).resolves.toBe(2);
    expect(transitions).toEqual(["first-start", "first-end", "second"]);
  });
});
