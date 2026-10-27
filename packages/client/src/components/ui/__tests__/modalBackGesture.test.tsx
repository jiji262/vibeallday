import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useModalBackGesture } from "../Modal";

function Harness({ onClose }: { onClose?: () => void }) {
  useModalBackGesture(onClose ?? (() => {}), true, "__testModal");
  return null;
}

/** A menu item that closes its menu and opens a dialog in one commit. */
function Chain({ step }: { step: "menu" | "dialog" | "none" }) {
  if (step === "none") return null;
  return <Harness key={step} />;
}

/** Navigate the way FileResourceActions does: a new URL, same state object. */
function navigateInTab(url: string): void {
  window.history.pushState(window.history.state, "", url);
}

describe("useModalBackGesture", () => {
  let backSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.history.replaceState(null, "", "/projects/p/sessions/s");
    backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
  });

  afterEach(() => {
    backSpy.mockRestore();
  });

  it("drops its history entry when the modal closes in place", async () => {
    const view = render(<Harness />);
    view.unmount();
    await Promise.resolve();
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it("leaves a navigation alone when the modal unmounts because of it", async () => {
    const view = render(<Harness />);
    navigateInTab("/new-session?projectId=p");
    view.unmount();
    await Promise.resolve();
    expect(backSpy).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/new-session");
  });

  it("hands its entry to a modal that opens as it closes", async () => {
    const view = render(<Chain step="menu" />);
    const depth = window.history.length;
    view.rerender(<Chain step="dialog" />);
    await Promise.resolve();
    expect(window.history.length).toBe(depth);
    expect(backSpy).not.toHaveBeenCalled();
    view.rerender(<Chain step="none" />);
    await Promise.resolve();
    expect(backSpy).toHaveBeenCalledTimes(1);
  });
});
