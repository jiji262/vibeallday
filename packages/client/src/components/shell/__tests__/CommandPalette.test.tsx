// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../i18n";
import { Modal } from "../../ui/Modal";
import { CommandPaletteHost } from "../CommandPaletteHost";
import type { PaletteItem } from "../paletteData";
import { SearchTrigger } from "../SearchTrigger";
import { isCommandPaletteShortcut } from "../shortcut";

const ITEMS: PaletteItem[] = [
  { id: "jump:projects", group: "jump", label: "Projects", to: "/projects" },
  { id: "jump:settings", group: "jump", label: "Settings", to: "/settings" },
  {
    id: "project:p1",
    group: "projects",
    label: "vibeallday",
    hint: "codes/vibeallday",
    to: "/sessions?project=p1&source=projects",
  },
];

vi.mock("../usePaletteCandidates", () => ({
  usePaletteCandidates: () => ITEMS,
}));
vi.mock("../../../hooks/useRemoteBasePath", () => ({
  useRemoteBasePath: () => "/remote/host",
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname + location.search}
    </output>
  );
}

function renderShell(extra?: ReactNode) {
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={["/remote/host/agents"]}>
        <CommandPaletteHost>
          <button type="button">before</button>
          <SearchTrigger />
          <LocationProbe />
          {extra}
        </CommandPaletteHost>
      </MemoryRouter>
    </I18nProvider>,
  );
}

function pressShortcut(init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key: "k",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

function typeSequentially(input: HTMLElement, text: string) {
  let value = "";
  for (const char of text) {
    value += char;
    fireEvent.change(input, { target: { value } });
    // Each keystroke is in the field before results catch up.
    expect((input as HTMLInputElement).value).toBe(value);
  }
}

const location = () => screen.getByTestId("location").textContent;

describe("command palette shortcut", () => {
  const key = (init: KeyboardEventInit) =>
    new KeyboardEvent("keydown", { key: "k", cancelable: true, ...init });

  it("binds ⌘K on Apple platforms and Ctrl+K elsewhere", () => {
    expect(isCommandPaletteShortcut(key({ metaKey: true }), true)).toBe(true);
    expect(isCommandPaletteShortcut(key({ ctrlKey: true }), true)).toBe(false);
    expect(isCommandPaletteShortcut(key({ ctrlKey: true }), false)).toBe(true);
    expect(isCommandPaletteShortcut(key({ metaKey: true }), false)).toBe(false);
  });

  it("leaves modified, consumed and composing keys alone", () => {
    expect(
      isCommandPaletteShortcut(key({ ctrlKey: true, altKey: true }), false),
    ).toBe(false);
    expect(
      isCommandPaletteShortcut(key({ ctrlKey: true, shiftKey: true }), false),
    ).toBe(false);
    const consumed = key({ ctrlKey: true });
    consumed.preventDefault();
    expect(isCommandPaletteShortcut(consumed, false)).toBe(false);
    expect(
      isCommandPaletteShortcut(
        key({ ctrlKey: true, isComposing: true }),
        false,
      ),
    ).toBe(false);
  });
});

describe("CommandPaletteHost", () => {
  const platform = Object.getOwnPropertyDescriptor(navigator, "platform");

  beforeEach(() => {
    Object.defineProperty(navigator, "platform", {
      configurable: true,
      value: "Win32",
    });
  });

  afterEach(() => {
    cleanup();
    if (platform) Object.defineProperty(navigator, "platform", platform);
    else Reflect.deleteProperty(navigator, "platform");
  });

  it("opens on the shortcut, filters as typed and jumps under the base path", async () => {
    renderShell();
    const before = screen.getByRole("button", { name: "before" });
    before.focus();

    expect(pressShortcut().defaultPrevented).toBe(true);
    const input = await screen.findByRole("combobox");
    typeSequentially(input, "vibe");
    await screen.findByRole("option", { name: /vibeallday/ });
    expect(screen.queryByRole("option", { name: /^Settings/ })).toBeNull();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(location()).toBe("/remote/host/sessions?project=p1&source=projects");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(before);
  });

  it("searches sessions when Enter lands on an unmatched query", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Search and jump" }));
    const input = await screen.findByRole("combobox");
    typeSequentially(input, "flaky test");
    await screen.findByText("No matches. Press Enter to search sessions.");

    fireEvent.keyDown(input, { key: "Enter" });

    expect(location()).toBe("/remote/host/sessions?q=flaky%20test");
  });

  it("closes itself, not the dialog it opened over, on Escape", async () => {
    const closeModal = vi.fn();
    renderShell(
      <Modal title="Restart session" onClose={closeModal}>
        <p>body</p>
      </Modal>,
    );

    pressShortcut();
    await screen.findByRole("combobox");
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(closeModal).not.toHaveBeenCalled();
    expect(screen.getByText("Restart session")).toBeTruthy();
  });

  it("ignores other combinations and closes on Escape", async () => {
    renderShell();
    expect(pressShortcut({ altKey: true }).defaultPrevented).toBe(false);
    expect(pressShortcut({ key: "j" }).defaultPrevented).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();

    pressShortcut();
    await screen.findByRole("combobox");
    // Escape travels the modal layer's document-capture listener, which the
    // palette owns while it is open, so a dialog behind it stays open.
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(location()).toBe("/remote/host/agents");
  });
});
