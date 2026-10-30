// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LATEX_MATH_RENDERING_CLIENT_CAPABILITY } from "@vibeallday/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentContextSettings } from "../AgentContextSettings";

// Stable like the real hook: a fresh settings object per render would
// re-sync the form and wipe in-progress typing.
const serverSettings = vi.hoisted(() => ({
  settings: {
    globalInstructions: "",
    heartbeatTurnsAfterMinutes: 15,
    heartbeatTurnText: "check status and continue",
    agentContextHints: { latexMathRendering: false },
  },
  isLoading: false,
  error: null,
  updateSettings: () => Promise.resolve(),
}));

vi.mock("../../../hooks/useServerSettings", () => ({
  useServerSettings: () => serverSettings,
}));

vi.mock("../../../i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../SettingsPaneTitleContext", () => ({
  useSettingsPaneTitle: vi.fn(),
}));

vi.mock("../SettingsUndoContext", () => ({
  useSettingsUndoBaseline: vi.fn(),
}));

describe("AgentContextSettings", () => {
  afterEach(cleanup);

  it("shows the exact LaTeX agent-context block before opt-in", () => {
    render(<AgentContextSettings />);

    const preview = screen
      .getByText("agentContextSuggestedLatexPreviewTitle")
      .closest("[data-agent-context-block]")
      ?.querySelector("pre");
    expect(preview).not.toBeNull();
    expect(preview?.textContent).toBe(
      `[Client capabilities]\n${LATEX_MATH_RENDERING_CLIENT_CAPABILITY}`,
    );
    expect(
      (
        screen.getByRole("checkbox", {
          name: "agentContextSuggestedLatexTitle",
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);
  });

  it("echoes every sequential keystroke in the instructions editor", () => {
    render(<AgentContextSettings />);
    const editor = screen.getByRole("textbox", {
      name: "agentContextGlobalInstructions",
    }) as HTMLTextAreaElement;
    const text = "Use strict mode.\nPrefer pure functions. ".repeat(8);
    let typed = "";
    for (const char of text) {
      typed += char;
      fireEvent.change(editor, { target: { value: typed } });
      expect(editor.value).toBe(typed);
    }
    expect(
      screen.getByRole("button", { name: "providersSave" }),
    ).not.toHaveProperty("disabled", true);
  });
});
