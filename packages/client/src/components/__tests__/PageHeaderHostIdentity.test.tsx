// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { HOST_IDENTITY_CAPABILITY } from "@vibeallday/shared";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HostIdentityProvider } from "../../contexts/HostIdentityContext";
import { PageHeader } from "../PageHeader";

const { settingsState, versionState } = vi.hoisted(() => ({
  settingsState: {
    hostIdentity: { icon: "💻" } as { icon: string } | undefined,
  },
  versionState: {
    capabilities: ["host-identity"] as string[],
  },
}));

vi.mock("../../hooks/useServerSettings", () => ({
  useServerSettings: () => ({ settings: settingsState }),
}));

vi.mock("../../hooks/useRemoteBasePath", () => ({
  useRemoteBasePath: () => "/remote/test",
}));

vi.mock("../../hooks/useActivityBusState", () => ({
  useActivityBusState: () => ({ connectionState: "reconnecting" }),
}));

vi.mock("../../contexts/RemoteConnectionContext", () => ({
  useOptionalRemoteConnection: () => null,
}));

vi.mock("../../hooks/useVersion", () => ({
  useVersion: () => ({ version: versionState }),
}));

vi.mock("../../i18n", () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values ? `${key}:${Object.values(values).join(",")}` : key,
  }),
}));

function inRouter(children: ReactNode) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("PageHeader host identity", () => {
  afterEach(() => {
    cleanup();
    settingsState.hostIdentity = { icon: "💻" };
    versionState.capabilities = [HOST_IDENTITY_CAPABILITY];
  });

  it("places a supported host marker between the sidebar control and title", () => {
    const view = render(
      inRouter(
        <HostIdentityProvider>
          <PageHeader title="Sessions" onOpenSidebar={vi.fn()} />
        </HostIdentityProvider>,
      ),
    );

    const left = view.container.querySelector(".session-header-left");
    expect(left?.children[0]?.classList.contains("sidebar-toggle")).toBe(true);
    expect(left?.children[1]?.classList.contains("host-identity-marker")).toBe(
      true,
    );
    expect(left?.children[2]?.textContent).toBe("Sessions");
    expect(view.getByLabelText("hostIdentityMarkerAria:💻")).toBeTruthy();
  });

  it("renders no marker when the server capability is absent", () => {
    versionState.capabilities = [];

    const view = render(
      inRouter(
        <HostIdentityProvider>
          <PageHeader title="Sessions" onOpenSidebar={vi.fn()} />
        </HostIdentityProvider>,
      ),
    );

    expect(view.container.querySelector(".host-identity-marker")).toBeNull();
  });

  it("names the host and its connection state on the phone host chip", () => {
    const view = render(
      inRouter(
        <HostIdentityProvider>
          <PageHeader title="Sessions" />
        </HostIdentityProvider>,
      ),
    );

    const chip = view.getByRole("link", {
      name: "shellHostChipAria:sidebarHostLocal,shellHostReconnecting",
    });
    expect(chip.getAttribute("href")).toBe("/remote/test/more");
    expect(chip.querySelector('[data-status="run"]')).not.toBeNull();
    expect(
      view.container.querySelector(".session-header-actions")?.firstChild,
    ).toBe(chip);
  });

  it("leaves the chip out where the page presents the host itself", () => {
    const view = render(inRouter(<PageHeader title="More" hostChip={false} />));

    expect(view.container.querySelector("[data-host-chip]")).toBeNull();
  });

  it("exposes the expanded new-session target on the sidebar opener", () => {
    const openSidebar = vi.fn();
    const view = render(
      inRouter(
        <HostIdentityProvider>
          <PageHeader title="Sessions" onOpenSidebar={openSidebar} />
        </HostIdentityProvider>,
      ),
    );

    const opener = view.getByRole("button", { name: "actionOpenSidebar" });
    expect(opener.getAttribute("href")).toBe(
      "/remote/test/new-session?sidebar=expanded",
    );
    expect(opener.getAttribute("target")).toBe("_blank");
    expect(opener.getAttribute("title")).toBe(
      "actionOpenSidebar / [Shift] sidebarNewSession",
    );
  });
});
