import { cleanup, render as renderRaw } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider } from "../../i18n";
import { ActiveCountBadge, SessionStatusBadge } from "../StatusBadge";

const render = (ui: ReactElement) => renderRaw(ui, { wrapper: I18nProvider });

describe("SessionStatusBadge", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows Thinking badge when activity is in-turn", () => {
    const { container } = render(
      <SessionStatusBadge
        status={{
          owner: "self",
          processId: "p1",
          permissionMode: "default",
          modeVersion: 0,
        }}
        activity="in-turn"
      />,
    );

    const badge = container.querySelector("span");
    expect(badge?.textContent).toBe("Thinking");
    expect(badge?.firstElementChild).not.toBeNull();
  });

  it("shows nothing when owned but not in-turn", () => {
    const { container } = render(
      <SessionStatusBadge
        status={{
          owner: "self",
          processId: "p1",
          permissionMode: "default",
          modeVersion: 0,
        }}
      />,
    );

    // No indicator for owned sessions - "Thinking" badge shows when actually in-turn
    expect(container.querySelector(".status-badge")).toBeNull();
    expect(container.querySelector(".status-indicator")).toBeNull();
  });

  it("shows nothing when unowned", () => {
    const { container } = render(
      <SessionStatusBadge status={{ owner: "none" }} />,
    );

    expect(container.querySelector(".status-badge")).toBeNull();
    expect(container.querySelector(".status-indicator")).toBeNull();
  });

  it("prioritizes needs-input over in-turn", () => {
    const { container } = render(
      <SessionStatusBadge
        status={{
          owner: "self",
          processId: "p1",
          permissionMode: "default",
          modeVersion: 0,
        }}
        activity="in-turn"
        pendingInputType="tool-approval"
      />,
    );

    const badge = container.querySelector(
      ".status-badge.notification-needs-input",
    );
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe("Approval needed");

    expect(container.textContent).not.toContain("Thinking");
  });

  it("shows Thinking badge even when hasUnread is true", () => {
    const { container } = render(
      <SessionStatusBadge
        status={{
          owner: "self",
          processId: "p1",
          permissionMode: "default",
          modeVersion: 0,
        }}
        activity="in-turn"
        hasUnread={true}
      />,
    );

    const badge = container.querySelector("span");
    expect(badge?.textContent).toBe("Thinking");
    expect(badge?.firstElementChild).not.toBeNull();
  });

  it("shows nothing for unowned sessions (unread handled via CSS class)", () => {
    const { container } = render(
      <SessionStatusBadge status={{ owner: "none" }} hasUnread={true} />,
    );

    // No badge - unread is now handled via CSS class on parent element
    expect(container.querySelector(".status-badge")).toBeNull();
    expect(container.querySelector(".status-indicator")).toBeNull();
  });

  it("shows nothing for owned sessions with unread (unread handled via CSS class)", () => {
    const { container } = render(
      <SessionStatusBadge
        status={{
          owner: "self",
          processId: "p1",
          permissionMode: "default",
          modeVersion: 0,
        }}
        hasUnread={true}
      />,
    );

    // No badge or indicator - unread is handled via CSS class on parent
    expect(container.querySelector(".status-badge")).toBeNull();
    expect(container.querySelector(".status-indicator")).toBeNull();
  });

  it("maps self count badges to the existing owned CSS class", () => {
    const { container } = render(<ActiveCountBadge variant="self" count={2} />);

    const badge = container.querySelector(".status-badge");
    expect(badge?.classList.contains("status-owned")).toBe(true);
    expect(badge?.textContent).toBe("2 Active");
  });
});
