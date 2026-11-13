import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  type ComposerToolbarOverflowLayoutSignatureInput,
  getComposerTrayKeys,
  useMeasuredComposerOverflow,
} from "../useMessageInputToolbarLayout";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([true, false])(
  "hides only enough controls, respecting configured priority and ties (%s)",
  (samePriority) => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    const frame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", frame);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return { width: Number(this.dataset.width ?? 100) } as DOMRect;
      },
    );
    function Toolbar({ composing }: { composing: boolean }) {
      const { tier, hiddenControls, setToolbarRef } =
        useMeasuredComposerOverflow({
          layoutKey: String(composing),
          hasControls: true,
        });
      return (
        <div
          ref={setToolbarRef}
          data-width="180"
          data-testid="toolbar"
          data-tier={tier}
        >
          <div className="message-input-left">
            <button
              type="button"
              className="composer-bottom-overflow-inline composer-bottom-overflow-early"
              data-session-toolbar-control="modeSelector"
              style={{
                display: hiddenControls.has("modeSelector") ? "none" : "block",
              }}
            >
              First
            </button>
            <button
              type="button"
              data-session-toolbar-control="attachments"
              className={`composer-bottom-overflow-inline composer-bottom-overflow-${samePriority ? "early" : "medium"}`}
              style={{
                display: hiddenControls.has("attachments") ? "none" : "block",
              }}
            >
              Second
            </button>
          </div>
          <div className="message-input-actions">
            <button
              type="button"
              data-width="20"
              className="composer-bottom-overflow-inline"
              data-session-toolbar-control="microphone"
            >
              Pinned
            </button>
            <button type="button" data-width={composing ? 100 : 30}>
              Send
            </button>
          </div>
        </div>
      );
    }
    const { rerender } = render(<Toolbar composing={false} />);
    expect(screen.getByTestId("toolbar").dataset.tier).toBe("early");
    expect(screen.getByText("First").style.display).toBe(
      samePriority ? "block" : "none",
    );
    expect(screen.getByText("Second").style.display).toBe(
      samePriority ? "none" : "block",
    );
    rerender(<Toolbar composing />);
    expect(screen.getByTestId("toolbar").dataset.tier).toBe(
      samePriority ? "early" : "medium",
    );
    expect(screen.getByText("First").style.display).toBe("none");
    expect(screen.getByText("Second").style.display).toBe("none");
    expect(screen.getByText("Pinned").style.display).not.toBe("none");
    expect(frame).not.toHaveBeenCalled();
  },
);

it("keeps pinned tools in the session row and trays the other shown tools", () => {
  const layout: ComposerToolbarOverflowLayoutSignatureInput = {
    modeSelector: "first",
    attachments: "first",
    slashMenu: "mid",
    thinkingToggle: "mid",
    renderMode: "last",
    conversationView: "last",
    browserDebug: "off",
    nudge: "off",
    syntheticDone: "off",
    sessionStatus: "pin",
    shortcutsHelp: "last",
    transcriptSearch: "first",
    contextUsage: "pin",
    btw: "pin",
    steerNow: "pin",
    topicShift: "off",
    projectQueue: "last",
    projectQueueNewSessionShortcut: "off",
    microphone: "live",
    waveform: true,
    send: "send",
    queue: "off",
    alternate: false,
    stop: false,
    pending: "off",
  };

  const tray = getComposerTrayKeys(layout, false);

  // Show always (pin) keeps a tool inline with no tray copy.
  expect(tray).not.toContain("btw");
  expect(tray).not.toContain("steerNow");
  // Primary and inline-only controls never move into the tray.
  expect(tray).not.toContain("attachments");
  expect(tray).not.toContain("contextUsage");
  expect(tray).not.toContain("sessionStatus");
  // Hidden tools stay out of both places.
  expect(tray).not.toContain("nudge");
  expect(tray).toEqual(
    expect.arrayContaining([
      "slashMenu",
      "renderMode",
      "conversationView",
      "shortcutsHelp",
      "transcriptSearch",
      "projectQueue",
    ]),
  );
  // Phones also fold the controls configured to narrow first.
  expect(getComposerTrayKeys(layout, true)).toEqual(
    expect.arrayContaining(["attachments", "modeSelector"]),
  );
});
