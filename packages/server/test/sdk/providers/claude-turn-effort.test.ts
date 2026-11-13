import { describe, expect, it, vi } from "vitest";
import { MessageQueue } from "../../../src/sdk/messageQueue.js";
import { ClaudeTurnEffort } from "../../../src/sdk/providers/claude-turn-effort.js";

function flagQuery() {
  return {
    setMaxThinkingTokens: vi.fn(async () => {}),
    applyFlagSettings: vi.fn(async () => {}),
  };
}

describe("Claude turn effort at provider input", () => {
  it("retains the override through steers and restores the latest normal setting", async () => {
    const query = flagQuery();
    const controller = new ClaudeTurnEffort({
      query: () => query,
      model: async () => ({
        id: "opus",
        name: "Opus",
        supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"],
        defaultEffortLevel: "high",
      }),
      thinking: { type: "adaptive" },
      effort: "high",
    });
    const queue = new MessageQueue();
    const input = controller.input(queue)[Symbol.asyncIterator]();
    queue.push({ text: "careful", metadata: { turnEffort: "slow" } });
    expect((await input.next()).value).not.toHaveProperty("turnEffort");
    expect(query.applyFlagSettings.mock.calls).toEqual([
      [{ effortLevel: "xhigh" }],
    ]);
    queue.push({ text: "a steer", metadata: { deliveryIntent: "steer" } });
    await input.next();
    await controller.setEffort("medium");
    expect(query.applyFlagSettings).toHaveBeenCalledTimes(1);
    await controller.complete();
    expect(query.applyFlagSettings.mock.calls).toEqual([
      [{ effortLevel: "xhigh" }],
      [{ effortLevel: "medium" }],
    ]);
    queue.push({ text: "ordinary queued turn" });
    await input.next();
    expect(query.applyFlagSettings).toHaveBeenCalledTimes(2);
    await input.return?.();
  });

  it("disables thinking only for fastest and restores it before further delivery", async () => {
    const query = flagQuery();
    const controller = new ClaudeTurnEffort({
      query: () => query,
      model: async () => ({ id: "opus", name: "Opus" }),
      thinking: { type: "adaptive", display: "summarized" },
      effort: "high",
    });
    const queue = new MessageQueue();
    const input = controller.input(queue)[Symbol.asyncIterator]();
    queue.push({ text: "brief", metadata: { turnEffort: "fastest" } });
    await input.next();
    expect(query.setMaxThinkingTokens).toHaveBeenLastCalledWith(0, null);
    await controller.complete();
    expect(query.setMaxThinkingTokens).toHaveBeenLastCalledWith(
      1,
      "summarized",
    );
    expect(query.applyFlagSettings).toHaveBeenLastCalledWith({
      effortLevel: "high",
    });
    await input.return?.();
  });

  /**
   * The SDK reads an `effortLevel` that moves the session to a different level,
   * sent without an `ultracode` key, as turning ultracode off. A one-turn
   * effort modifier therefore has to restate the standing selection, both when
   * it takes effect and when it is restored.
   */
  it("carries a standing ultracode through a one-turn effort modifier", async () => {
    const query = flagQuery();
    const controller = new ClaudeTurnEffort({
      query: () => query,
      model: async () => ({
        id: "opus",
        name: "Opus",
        supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"],
        defaultEffortLevel: "high",
      }),
      thinking: { type: "adaptive" },
      effort: "high",
      ultracode: true,
    });
    const queue = new MessageQueue();
    const input = controller.input(queue)[Symbol.asyncIterator]();
    queue.push({ text: "careful", metadata: { turnEffort: "slow" } });
    await input.next();
    await controller.complete();
    expect(query.applyFlagSettings.mock.calls).toEqual([
      [{ effortLevel: "xhigh", ultracode: true }],
      [{ effortLevel: "high", ultracode: true }],
    ]);
    await input.return?.();
  });

  it("writes an ultracode change and the effort level as one settings object", async () => {
    const query = flagQuery();
    const controller = new ClaudeTurnEffort({
      query: () => query,
      model: async () => ({ id: "opus", name: "Opus" }),
      thinking: { type: "adaptive" },
      effort: "high",
    });

    await controller.setEffort("high", true);
    await controller.setEffort("low", true);
    await controller.setEffort("low", false);

    expect(query.applyFlagSettings.mock.calls).toEqual([
      [{ effortLevel: "high", ultracode: true }],
      [{ effortLevel: "low", ultracode: true }],
      [{ effortLevel: "low", ultracode: false }],
    ]);
  });

  /**
   * These launches read the user's own settings sources, so a session this
   * host never configured may already be running with ultracode on. Stating
   * `false` there would turn it off invisibly, so the key is sent only once a
   * selection exists.
   */
  it("sends no ultracode key while nothing has selected one", async () => {
    const query = flagQuery();
    const controller = new ClaudeTurnEffort({
      query: () => query,
      model: async () => ({
        id: "opus",
        name: "Opus",
        supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"],
        defaultEffortLevel: "high",
      }),
      thinking: { type: "adaptive" },
      effort: "high",
    });
    const queue = new MessageQueue();
    const input = controller.input(queue)[Symbol.asyncIterator]();

    await controller.setEffort("medium");
    queue.push({ text: "careful", metadata: { turnEffort: "slow" } });
    await input.next();
    await controller.complete();

    for (const [settings] of query.applyFlagSettings.mock.calls) {
      expect(settings).not.toHaveProperty("ultracode");
    }
    // "slow" steps the standing level up one: medium -> high, then restores.
    expect(query.applyFlagSettings.mock.calls).toEqual([
      [{ effortLevel: "medium" }],
      [{ effortLevel: "high" }],
      [{ effortLevel: "medium" }],
    ]);
    await input.return?.();
  });
});
