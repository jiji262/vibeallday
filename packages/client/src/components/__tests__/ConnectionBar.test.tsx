// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../../i18n";
import { ConnectionBar } from "../ConnectionBar";

const state = vi.hoisted(() => ({
  connectionState: "connected" as "connected" | "reconnecting" | "disconnected",
  showConnectionBars: true,
  reconnectAttempts: 0,
  reconnect: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../contexts/SourceRuntimeContext", () => ({
  useCurrentSourceRuntime: () => ({
    transport: {
      status: {
        getSnapshot: () => ({
          kind: "secure",
          state: "reconnecting",
          channels: [
            {
              name: "relay",
              state: "reconnecting",
              reconnectAttempts: state.reconnectAttempts,
            },
          ],
        }),
        subscribe: () => () => {},
      },
      reconnect: state.reconnect,
    },
  }),
}));

vi.mock("../../hooks/useActivityBusState", () => ({
  useActivityBusState: () => ({ connectionState: state.connectionState }),
}));

vi.mock("../../hooks/useDeveloperMode", () => ({
  useDeveloperMode: () => ({ showConnectionBars: state.showConnectionBars }),
}));

beforeEach(() => {
  state.connectionState = "connected";
  state.showConnectionBars = true;
  state.reconnectAttempts = 0;
  state.reconnect.mockClear();
});

afterEach(() => {
  cleanup();
});

function renderConnectionBar(path = "/", hostName?: string) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[path]}>
        <ConnectionBar hostName={hostName} />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("ConnectionBar", () => {
  it("does not render a full-width success rule for a healthy connection", () => {
    const { container } = renderConnectionBar();

    expect(container.querySelector("[data-connection-status]")).toBeNull();
  });

  it.each(["reconnecting", "disconnected"] as const)(
    "renders the %s exceptional state",
    (connectionState) => {
      state.connectionState = connectionState;

      const { container } = renderConnectionBar();

      const renderedStatus =
        connectionState === "reconnecting" ? "connecting" : connectionState;
      expect(
        container.querySelector(`[data-connection-status="${renderedStatus}"]`),
      ).not.toBeNull();
    },
  );

  it("stays hidden on login routes", () => {
    state.connectionState = "disconnected";

    const { container } = renderConnectionBar("/login");

    expect(container.querySelector("[data-connection-status]")).toBeNull();
  });

  it("shows a network failure with developer diagnostics disabled", () => {
    state.showConnectionBars = false;
    state.connectionState = "disconnected";
    expect(
      renderConnectionBar().container.querySelector(
        '[data-connection-status="disconnected"]',
      ),
    ).not.toBeNull();
  });

  it("names the host and the client's attempt, and retries on demand", () => {
    state.connectionState = "reconnecting";
    state.reconnectAttempts = 3;

    renderConnectionBar("/inbox", "my-mac");

    expect(screen.getByRole("status").textContent).toContain(
      "Reconnecting to my-mac… attempt 3",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry now" }));
    expect(state.reconnect).toHaveBeenCalledTimes(1);
  });
});
