// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { MorePage } from "../MorePage";

const state = vi.hoisted(() => ({
  principal: { username: null as string | null, switched: false },
  remote: null as null | { switchHost: () => void; disconnect: () => void },
  // Never settles, so the reload that follows a real logout does not run.
  logoutUser: vi.fn(() => new Promise<void>(() => {})),
}));

vi.mock("../../api/client", () => ({
  api: { logoutUser: state.logoutUser },
}));
vi.mock("../../hooks/useActingPrincipal", () => ({
  useActingPrincipal: () => ({ principal: state.principal }),
}));
vi.mock("../../contexts/RemoteConnectionContext", () => ({
  useOptionalRemoteConnection: () => state.remote,
}));
vi.mock("../../hooks/useVersion", () => ({
  useVersion: () => ({ version: null }),
}));
vi.mock("../../hooks/useServerSettings", () => ({
  useServerSettings: () => ({ settings: null }),
}));
vi.mock("../../hooks/useIssuesEnabled", () => ({
  useIssuesEnabled: () => true,
}));
vi.mock("../../hooks/useGlobalActiveAgents", () => ({
  useGlobalActiveAgents: () => 0,
}));
vi.mock("../../hooks/useActivityBusState", () => ({
  useActivityBusState: () => ({ connectionState: "connected" }),
}));
vi.mock("../../hooks/useRemoteBasePath", () => ({
  useRemoteBasePath: () => "",
}));
vi.mock("../../components/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("../../layouts", () => ({
  MainContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  useNavigationLayout: () => ({ openSidebar: () => {}, isWideScreen: false }),
}));

function renderMore() {
  render(
    <I18nProvider>
      <MemoryRouter>
        <MorePage />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("MorePage", () => {
  afterEach(() => {
    cleanup();
    state.principal = { username: null, switched: false };
    state.remote = null;
    state.logoutUser.mockClear();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("keeps superuser destinations from a limited user", () => {
    state.principal = { username: "guest", switched: false };
    renderMore();
    expect(screen.queryByText("Processes")).toBeNull();
    expect(screen.queryByText(/Issues/)).toBeNull();
    expect(screen.getByText("Settings")).toBeTruthy();
    expect(screen.queryByText(/Stop acting as/)).toBeNull();
  });

  it("gives a switched superuser the way back without the sidebar", () => {
    state.principal = { username: "guest", switched: true };
    renderMore();
    fireEvent.click(
      screen.getByRole("button", { name: /Stop acting as guest/ }),
    );
    expect(state.logoutUser).toHaveBeenCalledTimes(1);
  });

  it("switches the skin from the appearance row, OLED included", () => {
    renderMore();
    expect(screen.getByText("Connected")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "OLED" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "verydark",
    );
    expect(localStorage.getItem("vibeallday-theme")).toBe("verydark");
  });

  it("offers host switching only on a remote connection", () => {
    const switchHost = vi.fn();
    state.remote = { switchHost, disconnect: vi.fn() };
    renderMore();
    fireEvent.click(screen.getByRole("button", { name: /Switch host/i }));
    expect(switchHost).toHaveBeenCalledTimes(1);
  });
});
