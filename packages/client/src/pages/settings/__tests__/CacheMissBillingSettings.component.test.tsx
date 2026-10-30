// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  CACHE_MISS_BILLING_EXPECTED_EXPIRY_CAPABILITY,
  CACHE_MISS_BILLING_IGNORE_AFTER_CAPABILITY,
} from "@vibeallday/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerSettings } from "../../../api/client";
import { CacheMissBillingSettings } from "../CacheMissBillingSettings";

const { state } = vi.hoisted(() => ({
  state: {
    capabilities: [] as string[],
    settings: {
      serviceWorkerEnabled: true,
      persistRemoteSessionsToDisk: false,
      cacheMissBilling: {
        enabled: true,
        recentActivityMinutes: 10,
        ignoreAfterMinutes: 30,
      },
    } as ServerSettings,
  },
}));

vi.mock("../../../api/client", () => ({
  api: {
    getCacheMissBillingEvents: vi.fn(() => new Promise(() => {})),
  },
}));

vi.mock("../../../hooks/useRelativeNow", () => ({
  useRelativeNow: () => Date.parse("2026-08-21T12:00:00.000Z"),
}));

vi.mock("../../../hooks/useRemoteBasePath", () => ({
  useRemoteBasePath: () => "",
}));

vi.mock("../../../hooks/useServerSettings", () => ({
  useServerSettings: () => ({
    settings: state.settings,
    isLoading: false,
    error: null,
    updateSettings: vi.fn(async () => {}),
  }),
}));

vi.mock("../../../hooks/useVersion", () => ({
  useVersion: () => ({ version: { capabilities: state.capabilities } }),
}));

vi.mock("../../../i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("../../../lib/activityBus", () => ({
  activityBus: { on: () => () => {} },
}));

vi.mock("../SettingsPaneTitleContext", () => ({
  useSettingsPaneTitle: vi.fn(),
}));

vi.mock("../SettingsUndoContext", () => ({
  useSettingsUndoBaseline: vi.fn(),
}));

function renderSettingsTab() {
  render(<CacheMissBillingSettings />);
  fireEvent.click(
    screen.getByRole("tab", { name: "settingsCacheTabSettings" }),
  );
}

describe("CacheMissBillingSettings capability gate", () => {
  beforeEach(() => {
    state.capabilities = [];
  });

  afterEach(cleanup);

  it("shows only the legacy recent-activity control to older servers", () => {
    renderSettingsTab();

    expect(
      screen.getByRole("spinbutton", {
        name: "cacheMissBillingRecentActivityTitle",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("spinbutton", {
        name: "cacheMissBillingIgnoreAfterTitle",
      }),
    ).toBeNull();
  });

  it("shows the additive ignore-after control to capable servers", () => {
    state.capabilities = [CACHE_MISS_BILLING_IGNORE_AFTER_CAPABILITY];
    renderSettingsTab();

    expect(
      screen.getByRole("spinbutton", {
        name: "cacheMissBillingIgnoreAfterTitle",
      }),
    ).toBeTruthy();
  });

  it("shows the expected-expiry evidence toggle only to capable servers", () => {
    state.capabilities = [CACHE_MISS_BILLING_EXPECTED_EXPIRY_CAPABILITY];
    render(<CacheMissBillingSettings />);

    expect(
      screen.getByRole("checkbox", {
        name: "cacheMissExpectedExpiryToggleTitle",
      }),
    ).toBeTruthy();
  });

  it("opens on analysis and keeps thresholds behind the settings tab", () => {
    render(<CacheMissBillingSettings />);

    expect(
      screen
        .getByRole("tab", { name: "settingsCacheTabAnalysis" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen.queryByRole("checkbox", { name: "cacheMissBillingEnableTitle" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "settingsCacheAdjustThresholds" }),
    );
    expect(
      screen.getByRole("checkbox", { name: "cacheMissBillingEnableTitle" }),
    ).toBeTruthy();
  });
});
