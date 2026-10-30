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
