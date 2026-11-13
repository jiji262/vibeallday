import { afterEach, describe, expect, it, vi } from "vitest";
import { getLogger } from "../../src/logging/logger.js";
import { LocalGraniteBackend } from "../../src/services/voice/localGraniteBackend.js";
import { LocalNemoBackend } from "../../src/services/voice/localNemoBackend.js";
import { LocalParakeetBackend } from "../../src/services/voice/localParakeetBackend.js";
import {
  initSpeechBackendRegistry,
  registerSpeechBackends,
  SpeechBackendRegistry,
} from "../../src/services/voice/registry.js";
import type { SpeechBackend } from "../../src/services/voice/SpeechBackend.js";

describe("initSpeechBackendRegistry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to no server-routed backends", async () => {
    const registry = await initSpeechBackendRegistry({
      voiceInputEnabled: true,
    });

    expect(registry.enabledIds()).toEqual([]);
    expect(registry.allInfo()).toEqual([]);
  });

  it("enables the dummy backend only when explicitly requested", async () => {
    const registry = await initSpeechBackendRegistry({
      voiceInputEnabled: true,
      voiceBackends: ["vibeallday-dummy"],
    });
    await registry.waitForValidation();

    expect(registry.enabledIds()).toEqual(["vibeallday-dummy"]);
    expect(registry.allInfo()).toEqual([
      {
        id: "vibeallday-dummy",
        label: "VIBEALLDAY dummy (test only)",
        enabled: true,
        validationStatus: "enabled",
        capabilities: {},
        disabledReason: undefined,
      },
    ]);
  });

  it("logs enabled cloud backends consistently", async () => {
    const infoSpy = vi.spyOn(getLogger(), "info").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    const registry = await initSpeechBackendRegistry({
      voiceInputEnabled: true,
      deepgramApiKey: "dg-key",
      xaiSttApiKey: "xai-key",
    });
    await registry.waitForValidation();

    expect(registry.enabledIds()).toEqual([
      "vibeallday-deepgram",
      "vibeallday-grok",
    ]);
    expect(infoSpy).toHaveBeenCalledWith(
      '[Voice] Backend "vibeallday-deepgram" enabled',
    );
    expect(infoSpy).toHaveBeenCalledWith(
      '[Voice] Backend "vibeallday-grok" enabled',
    );
  });

  it("does not register backends when voice input is disabled", async () => {
    const registry = await initSpeechBackendRegistry({
      voiceInputEnabled: false,
      voiceBackends: ["vibeallday-dummy"],
    });
    await registry.waitForValidation();

    expect(registry.enabledIds()).toEqual([]);
  });

  it("logs and skips unknown backend ids", async () => {
    const warnSpy = vi.spyOn(getLogger(), "warn").mockImplementation(() => {});

    const registry = await initSpeechBackendRegistry({
      voiceInputEnabled: true,
      voiceBackends: ["not-real"],
    });

    expect(registry.enabledIds()).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      "[Voice] Unknown speech backend requested: not-real",
    );
  });

  it("enables the Parakeet backend only when explicitly requested", async () => {
    vi.spyOn(LocalParakeetBackend.prototype, "validate").mockResolvedValue({
      ok: true,
    });

    const registry = await initSpeechBackendRegistry({
      voiceInputEnabled: true,
      voiceBackends: ["vibeallday-parakeet"],
      parakeetModel: "nvidia/parakeet-tdt-0.6b-v3",
      parakeetDevice: "cuda:0",
    });
    await registry.waitForValidation();

    expect(registry.enabledIds()).toEqual(["vibeallday-parakeet"]);
    expect(registry.allInfo()).toEqual([
      {
        id: "vibeallday-parakeet",
        label: "Local Parakeet (pixi stt)",
        enabled: true,
        validationStatus: "enabled",
        capabilities: {},
        disabledReason: undefined,
      },
    ]);
  });

  it("enables the NeMo Parakeet backend only when explicitly requested", async () => {
    vi.spyOn(LocalNemoBackend.prototype, "validate").mockResolvedValue({
      ok: true,
    });

    const registry = await initSpeechBackendRegistry({
      voiceInputEnabled: true,
      voiceBackends: ["vibeallday-nemo"],
      nemoModel: "nvidia/parakeet-rnnt-1.1b",
      nemoDevice: "cuda:0",
    });
    await registry.waitForValidation();

    expect(registry.enabledIds()).toEqual(["vibeallday-nemo"]);
    expect(registry.allInfo()).toEqual([
      {
        id: "vibeallday-nemo",
        label: "Local NeMo Parakeet (pixi stt-nemo)",
        enabled: true,
        validationStatus: "enabled",
        capabilities: {},
        disabledReason: undefined,
      },
    ]);
  });

  it("enables the Granite Speech backend only when explicitly requested", async () => {
    vi.spyOn(LocalGraniteBackend.prototype, "validate").mockResolvedValue({
      ok: true,
    });

    const registry = await initSpeechBackendRegistry({
      voiceInputEnabled: true,
      voiceBackends: ["vibeallday-granite"],
      graniteModel: "ibm-granite/granite-speech-4.1-2b",
      graniteDevice: "cuda:0",
    });
    await registry.waitForValidation();

    expect(registry.enabledIds()).toEqual(["vibeallday-granite"]);
    expect(registry.allInfo()).toEqual([
      {
        id: "vibeallday-granite",
        label: "Local Granite Speech (pixi stt)",
        enabled: true,
        validationStatus: "enabled",
        capabilities: {},
        disabledReason: undefined,
      },
    ]);
  });

  it("discovers a backend immediately without routing before validation", async () => {
    let finishValidation: ((result: { ok: true }) => void) | undefined;
    const backend: SpeechBackend = {
      id: "vibeallday-pending",
      label: "Pending backend",
      validate: () =>
        new Promise((resolve) => {
          finishValidation = resolve;
        }),
      transcribe: async () => "",
    };
    const registry = new SpeechBackendRegistry();

    registry.register(backend);

    expect(registry.knownIds()).toEqual(["vibeallday-pending"]);
    expect(registry.enabledIds()).toEqual([]);
    expect(registry.getBackend("vibeallday-pending")).toBeNull();
    expect(registry.allInfo()).toEqual([
      {
        id: "vibeallday-pending",
        label: "Pending backend",
        enabled: false,
        validationStatus: "pending",
        capabilities: {},
      },
    ]);

    finishValidation?.({ ok: true });
    await registry.waitForValidation();

    expect(registry.enabledIds()).toEqual(["vibeallday-pending"]);
    expect(registry.getBackend("vibeallday-pending")).toBe(backend);
  });

  it("adds Granite without replacing an existing live backend", async () => {
    vi.spyOn(LocalGraniteBackend.prototype, "validate").mockResolvedValue({
      ok: true,
    });
    const registry = await initSpeechBackendRegistry({
      voiceBackends: ["vibeallday-dummy"],
    });
    await registry.waitForValidation();
    const original = registry.getBackend("vibeallday-dummy");
    await registerSpeechBackends(registry, {
      voiceBackends: ["vibeallday-dummy", "vibeallday-granite"],
    });
    expect(registry.getBackend("vibeallday-dummy")).toBe(original);
    await registry.waitForValidation();
    expect(registry.enabledIds()).toEqual([
      "vibeallday-dummy",
      "vibeallday-granite",
    ]);
  });

  it("retries a failed backend after install and retains its instance", async () => {
    const backend: SpeechBackend = {
      id: "vibeallday-retry",
      label: "Retry",
      validate: vi
        .fn()
        .mockResolvedValueOnce({ ok: false, reason: "missing runtime" })
        .mockResolvedValue({ ok: true }),
      transcribe: async () => "ready",
    };
    const registry = new SpeechBackendRegistry();
    registry.register(backend);
    await registry.waitForValidation();
    expect(registry.getBackend(backend.id)).toBeNull();
    registry.revalidate(backend.id);
    await registry.waitForValidation();
    expect(registry.getBackend(backend.id)).toBe(backend);
  });
});
