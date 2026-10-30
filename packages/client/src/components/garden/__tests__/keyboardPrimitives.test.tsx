// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../i18n";
import { Segmented } from "../Segmented";
import { SplitButton } from "../SplitButton";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

type Mode = "queue" | "now" | "off";

function ModePicker({ onChange }: { onChange: (mode: Mode) => void }) {
  const [mode, setMode] = useState<Mode>("queue");
  return (
    <Segmented<Mode>
      label="Busy send"
      value={mode}
      onChange={(next) => {
        setMode(next);
        onChange(next);
      }}
      options={[
        { value: "queue", label: "Queue" },
        { value: "now", label: "Now", disabled: true },
        { value: "off", label: "Off" },
      ]}
    />
  );
}

describe("Segmented", () => {
  it("keeps one tab stop and selects with arrows, skipping disabled options", () => {
    const onChange = vi.fn();
    render(<ModePicker onChange={onChange} />);
    const queue = screen.getByRole("radio", { name: "Queue" });
    const off = screen.getByRole("radio", { name: "Off" });
    expect(queue.tabIndex).toBe(0);
    expect(off.tabIndex).toBe(-1);

    queue.focus();
    fireEvent.keyDown(queue, { key: "ArrowRight" });

    expect(onChange).toHaveBeenLastCalledWith("off");
    expect(document.activeElement).toBe(off);
    expect(off.getAttribute("aria-checked")).toBe("true");
    expect(off.tabIndex).toBe(0);
    expect(queue.tabIndex).toBe(-1);

    fireEvent.keyDown(off, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("queue");
    expect(document.activeElement).toBe(queue);
  });
});

describe("SplitButton", () => {
  it("opens its menu, closes on Escape and returns focus to the menu button", () => {
    const onSelect = vi.fn();
    render(
      <I18nProvider>
        <SplitButton
          onClick={vi.fn()}
          menuLabel="Send options"
          items={[{ key: "later", label: "Send later", onSelect }]}
        >
          Send
        </SplitButton>
      </I18nProvider>,
    );
    const toggle = screen.getByRole("button", { name: "Send options" });
    expect(toggle.getAttribute("aria-haspopup")).toBe("menu");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menuitem", { name: "Send later" })).toBeTruthy();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
