// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { MobileTabBar } from "../MobileTabBar";

vi.mock("../../hooks/useRemoteBasePath", () => ({
  useRemoteBasePath: () => "/remote/host",
}));
vi.mock("../../lib/clientSummaryStore", () => ({
  useInboxCounts: () => ({ needsAttention: 0 }),
}));

function activeTab(entry: string) {
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={[entry]}>
        <MobileTabBar />
      </MemoryRouter>
    </I18nProvider>,
  );
  return document
    .querySelector('[aria-current="page"]')
    ?.getAttribute("data-tab");
}

describe("MobileTabBar active tab", () => {
  afterEach(cleanup);

  it.each([
    ["/remote/host/projects/p1/sessions/s1", "sessions"],
    ["/remote/host/git-status?projectId=p1&from=session", "sessions"],
    ["/remote/host/git-status?projectId=p1", "more"],
    ["/remote/host/sessions?project=p1", "sessions"],
    ["/remote/host/projects", "projects"],
    ["/remote/host/projects/p1", "projects"],
    ["/remote/host/triage", "sessions"],
  ])("%s selects %s", (entry, tab) => {
    expect(activeTab(entry)).toBe(tab);
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });
});
