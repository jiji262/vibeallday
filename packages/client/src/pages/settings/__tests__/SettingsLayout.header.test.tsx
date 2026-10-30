// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { UI_KEYS } from "../../../lib/storageKeys";
import { SettingsLayout } from "../SettingsLayout";

vi.mock("../../../hooks/useActingPrincipal", () => ({
  useActingPrincipal: () => ({
    principal: { superuser: true, username: null },
    resolved: true,
    loading: false,
  }),
}));
vi.mock("../../../hooks/useVersion", () => ({
  useVersion: () => ({ version: { capabilities: [] }, loading: false }),
}));
vi.mock("../../../hooks/useRemoteBasePath", () => ({
  useRemoteBasePath: () => "",
}));
vi.mock("../../../layouts", () => ({
  MainContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useNavigationLayout: () => ({ openSidebar: vi.fn(), isWideScreen: true }),
}));
vi.mock("../../../i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("../../../i18n-settings", () => ({
  getThemeLabel: (theme: string) => theme,
  getSettingsCategories: () => [
    { id: "appearance", label: "Appearance", description: "Display prefs" },
    { id: "providers", label: "Providers", description: "Agent CLIs" },
  ],
}));
vi.mock("../../../hooks/useProviders", () => ({
  useProviders: () => ({
    providers: [
      {
        name: "codex",
        displayName: "Codex",
        installed: true,
        authenticated: false,
        enabled: false,
      },
    ],
    loading: false,
  }),
}));
vi.mock("../../../hooks/usePushNotifications", () => ({
  usePushNotifications: () => ({
    isSupported: true,
    isSubscribed: false,
    isLoading: false,
    permission: "default",
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}));
vi.mock("../AppearanceSettings", () => ({
  AppearanceSettings: () => <p>appearance pane</p>,
}));

const PHONE_WIDTH = 375;
const DESKTOP_WIDTH = 1200;

afterEach(() => {
  cleanup();
  localStorage.clear();
});

/** jsdom lays nothing out; give the settings container a desktop width. */
function withDesktopWidth(run: () => Promise<void>): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientWidth",
  );
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => DESKTOP_WIDTH,
  });
  return run().finally(() => {
    // jsdom defines clientWidth on Element.prototype, so usually just drop
    // the override.
    if (descriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", descriptor);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
    }
  });
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/settings" element={<SettingsLayout />} />
        <Route path="/settings/:category" element={<SettingsLayout />} />
      </Routes>
    </MemoryRouter>,
  );
}

it("names a category with crumbs Settings / category and one h1", async () => {
  renderAt("/settings/appearance");
  expect(await screen.findByText("appearance pane")).toBeTruthy();
  const crumbs = screen.getByRole("navigation", { name: "breadcrumbLabel" });
  const root = within(crumbs).getByRole("link", { name: "pageTitleSettings" });
  expect(root.getAttribute("href")).toBe("/settings");
  expect(within(crumbs).getByText("Appearance")).toBeTruthy();
  const titles = screen.getAllByRole("heading", { level: 1 });
  expect(titles.map((title) => title.textContent)).toEqual(["Appearance"]);
  expect(screen.getByText("Display prefs")).toBeTruthy();
});

/** The layout starts from the window width (MainContent is mocked away). */
function renderOnPhone(path: string) {
  const width = window.innerWidth;
  window.innerWidth = PHONE_WIDTH;
  renderAt(path);
  window.innerWidth = width;
}

it("titles the phone settings home Settings", () => {
  renderOnPhone("/settings");
  const titles = screen.getAllByRole("heading", { level: 1 });
  expect(titles.map((title) => title.textContent)).toEqual([
    "pageTitleSettings",
  ]);
});

it("opens the overview at the desktop index instead of the first category", () =>
  withDesktopWidth(async () => {
    renderAt("/settings");
    expect(await screen.findByText("settingsQuickTitle")).toBeTruthy();
    expect(screen.queryByText("appearance pane")).toBeNull();
    const crumbs = screen.getByRole("navigation", { name: "breadcrumbLabel" });
    expect(within(crumbs).getByText("settingsOverviewTitle")).toBeTruthy();
    const rail = screen.getByRole("complementary", {
      name: "pageTitleSettings",
    });
    const back = within(rail).getByRole("link", { name: "shellNavBackToApp" });
    expect(back.getAttribute("href")).toBe("/inbox");
  }));

it("answers an unknown category URL with the settings index", async () => {
  renderOnPhone("/settings/not-a-category");
  expect(await screen.findByText("settingsQuickTitle")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "actionBack" })).toBeNull();
  cleanup();

  await withDesktopWidth(async () => {
    renderAt("/settings/not-a-category");
    const overview = await screen.findByRole("button", {
      name: "settingsOverviewTitle",
    });
    expect(overview.getAttribute("aria-current")).toBe("page");
  });
});

it("flags a provider waiting on sign-in in the rail", () =>
  withDesktopWidth(async () => {
    renderAt("/settings/appearance");
    const rail = screen.getByRole("complementary", {
      name: "pageTitleSettings",
    });
    const row = within(rail).getByRole("button", { name: /^Providers/ });
    expect(
      within(row).getByRole("img", { name: "settingsRailNeedsAttention" }),
    ).toBeTruthy();
  }));

it("names the notifications switch by its title alone", async () => {
  renderOnPhone("/settings");
  expect(
    await screen.findByRole("switch", {
      name: "settingsQuickPushNotifications",
    }),
  ).toBeTruthy();
});

it("selects a saved text size that is not a preset", async () => {
  localStorage.setItem(UI_KEYS.fontSize, "105");
  renderAt("/settings");
  const sizes = await screen.findByRole("radiogroup", {
    name: "settingsQuickTextSize",
  });
  const checked = within(sizes).getAllByRole("radio", { checked: true });
  expect(checked.map((radio) => radio.textContent)).toEqual(["105"]);
});
