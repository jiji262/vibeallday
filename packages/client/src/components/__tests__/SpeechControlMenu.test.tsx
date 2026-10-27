// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { UI_KEYS } from "../../lib/storageKeys";
import { SpeechControlMenu } from "../SpeechControlMenu";

const modelSettings = vi.hoisted(() => {
  const state = {
    parakeetSpeechModel: "nvidia/parakeet-tdt-0.6b-v3",
    setParakeetSpeechModel: vi.fn(),
    whisperSpeechModel: "",
    setWhisperSpeechModel: vi.fn(),
  };
  state.setParakeetSpeechModel = vi.fn((model: string) => {
    state.parakeetSpeechModel = model;
  });
  return state;
});
const prewarmVibeAllDayServerSpeechBackend = vi.hoisted(() =>
  vi.fn(async () => {}),
);
const versionState = vi.hoisted(() => ({ capabilities: [] as string[] }));
vi.mock("../../hooks/useVersion", () => ({
  useVersion: () => ({ version: versionState }),
}));

vi.mock("../../hooks/useModelSettings", () => ({
  useModelSettings: () => ({
    parakeetSpeechModel: modelSettings.parakeetSpeechModel,
    setParakeetSpeechModel: modelSettings.setParakeetSpeechModel,
    whisperSpeechModel: modelSettings.whisperSpeechModel,
    setWhisperSpeechModel: modelSettings.setWhisperSpeechModel,
  }),
}));

vi.mock("../../lib/speechProviders/VibeAllDayServerProvider", () => ({
  prewarmVibeAllDayServerSpeechBackend,
}));

function installMediaDevices(devices: MediaDeviceInfo[]) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      enumerateDevices: vi.fn(async () => devices),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
}

function renderSpeechControlMenu(
  props: React.ComponentProps<typeof SpeechControlMenu>,
) {
  return render(
    <I18nProvider>
      <SpeechControlMenu {...props} />
    </I18nProvider>,
  );
}

// Opening the menu kicks off the async mic-device enumeration; settle it
// inside act so its setState lands before the test proceeds.
async function openSpeechMenu() {
  fireEvent.contextMenu(screen.getByRole("button", { name: "voice" }));
  await act(async () => {});
}

describe("SpeechControlMenu", () => {
  it("gates recent model choices and prewarms the chosen Whisper model", async () => {
    installMediaDevices([]);
    const props = {
      trigger: <button type="button">voice</button>,
      showMethodSelector: false,
      methodOptions: [],
      selectedMethod: "vibeallday-whisper" as const,
      onMethodChange: vi.fn(),
    };
    const view = renderSpeechControlMenu(props);
    await openSpeechMenu();
    expect(
      screen.queryByRole("combobox", { name: "Whisper model" }),
    ).toBeNull();
    expect(prewarmVibeAllDayServerSpeechBackend).not.toHaveBeenCalled();
    versionState.capabilities = ["local-speech-model-selection"];
    view.rerender(
      <I18nProvider>
        <SpeechControlMenu {...props} />
      </I18nProvider>,
    );
    await act(async () =>
      fireEvent.change(
        screen.getByRole("combobox", { name: "Whisper model" }),
        { target: { value: "distil-large-v3.5" } },
      ),
    );
    expect(modelSettings.setWhisperSpeechModel).toHaveBeenCalledWith(
      "distil-large-v3.5",
    );
    expect(prewarmVibeAllDayServerSpeechBackend).toHaveBeenCalledWith(
      "vibeallday-whisper",
      "distil-large-v3.5",
    );
  });

  it("offers unified English only on capable NeMo servers and preserves server defaults", async () => {
    installMediaDevices([]);
    modelSettings.parakeetSpeechModel = "";
    const props = {
      trigger: <button type="button">voice</button>,
      showMethodSelector: false,
      methodOptions: [],
      selectedMethod: "vibeallday-nemo" as const,
      onMethodChange: vi.fn(),
    };
    const view = renderSpeechControlMenu(props);
    await openSpeechMenu();
    expect(
      screen.queryByRole("option", { name: /Unified 0.6B English/ }),
    ).toBeNull();
    versionState.capabilities = ["local-speech-model-selection"];
    view.rerender(
      <I18nProvider>
        <SpeechControlMenu {...props} />
      </I18nProvider>,
    );
    expect(
      (
        screen.getByRole("combobox", {
          name: "Parakeet model preset",
        }) as HTMLSelectElement
      ).value,
    ).toBe("default");
    fireEvent.change(
      screen.getByRole("combobox", { name: "Parakeet model preset" }),
      { target: { value: "nvidia/parakeet-unified-en-0.6b" } },
    );
    expect(prewarmVibeAllDayServerSpeechBackend).toHaveBeenLastCalledWith(
      "vibeallday-nemo",
      "nvidia/parakeet-unified-en-0.6b",
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Parakeet model preset" }),
      { target: { value: "default" } },
    );
    expect(prewarmVibeAllDayServerSpeechBackend).toHaveBeenLastCalledWith(
      "vibeallday-nemo",
      undefined,
    );
    expect(modelSettings.setParakeetSpeechModel).toHaveBeenLastCalledWith("");
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
    modelSettings.parakeetSpeechModel = "nvidia/parakeet-tdt-0.6b-v3";
    modelSettings.setParakeetSpeechModel.mockClear();
    prewarmVibeAllDayServerSpeechBackend.mockClear();
    versionState.capabilities = [];
    modelSettings.setWhisperSpeechModel.mockClear();
  });

  it("persists a selected microphone device for server STT capture", async () => {
    installMediaDevices([
      {
        kind: "audioinput",
        deviceId: "default",
        label: "Default microphone",
      } as MediaDeviceInfo,
      {
        kind: "audioinput",
        deviceId: "usb-mic",
        label: "USB microphone",
      } as MediaDeviceInfo,
      {
        kind: "videoinput",
        deviceId: "camera",
        label: "Camera",
      } as MediaDeviceInfo,
    ]);

    renderSpeechControlMenu({
      trigger: <button type="button">voice</button>,
      showMethodSelector: false,
      methodOptions: [],
      selectedMethod: "vibeallday-grok",
      onMethodChange: vi.fn(),
    });

    await openSpeechMenu();
    const select = await screen.findByRole("combobox", {
      name: "Microphone",
    });
    await waitFor(() =>
      expect(screen.getByText("USB microphone")).toBeDefined(),
    );

    fireEvent.change(select, { target: { value: "usb-mic" } });

    expect(localStorage.getItem(UI_KEYS.speechMicDeviceId)).toBe("usb-mic");
  });

  it("defaults voice capture on and can opt back into raw capture", async () => {
    installMediaDevices([]);

    renderSpeechControlMenu({
      trigger: <button type="button">voice</button>,
      showMethodSelector: false,
      methodOptions: [],
      selectedMethod: "browser-native",
      onMethodChange: vi.fn(),
    });

    await openSpeechMenu();
    const toggle = screen.getByRole("checkbox", {
      name: "Reduce playback while dictating",
    });
    expect((toggle as HTMLInputElement).checked).toBe(true);

    fireEvent.click(toggle);

    expect(localStorage.getItem(UI_KEYS.speechReducePlayback)).toBe("false");
  });

  it("prewarms once while the mouse remains near the trigger margin", () => {
    installMediaDevices([]);
    const prewarm = vi.fn();

    renderSpeechControlMenu({
      trigger: <button type="button">voice</button>,
      showMethodSelector: false,
      methodOptions: [],
      selectedMethod: "vibeallday-grok",
      onMethodChange: vi.fn(),
      onPointerNearTrigger: prewarm,
    });

    window.dispatchEvent(
      new MouseEvent("pointermove", { clientX: 1, clientY: 1 }),
    );
    window.dispatchEvent(
      new MouseEvent("pointermove", { clientX: 2, clientY: 2 }),
    );
    window.dispatchEvent(
      new MouseEvent("pointermove", { clientX: 100, clientY: 100 }),
    );
    window.dispatchEvent(
      new MouseEvent("pointermove", { clientX: 1, clientY: 1 }),
    );

    expect(prewarm).toHaveBeenCalledTimes(2);
  });

  it("stops active capture before opening speech options", async () => {
    installMediaDevices([]);
    const onBeforeOpen = vi.fn();

    renderSpeechControlMenu({
      trigger: <button type="button">voice</button>,
      showMethodSelector: false,
      methodOptions: [],
      selectedMethod: "vibeallday-grok",
      onMethodChange: vi.fn(),
      onBeforeOpen,
    });

    await openSpeechMenu();

    expect(onBeforeOpen).toHaveBeenCalledTimes(1);
  });

  it("stops active capture before changing speech backend", async () => {
    installMediaDevices([]);
    const onBeforeCaptureChange = vi.fn();
    const onMethodChange = vi.fn();

    renderSpeechControlMenu({
      trigger: <button type="button">voice</button>,
      showMethodSelector: true,
      methodOptions: [
        { value: "browser-native", label: "Browser" },
        {
          value: "xai-grok-direct-streaming",
          label: "Grok direct",
          description: "Browser streams PCM audio directly to xAI.",
        },
      ],
      selectedMethod: "browser-native",
      onMethodChange,
      onBeforeCaptureChange,
    });

    await openSpeechMenu();
    const grokDirect = screen.getByRole("radio", { name: "Grok direct" });
    const descriptionId = grokDirect.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId ?? "")?.textContent).toBe(
      "Browser streams PCM audio directly to xAI.",
    );
    fireEvent.click(grokDirect);

    expect(onBeforeCaptureChange).toHaveBeenCalledTimes(1);
    expect(onMethodChange).toHaveBeenCalledWith(["xai-grok-direct-streaming"]);
  });

  it("does not expose browser xAI key editing in the mic options", async () => {
    installMediaDevices([]);

    renderSpeechControlMenu({
      trigger: <button type="button">voice</button>,
      showMethodSelector: false,
      methodOptions: [],
      selectedMethod: "vibeallday-grok",
      onMethodChange: vi.fn(),
    });

    await openSpeechMenu();

    expect(screen.queryByLabelText("Browser xAI STT Key")).toBeNull();
  });

  it.each(["vibeallday-parakeet", "vibeallday-nemo"] as const)(
    "shows preset and free-text Parakeet model controls for %s",
    async (selectedMethod) => {
      installMediaDevices([]);
      const onBeforeCaptureChange = vi.fn();

      renderSpeechControlMenu({
        trigger: <button type="button">voice</button>,
        showMethodSelector: false,
        methodOptions: [],
        selectedMethod,
        onMethodChange: vi.fn(),
        onBeforeCaptureChange,
      });

      await openSpeechMenu();
      const preset = screen.getByLabelText("Parakeet model preset");
      expect(
        screen.getByText("CTC 1.1B English lowercase · EN WER 5.92%"),
      ).toBeDefined();
      fireEvent.change(preset, {
        target: { value: "nvidia/parakeet-ctc-1.1b" },
      });

      const input = screen.getByLabelText("Parakeet model id");
      fireEvent.change(input, {
        target: { value: "nvidia/custom-parakeet" },
      });

      expect(modelSettings.setParakeetSpeechModel).toHaveBeenCalledWith(
        "nvidia/parakeet-ctc-1.1b",
      );
      expect(modelSettings.setParakeetSpeechModel).toHaveBeenCalledWith(
        "nvidia/custom-parakeet",
      );
      expect(onBeforeCaptureChange).toHaveBeenCalledTimes(2);
      expect(prewarmVibeAllDayServerSpeechBackend).toHaveBeenCalledWith(
        selectedMethod,
        "nvidia/parakeet-ctc-1.1b",
      );
    },
  );

  it("hides Parakeet presets that no enabled backend can run", async () => {
    installMediaDevices([]);

    renderSpeechControlMenu({
      trigger: <button type="button">voice</button>,
      showMethodSelector: false,
      methodOptions: [],
      selectedMethod: "vibeallday-parakeet",
      onMethodChange: vi.fn(),
    });

    await openSpeechMenu();

    expect(
      screen.getByText("CTC 1.1B English lowercase · EN WER 5.92%"),
    ).toBeDefined();
    expect(screen.queryByText(/RNNT 1\.1B English lowercase/)).toBeNull();
  });

  it("lists only the selected backend's own models, keeping backends separate", async () => {
    installMediaDevices([]);

    renderSpeechControlMenu({
      trigger: <button type="button">voice</button>,
      showMethodSelector: false,
      methodOptions: [
        { value: "vibeallday-parakeet", label: "Parakeet" },
        { value: "vibeallday-nemo", label: "NeMo Parakeet" },
      ],
      selectedMethod: "vibeallday-parakeet",
      onMethodChange: vi.fn(),
    });

    await openSpeechMenu();

    // vibeallday-parakeet runs TDT + CTC but not the NeMo-only RNNT, even though
    // vibeallday-nemo is enabled — no cross-backend auto-switch from this dropdown.
    expect(
      screen.getByText("TDT 0.6B v3 multilingual · EN WER 4.86%"),
    ).toBeDefined();
    expect(
      screen.getByText("CTC 1.1B English lowercase · EN WER 5.92%"),
    ).toBeDefined();
    expect(screen.queryByText(/RNNT 1\.1B English lowercase/)).toBeNull();
  });

  it("lists all three models for the vibeallday-nemo backend", async () => {
    installMediaDevices([]);

    renderSpeechControlMenu({
      trigger: <button type="button">voice</button>,
      showMethodSelector: false,
      methodOptions: [
        { value: "vibeallday-parakeet", label: "Parakeet" },
        { value: "vibeallday-nemo", label: "NeMo Parakeet" },
      ],
      selectedMethod: "vibeallday-nemo",
      onMethodChange: vi.fn(),
    });

    await openSpeechMenu();

    expect(
      screen.getByText("TDT 0.6B v3 multilingual · EN WER 4.86%"),
    ).toBeDefined();
    expect(
      screen.getByText("CTC 1.1B English lowercase · EN WER 5.92%"),
    ).toBeDefined();
    expect(
      screen.getByText("RNNT 1.1B English lowercase · EN WER 5.76%"),
    ).toBeDefined();
  });

  it("prewarms a custom Parakeet model on free-text commit", async () => {
    installMediaDevices([]);
    modelSettings.parakeetSpeechModel = "nvidia/custom-parakeet";

    renderSpeechControlMenu({
      trigger: <button type="button">voice</button>,
      showMethodSelector: false,
      methodOptions: [],
      selectedMethod: "vibeallday-parakeet",
      onMethodChange: vi.fn(),
    });

    await openSpeechMenu();
    fireEvent.blur(screen.getByLabelText("Parakeet model id"));

    expect(prewarmVibeAllDayServerSpeechBackend).toHaveBeenCalledWith(
      "vibeallday-parakeet",
      "nvidia/custom-parakeet",
    );
  });

  it("prewarms the current Parakeet model when switching to a Parakeet backend", async () => {
    installMediaDevices([]);
    const onMethodChange = vi.fn();

    renderSpeechControlMenu({
      trigger: <button type="button">voice</button>,
      showMethodSelector: true,
      methodOptions: [
        { value: "vibeallday-grok", label: "Grok" },
        { value: "vibeallday-nemo", label: "NeMo Parakeet" },
      ],
      selectedMethod: "vibeallday-grok",
      onMethodChange,
    });

    await openSpeechMenu();
    fireEvent.click(screen.getByRole("radio", { name: "NeMo Parakeet" }));

    expect(onMethodChange).toHaveBeenCalledWith(["vibeallday-nemo"]);
    expect(prewarmVibeAllDayServerSpeechBackend).toHaveBeenCalledWith(
      "vibeallday-nemo",
      "nvidia/parakeet-tdt-0.6b-v3",
    );
  });

  it("normalizes an incompatible preset when switching to a Parakeet backend", async () => {
    versionState.capabilities = ["local-speech-model-selection"];
    installMediaDevices([]);
    modelSettings.parakeetSpeechModel = "nvidia/parakeet-rnnt-1.1b";
    const onMethodChange = vi.fn();

    renderSpeechControlMenu({
      trigger: <button type="button">voice</button>,
      showMethodSelector: true,
      methodOptions: [
        { value: "vibeallday-grok", label: "Grok" },
        { value: "vibeallday-parakeet", label: "Parakeet" },
      ],
      selectedMethod: "vibeallday-grok",
      onMethodChange,
    });

    await openSpeechMenu();
    fireEvent.click(screen.getByRole("radio", { name: "Parakeet" }));

    expect(onMethodChange).toHaveBeenCalledWith(["vibeallday-parakeet"]);
    expect(modelSettings.setParakeetSpeechModel).toHaveBeenCalledWith(
      "ai-and-i-project/parakeet-tdt-0.6b-v2-hf",
    );
    expect(prewarmVibeAllDayServerSpeechBackend).toHaveBeenCalledWith(
      "vibeallday-parakeet",
      "ai-and-i-project/parakeet-tdt-0.6b-v2-hf",
    );
  });
});
