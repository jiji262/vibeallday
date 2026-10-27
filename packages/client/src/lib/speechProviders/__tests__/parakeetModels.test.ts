import { describe, expect, it } from "vitest";
import { reconcileParakeetBackendForModel } from "../parakeetModels";

const RNNT = "nvidia/parakeet-rnnt-1.1b"; // NeMo-only
const TDT = "nvidia/parakeet-tdt-0.6b-v3"; // both backends

describe("reconcileParakeetBackendForModel", () => {
  it("preserves each backend's server default when no model is selected", () => {
    expect(
      reconcileParakeetBackendForModel("vibeallday-nemo", "", [
        "vibeallday-parakeet",
        "vibeallday-nemo",
      ]),
    ).toBe("vibeallday-nemo");
  });
  it("reroutes a NeMo-only model off vibeallday-parakeet to vibeallday-nemo when available", () => {
    expect(
      reconcileParakeetBackendForModel("vibeallday-parakeet", RNNT, [
        "vibeallday-parakeet",
        "vibeallday-nemo",
      ]),
    ).toBe("vibeallday-nemo");
  });

  it("leaves a compatible pair unchanged", () => {
    expect(
      reconcileParakeetBackendForModel("vibeallday-nemo", RNNT, [
        "vibeallday-nemo",
      ]),
    ).toBe("vibeallday-nemo");
    expect(
      reconcileParakeetBackendForModel("vibeallday-parakeet", TDT, [
        "vibeallday-parakeet",
        "vibeallday-nemo",
      ]),
    ).toBe("vibeallday-parakeet");
  });

  it("keeps the method as-is when no compatible backend is available", () => {
    // vibeallday-nemo not enabled -> can't reroute rnnt; keep vibeallday-parakeet so the
    // request fails with a clear model-load error rather than silent reroute.
    expect(
      reconcileParakeetBackendForModel("vibeallday-parakeet", RNNT, [
        "vibeallday-parakeet",
      ]),
    ).toBe("vibeallday-parakeet");
  });

  it("passes non-Parakeet methods through untouched", () => {
    expect(
      reconcileParakeetBackendForModel("browser-native", RNNT, [
        "vibeallday-nemo",
      ]),
    ).toBe("browser-native");
    expect(
      reconcileParakeetBackendForModel("vibeallday-grok", TDT, [
        "vibeallday-nemo",
      ]),
    ).toBe("vibeallday-grok");
  });
});
