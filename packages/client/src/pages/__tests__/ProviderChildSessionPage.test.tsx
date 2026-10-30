// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAgentSession, getSessionMetadata } = vi.hoisted(() => ({
  getAgentSession: vi.fn(),
  getSessionMetadata: vi.fn(),
}));

vi.mock("../../api/client", () => ({
  api: { getAgentSession, getSessionMetadata },
}));

vi.mock("../../hooks/useProcesses", () => ({
  useProcesses: () => ({ processes: [], terminatedProcesses: [] }),
}));

vi.mock("../../components/renderers/tools/TaskNestedContent", () => ({
  TaskNestedContent: ({ messages }: { messages: Array<{ id?: string }> }) => (
    <div>child messages {messages.length}</div>
  ),
}));

vi.mock("../../hooks/useRemoteBasePath", () => ({
  useRemoteBasePath: () => "",
}));

import { I18nProvider } from "../../i18n";
import { ProviderChildSessionPage } from "../ProviderChildSessionPage";

describe("ProviderChildSessionPage", () => {
  beforeEach(() => {
    getAgentSession.mockReset();
    getSessionMetadata.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("loads the existing agent transcript as a read-only page", async () => {
    getAgentSession.mockResolvedValue({
      messages: [{ id: "m1", type: "assistant", content: "done" }],
      status: "completed",
      agentType: "Explore",
      description: "Search the repo",
    });
    getSessionMetadata.mockResolvedValue({
      session: {
        title: "Fix the draft restore",
        providerChildren: [
          {
            id: "child-1",
            parentSessionId: "sess-1",
            agentType: "Explore",
            updatedAt: "2026-01-01T00:00:00Z",
          },
          {
            id: "child-2",
            parentSessionId: "sess-1",
            agentType: "reviewer",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        ],
      },
    });

    render(
      <I18nProvider>
        <MemoryRouter
          initialEntries={["/projects/proj-1/sessions/sess-1/agents/child-1"]}
        >
          <Routes>
            <Route
              path="/projects/:projectId/sessions/:sessionId/agents/:agentId"
              element={<ProviderChildSessionPage />}
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Search the repo")).toBeTruthy();
    });
    expect(getAgentSession).toHaveBeenCalledWith("proj-1", "sess-1", "child-1");
    expect(screen.getByText("child messages 1")).toBeTruthy();
    expect(
      screen.getByText("Read-only. This subagent has no input channel."),
    ).toBeTruthy();
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Search the repo",
    });
    const header = heading.closest("header") as HTMLElement;
    const parentLink = within(header).getByRole("link", {
      name: "Back to parent session",
    });
    expect(parentLink).toHaveProperty(
      "href",
      expect.stringContaining("/projects/proj-1/sessions/sess-1"),
    );
    expect(heading.closest("header")).not.toBeNull();
    expect(parentLink.closest("header")).toBe(heading.closest("header"));
    expect(screen.queryByRole("textbox")).toBeNull();

    // Parent context comes from one metadata read: breadcrumb and siblings.
    expect(getSessionMetadata).toHaveBeenCalledWith("proj-1", "sess-1");
    await waitFor(() => {
      expect(
        within(header).getByRole("link", { name: "Fix the draft restore" }),
      ).toBeTruthy();
    });
    // Siblings are links: arrows move focus without opening another child.
    const siblings = screen.getByRole("navigation", {
      name: "Subagents of the same parent session",
    });
    expect(
      within(siblings)
        .getByRole("link", { name: "Explore" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(siblings).getByRole("link", { name: "reviewer" }),
    ).toHaveProperty(
      "href",
      expect.stringContaining(
        "/projects/proj-1/sessions/sess-1/agents/child-2",
      ),
    );
    // The composer is replaced by a read-only notice that leads back.
    expect(
      screen.getByText(
        "Subagent sessions are read-only. Go back to the parent session to continue.",
      ),
    ).toBeTruthy();
  });
});
