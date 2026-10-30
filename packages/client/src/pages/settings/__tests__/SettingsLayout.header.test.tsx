// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
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
  ],
}));
vi.mock("../AppearanceSettings", () => ({
  AppearanceSettings: () => <p>appearance pane</p>,
}));

const PHONE_WIDTH = 375;

afterEach(cleanup);

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

it("titles the phone settings home Settings", () => {
  const width = window.innerWidth;
  window.innerWidth = PHONE_WIDTH;
  renderAt("/settings");
  window.innerWidth = width;
  const titles = screen.getAllByRole("heading", { level: 1 });
  expect(titles.map((title) => title.textContent)).toEqual([
    "pageTitleSettings",
  ]);
});

const DESKTOP_WIDTH = 1200;

it("opens the overview at the desktop index instead of the first category", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientWidth",
  );
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => DESKTOP_WIDTH,
  });
  try {
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
  } finally {
    if (descriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", descriptor);
    }
  }
});
