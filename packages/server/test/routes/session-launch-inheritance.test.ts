import { describe, expect, it, vi } from "vitest";
import type { EffectiveSessionLaunchSettings } from "../../src/metadata/index.js";
import { inheritSuccessorLaunchSettings } from "../../src/supervisor/sessionLaunchInheritance.js";

const source: EffectiveSessionLaunchSettings = {
  schemaVersion: 1,
  revision: 2,
  permissionMode: "plan",
  requestedModel: "opus",
  serviceTier: "priority",
  thinking: { type: "adaptive", display: "summarized" },
  effort: "low",
  ultracode: true,
};

describe("inheritSuccessorLaunchSettings", () => {
  /**
   * The selection was made against the source model's capabilities and this
   * helper has no catalog to re-check them with, so a successor that moves to
   * a different model starts without it rather than carrying a flag the new
   * model may not accept.
   */
  it("drops ultracode when the successor names a different model", () => {
    expect(
      inheritSuccessorLaunchSettings(
        source,
        { sameProvider: true },
        { requestedModel: "haiku" },
      ).ultracode,
    ).toBeUndefined();
    // Restating the source's own model, as a fork does, keeps it.
    expect(
      inheritSuccessorLaunchSettings(
        source,
        { sameProvider: true },
        { requestedModel: "opus" },
      ).ultracode,
    ).toBe(true);
    // An explicit request wins either way.
    expect(
      inheritSuccessorLaunchSettings(
        source,
        { sameProvider: true },
        { requestedModel: "haiku", ultracode: true },
      ).ultracode,
    ).toBe(true);
  });

  it("inherits every source setting when nothing is overridden", () => {
    expect(
      inheritSuccessorLaunchSettings(source, { sameProvider: true }, {}),
    ).toEqual({
      requestedModel: "opus",
      thinking: { type: "adaptive", display: "summarized" },
      effort: "low",
      ultracode: true,
      serviceTier: "priority",
      permissionMode: "plan",
    });
  });

  it("lets each explicit override win, including a cleared service tier", () => {
    expect(
      inheritSuccessorLaunchSettings(
        source,
        { sameProvider: true },
        {
          requestedModel: "sonnet",
          thinking: "off",
          serviceTier: null,
          permissionMode: "acceptEdits",
        },
      ),
    ).toEqual({
      requestedModel: "sonnet",
      thinking: { type: "disabled" },
      effort: undefined,
      serviceTier: undefined,
      permissionMode: "acceptEdits",
    });
  });

  it("keeps only the permission mode across a provider change", () => {
    const legacyRequestedModel = vi.fn(() => "haiku");
    expect(
      inheritSuccessorLaunchSettings(
        source,
        { sameProvider: false, legacyRequestedModel },
        {},
      ),
    ).toEqual({
      requestedModel: undefined,
      thinking: undefined,
      effort: undefined,
      serviceTier: undefined,
      permissionMode: "plan",
    });
    expect(legacyRequestedModel).not.toHaveBeenCalled();
  });

  it("reads the legacy requested model only when nothing else names one", () => {
    const legacyRequestedModel = vi.fn(() => "haiku");
    expect(
      inheritSuccessorLaunchSettings(
        { ...source, requestedModel: null },
        { sameProvider: true, legacyRequestedModel },
        {},
      ).requestedModel,
    ).toBe("haiku");
    inheritSuccessorLaunchSettings(
      source,
      { sameProvider: true, legacyRequestedModel },
      {},
    );
    expect(legacyRequestedModel).toHaveBeenCalledTimes(1);
  });
});
