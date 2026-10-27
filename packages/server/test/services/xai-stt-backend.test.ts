import { afterEach, describe, expect, it, vi } from "vitest";
import { initSpeechBackendRegistry } from "../../src/services/voice/registry.js";
import { XaiSttBackend } from "../../src/services/voice/xaiSttBackend.js";
import {
  getModuleEnv,
  harvestVibeAllDayModuleEnv,
} from "../../src/vibeAllDayModuleEnv.js";

describe("XaiSttBackend", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validates on key presence without a network probe", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(new XaiSttBackend("xai-key").validate()).resolves.toEqual({
      ok: true,
    });
    await expect(new XaiSttBackend("").validate()).resolves.toMatchObject({
      ok: false,
    });
    // Presence check must not hit the network (key is voice-scoped).
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts multipart audio to /v1/stt with a bearer token and returns text", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (url: string | URL | Request, init?: RequestInit) => {
        captured = { url: String(url), init: init ?? {} };
        return new Response(JSON.stringify({ text: "hello world" }), {
          status: 200,
        });
      },
    );

    const transcript = await new XaiSttBackend("xai-key").transcribe(
      Buffer.from("fake-audio"),
      { keyterms: ["Kubernetes"] },
    );

    expect(transcript).toBe("hello world");
    expect(captured).not.toBeNull();
    const { url, init } = captured as unknown as {
      url: string;
      init: RequestInit;
    };
    expect(url).toBe("https://api.x.ai/v1/stt");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer xai-key",
    );
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get("format")).toBe("true");
    expect(form.get("language")).toBe("en");
    expect(form.getAll("keyterm")).toContain("Kubernetes");
    expect(form.get("file")).toBeInstanceOf(Blob);
  });

  it("throws on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("forbidden", { status: 403 }),
    );
    await expect(
      new XaiSttBackend("bad-key").transcribe(Buffer.from("x")),
    ).rejects.toThrow(/HTTP 403/);
  });
});

describe("private VIBEALLDAY_STT_ env harvest", () => {
  it("strips registered module vars from env and keeps others", () => {
    const env: NodeJS.ProcessEnv = {
      VIBEALLDAY_STT_XAI_API_KEY: "secret-xai",
      VIBEALLDAY_STT_SECTION_KEY: "nested",
      VIBEALLDAY_VOICE_BACKENDS: "vibeallday-whisper",
      PATH: "/usr/bin",
    };
    harvestVibeAllDayModuleEnv(env);

    // Harvested vars are removed from the env so children cannot inherit them.
    expect(env.VIBEALLDAY_STT_XAI_API_KEY).toBeUndefined();
    expect(env.VIBEALLDAY_STT_SECTION_KEY).toBeUndefined();
    // Unrelated vars are untouched.
    expect(env.PATH).toBe("/usr/bin");
    expect(env.VIBEALLDAY_VOICE_BACKENDS).toBe("vibeallday-whisper");
    expect(getModuleEnv("stt")).toMatchObject({
      XAI_API_KEY: "secret-xai",
      SECTION_KEY: "nested",
    });
  });

  it("strips private lifecycle-control variables from child inheritance", () => {
    const env: NodeJS.ProcessEnv = {
      VIBEALLDAY_CODEX_RUNTIME_SOCKET: "/tmp/private-host.sock",
      VIBEALLDAY_CODEX_RUNTIME_TOKEN: "runtime-secret",
      VIBEALLDAY_DEV_WRAPPER_PORT: "34567",
      VIBEALLDAY_DEV_WRAPPER_TOKEN: "wrapper-secret",
      VIBEALLDAY_SERVER_GENERATION: "generation-1",
    };
    harvestVibeAllDayModuleEnv(env);

    expect(env.VIBEALLDAY_CODEX_RUNTIME_SOCKET).toBeUndefined();
    expect(env.VIBEALLDAY_CODEX_RUNTIME_TOKEN).toBeUndefined();
    expect(env.VIBEALLDAY_DEV_WRAPPER_PORT).toBeUndefined();
    expect(env.VIBEALLDAY_DEV_WRAPPER_TOKEN).toBeUndefined();
    expect(env.VIBEALLDAY_SERVER_GENERATION).toBe("generation-1");
    expect(getModuleEnv("codex-runtime")).toMatchObject({
      SOCKET: "/tmp/private-host.sock",
      TOKEN: "runtime-secret",
    });
    expect(getModuleEnv("dev-wrapper")).toMatchObject({
      PORT: "34567",
      TOKEN: "wrapper-secret",
    });
  });
});

describe("initSpeechBackendRegistry cloud auto-enable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("auto-enables vibeallday-grok when the key is present, without VIBEALLDAY_VOICE_BACKENDS", async () => {
    const registry = await initSpeechBackendRegistry({
      voiceInputEnabled: true,
      xaiSttApiKey: "xai-key",
    });
    expect(registry.enabledIds()).toContain("vibeallday-grok");
    expect(registry.enabledCapabilities()["vibeallday-grok"]).toEqual({
      streaming: true,
      smartTurn: true,
    });
  });

  it("auto-enables vibeallday-deepgram when the key is present, without VIBEALLDAY_VOICE_BACKENDS", async () => {
    // Deepgram's validate() probes the network; stub it so the key is accepted.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    const registry = await initSpeechBackendRegistry({
      voiceInputEnabled: true,
      deepgramApiKey: "dg-key",
    });
    expect(registry.enabledIds()).toContain("vibeallday-deepgram");
  });

  it("does not enable cloud backends when their key is absent", async () => {
    const registry = await initSpeechBackendRegistry({
      voiceInputEnabled: true,
      voiceBackends: ["vibeallday-grok", "vibeallday-deepgram"],
    });
    expect(registry.enabledIds()).not.toContain("vibeallday-grok");
    expect(registry.enabledIds()).not.toContain("vibeallday-deepgram");
  });
});
