// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTriageShortcuts } from "../useTriageShortcuts";

function Harness(props: { onSkip: () => void; onExit: () => void }) {
  useTriageShortcuts(props);
  return (
    <>
      <input aria-label="reason" />
      <textarea aria-label="answer" />
      <div
        role="textbox"
        tabIndex={0}
        aria-label="editor"
        contentEditable
        suppressContentEditableWarning
      />
    </>
  );
}

describe("useTriageShortcuts", () => {
  afterEach(cleanup);

  it("skips and exits from the page but never while typing", () => {
    const onSkip = vi.fn();
    const onExit = vi.fn();
    render(<Harness onSkip={onSkip} onExit={onExit} />);

    for (const field of ["reason", "answer", "editor"]) {
      const target = screen.getByLabelText(field);
      fireEvent.keyDown(target, { key: "s" });
      fireEvent.keyDown(target, { key: "Escape" });
    }
    expect(onSkip).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: "s", metaKey: true });
    expect(onSkip).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: "S" });
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe("useTriageShortcuts approve and deny", () => {
  afterEach(cleanup);

  it("answers once per key press and never from a held key", () => {
    const onApprove = vi.fn();
    const onDeny = vi.fn();
    render(
      <ApproveHarness onApprove={onApprove} onDeny={onDeny} onExit={vi.fn()} />,
    );

    fireEvent.keyDown(screen.getByLabelText("reason"), { key: "a" });
    fireEvent.keyDown(screen.getByLabelText("reason"), { key: "d" });
    expect(onApprove).not.toHaveBeenCalled();
    expect(onDeny).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: "a" });
    fireEvent.keyDown(document.body, { key: "a", repeat: true });
    fireEvent.keyDown(document.body, { key: "a", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "D" });
    fireEvent.keyDown(document.body, { key: "d", repeat: true });
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onDeny).toHaveBeenCalledTimes(1);
  });

  it("leaves A and D alone while nothing can be answered", () => {
    const onExit = vi.fn();
    render(<ApproveHarness onExit={onExit} />);
    const event = new KeyboardEvent("keydown", {
      key: "a",
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(onExit).not.toHaveBeenCalled();
  });
});

function ApproveHarness(props: {
  onApprove?: () => void;
  onDeny?: () => void;
  onExit: () => void;
}) {
  useTriageShortcuts(props);
  return <input aria-label="reason" />;
}
