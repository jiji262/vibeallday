// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  SPEECH_BACKEND_SETUP_CAPABILITY,
  VOICE_INPUT_CAPABILITY,
} from "@vibeallday/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpeechSettings } from "../SpeechSettings";
import { SettingsSearchScopeProvider } from "../SettingsSearchContext";

const modelSettings = vi.hoisted(() => {
  const state = {
    voiceInputEnabled: true,
    setVoiceInputEnabled: vi.fn(),
    speechMethod: "vibeallday-parakeet",
    hasStoredSpeechMethod: true,
    setSpeechMethod: vi.fn(),
    speechSmartTurnSettings: {
      enabled: false,
      threshold: 0.5,
      timeoutMs: 2000,
    },
    setSpeechSmartTurnSettings: vi.fn(),
    parakeetSpeechModel: "nvidia/parakeet-tdt-0.6b-v3",
    setParakeetSpeechModel: vi.fn(),
    whisperSpeechModel: "",
    setWhisperSpeechModel: vi.fn(),
  };
  state.setSpeechMethod = vi.fn((method: string) => {
    state.speechMethod = method;
  });
  state.setParakeetSpeechModel = vi.fn((model: string) => {
    state.parakeetSpeechModel = model;
  });
  return state;
});
const speechCaptureSettings = vi.hoisted(() => ({
  keepMicWarm: false,
  setKeepMicWarm: vi.fn(),
  reducePlayback: true,
  setReducePlayback: vi.fn(),
  unspokenPunctuation: false,
  setUnspokenPunctuation: vi.fn(),
  followUpListenMs: 0,
  setFollowUpListenMs: vi.fn(),
  asrAttributionMs: 0,
  setAsrAttributionMs: vi.fn(),
  speechMessagePrefixMode: "microphone" as const,
  setSpeechMessagePrefixMode: vi.fn(),
  speechMessageCustomPrefix: "",
  setSpeechMessageCustomPrefix: vi.fn(),
  speechMessagePrefix: "🎤",
}));
const browserXaiKey = vi.hoisted(() => ({
  browserXaiSttApiKey: "",
  hasBrowserXaiSttApiKey: false,
  setBrowserXaiSttApiKey: vi.fn(),
}));
const speechSourceRuntime = vi.hoisted(() => ({
  relayTransport: false,
  relayedServerSpeechAvailable: false,
}));
const versionState = vi.hoisted(() => ({
  sqlite: { state: "disabled" },
  capabilities: [] as string[],
  voiceBackends: ["vibeallday-grok", "vibeallday-parakeet", "vibeallday-nemo"],
  voiceBackendStatuses: [] as Array<{
    id: string;
    label: string;
    enabled: boolean;
    validationStatus: "pending" | "enabled" | "disabled";
    disabledReason?: string;
  }>,
}));
const prewarmVibeAllDayServerSpeechBackend = vi.hoisted(() =>
  vi.fn(async () => {}),
);
const undoMocks = vi.hoisted(() => ({
  useSettingsUndoBaseline: vi.fn(),
}));

vi.mock("../../../hooks/useModelSettings", () => ({
  useModelSettings: () => modelSettings,
}));

vi.mock("../../../hooks/useSpeechCaptureSettings", () => ({
  MAX_SPEECH_FOLLOW_UP_LISTEN_MS: 30_000,
  MAX_SPEECH_ASR_ATTRIBUTION_MS: 5_000,
  MAX_SPEECH_MESSAGE_CUSTOM_PREFIX_LENGTH: 64,
  useSpeechCaptureSettings: () => speechCaptureSettings,
}));

vi.mock("../../../hooks/useBrowserXaiSttApiKey", () => ({
  useBrowserXaiSttApiKey: () => browserXaiKey,
}));

vi.mock("../../../hooks/useSpeechSourceRuntime", () => ({
  useSpeechSourceRuntime: () => speechSourceRuntime,
}));

vi.mock("../../../hooks/useVersion", () => ({
  useVersion: () => ({
    version: {
      sqlite: versionState.sqlite,
      capabilities: versionState.capabilities,
      voiceBackends: versionState.voiceBackends,
      voiceBackendStatuses: versionState.voiceBackendStatuses,
      voiceBackendCapabilities: {
        "vibeallday-grok": { streaming: true, smartTurn: true },
      },
    },
    loading: false,
  }),
}));

vi.mock("../../../i18n", () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values?.backend
        ? `${key} ${values.backend}`
        : values?.label
          ? `${key} ${values.label}`
          : key,
  }),
}));

vi.mock("../../../lib/speechProviders/VibeAllDayServerProvider", () => ({
  prewarmVibeAllDayServerSpeechBackend,
}));

vi.mock("../SettingsUndoContext", () => undoMocks);

const principalState = vi.hoisted(() => ({ canAdministerHost: true }));

vi.mock("../../../hooks/useActingPrincipal", () => ({
  useCanAdministerHost: () => principalState.canAdministerHost,
}));

vi.mock("../SpeechBackendSetup", () => ({
  SpeechBackendSetup: () => <div>speech-backend-setup-stub</div>,
}));

describe("SpeechSettings", () => {
  it.each(["vibeallday-granite", "vibeallday-whisper", "vibeallday-qwen"])(
    "prewarms %s only when selected in settings",
    (backend) => {
      modelSettings.speechMethod = "vibeallday-grok";
      versionState.voiceBackends = ["vibeallday-grok", backend];
      render(<SpeechSettings />);
      expect(prewarmVibeAllDayServerSpeechBackend).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole("button", {
          name: "filterByLabel speechSettingsBackendTitle",
        }),
      );
      fireEvent.click(
        screen.getByRole("button", {
          name:
            backend === "vibeallday-granite"
              ? /Granite Speech STT/
              : backend === "vibeallday-qwen"
                ? /Qwen3 ASR STT/
                : /Whisper STT/,
        }),
      );
      expect(prewarmVibeAllDayServerSpeechBackend).toHaveBeenCalledWith(
        backend,
        undefined,
      );
    },
  );
  it("finds vocabulary by keyterms and explains disabled storage without mounting controls", () => {
    const scope = {
      query: "keyterms",
      matchValues: false,
      sectionMatched: false,
      categoryLabel: "Speech backends",
      jumpToItem: vi.fn(),
    };
    const view = render(
      <SettingsSearchScopeProvider value={scope}>
        <SpeechSettings />
      </SettingsSearchScopeProvider>,
    );
    expect(screen.getByText("speechVocabularyTitle")).toBeTruthy();
    expect(screen.getByText("speechVocabularyStorageDisabled")).toBeTruthy();
    expect(screen.queryByText("speechVocabularyScan")).toBeNull();
    view.rerender(
      <SettingsSearchScopeProvider
        value={{ ...scope, query: "unrelated-query" }}
      >
        <SpeechSettings />
      </SettingsSearchScopeProvider>,
    );
    expect(screen.queryByText("speechVocabularyTitle")).toBeNull();
  });

  it("gives a limited user the backend choice without host administration", () => {
    versionState.capabilities = [
      VOICE_INPUT_CAPABILITY,
      SPEECH_BACKEND_SETUP_CAPABILITY,
    ];
    const owner = render(<SpeechSettings />);
    expect(screen.getByText("speechVocabularyTitle")).toBeTruthy();
    expect(screen.getByText("speech-backend-setup-stub")).toBeTruthy();
    owner.unmount();
    principalState.canAdministerHost = false;
    try {
      render(<SpeechSettings />);
      expect(screen.queryByText("speechVocabularyTitle")).toBeNull();
      expect(screen.queryByText("speech-backend-setup-stub")).toBeNull();
      expect(
        screen.getByRole("button", {
          name: "filterByLabel speechSettingsBackendTitle",
        }),
      ).toBeTruthy();
      expect(screen.getByLabelText("speechSettingsXaiKeyTitle")).toBeTruthy();
    } finally {
      principalState.canAdministerHost = true;
      versionState.capabilities = [];
    }
  });

  it("shows Whisper presets only on a capable server", () => {
    modelSettings.speechMethod = "vibeallday-whisper";
    versionState.voiceBackends = ["vibeallday-whisper"];
    const view = render(<SpeechSettings />);
    expect(
      screen.queryByRole("combobox", {
        name: "speechSettingsWhisperModelTitle",
      }),
    ).toBeNull();
    versionState.capabilities.push("local-speech-model-selection");
    view.rerender(<SpeechSettings />);
    expect(
      screen.getByRole("combobox", { name: "speechSettingsWhisperModelTitle" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("option", {
        name: "Distil large v3.5 English · 756M parameters · EN WER 5.40%",
      }),
    ).toBeTruthy();
  });
  beforeEach(() => {
    versionState.capabilities = [VOICE_INPUT_CAPABILITY];
  });

  afterEach(() => {
    cleanup();
    modelSettings.speechMethod = "vibeallday-parakeet";
    modelSettings.parakeetSpeechModel = "nvidia/parakeet-tdt-0.6b-v3";
    versionState.voiceBackends = [
      "vibeallday-grok",
      "vibeallday-parakeet",
      "vibeallday-nemo",
    ];
    versionState.voiceBackendStatuses = [];
    speechSourceRuntime.relayTransport = false;
    speechSourceRuntime.relayedServerSpeechAvailable = false;
    modelSettings.setSpeechMethod.mockClear();
    modelSettings.setParakeetSpeechModel.mockClear();
    speechCaptureSettings.setKeepMicWarm.mockClear();
    speechCaptureSettings.setReducePlayback.mockClear();
    speechCaptureSettings.unspokenPunctuation = false;
    speechCaptureSettings.setUnspokenPunctuation.mockClear();
    speechCaptureSettings.setFollowUpListenMs.mockClear();
    speechCaptureSettings.setAsrAttributionMs.mockClear();
    speechCaptureSettings.setSpeechMessagePrefixMode.mockClear();
    speechCaptureSettings.setSpeechMessageCustomPrefix.mockClear();
    browserXaiKey.browserXaiSttApiKey = "";
    browserXaiKey.setBrowserXaiSttApiKey.mockClear();
    undoMocks.useSettingsUndoBaseline.mockClear();
    prewarmVibeAllDayServerSpeechBackend.mockClear();
  });

  it("prewarms a Parakeet preset selected in global STT options", () => {
    render(<SpeechSettings />);

    fireEvent.change(
      screen.getByLabelText("speechSettingsParakeetModelPresetLabel"),
      {
        target: { value: "nvidia/parakeet-ctc-1.1b" },
      },
    );

    expect(modelSettings.setParakeetSpeechModel).toHaveBeenCalledWith(
      "nvidia/parakeet-ctc-1.1b",
    );
    expect(prewarmVibeAllDayServerSpeechBackend).toHaveBeenCalledWith(
      "vibeallday-parakeet",
      "nvidia/parakeet-ctc-1.1b",
    );
  });

  it("offers the microphone speech prefix by default", () => {
    render(<SpeechSettings />);

    const selector = screen.getByLabelText("speechSettingsMessagePrefixTitle");
    expect((selector as HTMLSelectElement).value).toBe("microphone");
    expect(selector.parentElement?.querySelector("svg")).not.toBeNull();
    expect(
      screen.getByRole("option", {
        name: "appearanceToolbarCollapsedButtonMicrophone",
      }).textContent,
    ).not.toContain("🎤");
    fireEvent.change(selector, { target: { value: "stt" } });
    expect(
      speechCaptureSettings.setSpeechMessagePrefixMode,
    ).toHaveBeenCalledWith("stt");
  });

  it("offers default-off browser punctuation as an explicit opt-in", () => {
    render(<SpeechSettings />);

    const toggle = screen.getByRole("checkbox", {
      name: "speechSettingsUnspokenPunctuationTitle",
    }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);

    expect(speechCaptureSettings.setUnspokenPunctuation).toHaveBeenCalledWith(
      true,
    );
  });

  it("keeps the browser xAI STT key out of saved-login autofill", () => {
    render(<SpeechSettings />);

    const apiKey = screen.getByLabelText(
      "speechSettingsXaiKeyTitle",
    ) as HTMLInputElement;

    expect(apiKey.autocomplete).toBe("new-password");
    expect(apiKey.name).toBe("xai-stt-api-key");
  });

  it("includes the browser xAI STT key in pane undo", () => {
    browserXaiKey.browserXaiSttApiKey = "opening-key";
    render(<SpeechSettings />);

    const call = undoMocks.useSettingsUndoBaseline.mock.calls[0];
    if (!call) throw new Error("Speech undo did not register");
    const [snapshot, restore] = call;
    expect(snapshot.browserXaiSttApiKey).toBe("opening-key");

    restore({ ...snapshot, browserXaiSttApiKey: "restored-key" });
    expect(browserXaiKey.setBrowserXaiSttApiKey).toHaveBeenCalledWith(
      "restored-key",
    );
  });

  it("picks a backend from the category cards and marks the one in use", () => {
    versionState.voiceBackendStatuses = [
      {
        id: "vibeallday-grok",
        label: "Grok",
        enabled: true,
        validationStatus: "enabled",
      },
      {
        id: "vibeallday-nemo",
        label: "NeMo",
        enabled: false,
        validationStatus: "pending",
      },
    ];
    render(<SpeechSettings />);

    const local = screen.getByRole("button", { name: "speechCardLocalTitle" });
    const cloud = screen.getByRole("button", { name: "speechCardCloudTitle" });
    expect(local.getAttribute("aria-pressed")).toBe("false");
    expect(cloud.getAttribute("aria-pressed")).toBe("false");
    expect(cloud.textContent).toContain("speechCardStatusAvailable");
    expect(local.textContent).toContain("speechCardStatusValidating");
    expect((local as HTMLButtonElement).disabled).toBe(true);

    // The card takes the first available cloud method in product order.
    fireEvent.click(cloud);
    expect(modelSettings.setSpeechMethod).toHaveBeenCalledWith(
      "xai-grok-direct-streaming",
    );
  });

  it("shows a validating backend immediately but does not allow selection", () => {
    versionState.voiceBackends = ["vibeallday-grok"];
    versionState.voiceBackendStatuses = [
      {
        id: "vibeallday-grok",
        label: "Grok",
        enabled: true,
        validationStatus: "enabled",
      },
      {
        id: "vibeallday-nemo",
        label: "NeMo",
        enabled: false,
        validationStatus: "pending",
      },
    ];
    render(<SpeechSettings />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "filterByLabel speechSettingsBackendTitle",
      }),
    );

    const option = screen.getByRole("button", {
      name: /NeMo Parakeet STT\s*speechSettingsBackendValidating/,
    }) as HTMLButtonElement;
    expect(option.disabled).toBe(true);
  });

  it("switches to a compatible enabled backend for a selected Parakeet preset", () => {
    render(<SpeechSettings />);

    fireEvent.change(
      screen.getByLabelText("speechSettingsParakeetModelPresetLabel"),
      {
        target: { value: "nvidia/parakeet-rnnt-1.1b" },
      },
    );

    expect(modelSettings.setParakeetSpeechModel).toHaveBeenCalledWith(
      "nvidia/parakeet-rnnt-1.1b",
    );
    expect(modelSettings.setSpeechMethod).toHaveBeenCalledWith(
      "vibeallday-nemo",
    );
    expect(prewarmVibeAllDayServerSpeechBackend).toHaveBeenCalledWith(
      "vibeallday-nemo",
      "nvidia/parakeet-rnnt-1.1b",
    );
  });

  it("disables Parakeet presets unsupported by enabled local backends", () => {
    versionState.voiceBackends = ["vibeallday-grok", "vibeallday-parakeet"];

    render(<SpeechSettings />);

    const option = screen.getByRole("option", {
      name: /RNNT 1\.1B English lowercase/,
    }) as HTMLOptionElement;

    expect(option.disabled).toBe(true);
    expect(option.textContent).toContain("NeMo Parakeet");
  });

  it("prewarms the current Parakeet model when selecting a local STT backend globally", () => {
    modelSettings.speechMethod = "vibeallday-grok";
    render(<SpeechSettings />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "filterByLabel speechSettingsBackendTitle",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /NeMo Parakeet STT/ }));

    expect(modelSettings.setSpeechMethod).toHaveBeenCalledWith(
      "vibeallday-nemo",
    );
    expect(prewarmVibeAllDayServerSpeechBackend).toHaveBeenCalledWith(
      "vibeallday-nemo",
      "nvidia/parakeet-tdt-0.6b-v3",
    );
  });

  it("normalizes an incompatible preset when selecting a local STT backend globally", () => {
    versionState.capabilities = ["local-speech-model-selection"];
    modelSettings.speechMethod = "vibeallday-grok";
    modelSettings.parakeetSpeechModel = "nvidia/parakeet-rnnt-1.1b";
    render(<SpeechSettings />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "filterByLabel speechSettingsBackendTitle",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Parakeet STT/ }));

    expect(modelSettings.setSpeechMethod).toHaveBeenCalledWith(
      "vibeallday-parakeet",
    );
    expect(modelSettings.setParakeetSpeechModel).toHaveBeenCalledWith(
      "ai-and-i-project/parakeet-tdt-0.6b-v2-hf",
    );
    expect(prewarmVibeAllDayServerSpeechBackend).toHaveBeenCalledWith(
      "vibeallday-parakeet",
      "ai-and-i-project/parakeet-tdt-0.6b-v2-hf",
    );
  });

  it("shows a missing explicit backend as unavailable without switching", () => {
    modelSettings.speechMethod = "vibeallday-deepgram";
    versionState.voiceBackends = ["vibeallday-grok"];

    render(<SpeechSettings />);

    expect(screen.getByText("speechSettingsBackendUnavailable")).toBeTruthy();
    expect(modelSettings.setSpeechMethod).not.toHaveBeenCalled();
  });

  it("uses the current relayed source speech channel for Smart Turn", () => {
    modelSettings.speechMethod = "vibeallday-grok";
    speechSourceRuntime.relayTransport = true;
    speechSourceRuntime.relayedServerSpeechAvailable = true;

    render(<SpeechSettings />);

    expect(screen.getByRole("checkbox", { name: "Smart Turn" })).toBeTruthy();
    expect(
      screen.queryByText("speechSettingsStreamingRelayUnavailable"),
    ).toBeNull();
  });

  it("reports relayed streaming unavailable without a speech channel", () => {
    modelSettings.speechMethod = "vibeallday-grok";
    speechSourceRuntime.relayTransport = true;
    speechSourceRuntime.relayedServerSpeechAvailable = false;

    render(<SpeechSettings />);

    expect(screen.queryByRole("checkbox", { name: "Smart Turn" })).toBeNull();
    expect(
      screen.getAllByText("speechSettingsStreamingRelayUnavailable").length,
    ).toBeGreaterThan(0);
  });
});
