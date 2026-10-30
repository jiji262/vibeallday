// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  CLAUDE_ADDITIONAL_MODELS_CAPABILITY,
  CLAUDE_GATEWAY_AUTOSTART_CAPABILITY,
  CLAUDE_GATEWAY_CAPABILITY,
  CLAUDE_GATEWAY_DISABLE_AGENT_CAPABILITY,
  CLAUDE_GATEWAY_SERVICES_CAPABILITY,
  CLAUDE_GATEWAY_DISABLE_PLAN_MODE_CAPABILITY,
  CODEX_CYBER_ACCESS_PROGRAM_SETTING_CAPABILITY,
  CODEX_PLAN_TOOL_SETTING_CAPABILITY,
  CODEX_REASONING_SUMMARY_SETTING_CAPABILITY,
  IDLE_REAP_HOURS_SETTING_CAPABILITY,
  RELOAD_SAFE_CODEX_RUNTIME_CAPABILITY,
  RELOAD_SAFE_CODEX_RUNTIME_SETTINGS_CAPABILITY,
  SUBAGENT_MAX_DEPTH_SETTING_CAPABILITY,
  type ProviderInfo,
} from "@vibeallday/shared";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerSettings } from "../../../api/client";
import { getAllProviders } from "../../../providers/registry";
import { AgentBehaviorSettings } from "../AgentBehaviorSettings";
import { ProvidersSettings } from "../ProvidersSettings";
import { SettingsJumpTargetProvider } from "../SettingsSearchContext";

const {
  hookState,
  mockReloadProviders,
  mockUpdateSetting,
  mockUpdateSettings,
  versionState,
} = vi.hoisted(() => ({
  hookState: {
    settings: {
      serviceWorkerEnabled: true,
      persistRemoteSessionsToDisk: false,
      claudeAdditionalModels: [],
    } as ServerSettings,
    providers: [
      {
        name: "claude",
        displayName: "Claude",
        installed: true,
        authenticated: true,
        enabled: true,
        supportsLaunchCompactPercentOverride: true,
        models: [{ id: "opus", name: "Opus" }],
        additionalModelOptions: [
          {
            id: "claude-opus-4-8",
            name: "Opus 4.8",
            description: "Previous Opus generation",
            catalogGroup: "additional",
          },
        ],
      },
    ] as ProviderInfo[],
  },
  mockReloadProviders: vi.fn(),
  mockUpdateSetting: vi.fn(),
  mockUpdateSettings: vi.fn(),
  versionState: {
    capabilities: [] as string[],
    pending: false,
  },
}));

vi.mock("../../../contexts/ToastContext", () => ({
  useToastContext: () => ({ showToast: vi.fn() }),
}));

vi.mock("../../../hooks/useProviders", () => ({
  useProviders: () => ({
    providers: hookState.providers,
    loading: false,
    error: null,
    refetch: mockReloadProviders,
    reload: mockReloadProviders,
  }),
}));

vi.mock("../../../hooks/useServerSettings", () => ({
  useServerSettings: () => ({
    settings: hookState.settings,
    isLoading: false,
    error: null,
    updateSetting: mockUpdateSetting,
    updateSettings: mockUpdateSettings,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../../hooks/useVersion", () => ({
  useVersion: () =>
    versionState.pending
      ? { version: null, loading: true }
      : { version: { capabilities: versionState.capabilities } },
}));

vi.mock("../../../i18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params?.count ? `${key}:${params.count}` : key,
  }),
}));

/** Providers at one route, the way Settings mounts the pane. */
function ProvidersAt({ path }: { path: string }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/settings/:category" element={<ProvidersSettings />} />
        <Route
          path="/settings/:category/:itemId"
          element={<ProvidersSettings />}
        />
      </Routes>
    </MemoryRouter>
  );
}

/**
 * Every page that holds a provider row: Agent behavior plus each provider's
 * detail page, so a row is found wherever the redesign placed it.
 */
function AllProviderPages() {
  return (
    <>
      <MemoryRouter>
        <AgentBehaviorSettings />
      </MemoryRouter>
      {getAllProviders().map((provider) => (
        <ProvidersAt
          key={provider.id}
          path={`/settings/providers/${provider.id}`}
        />
      ))}
    </>
  );
}

describe("ProvidersSettings additional models", () => {
  beforeEach(() => {
    window.localStorage.clear();
    hookState.settings = {
      serviceWorkerEnabled: true,
      persistRemoteSessionsToDisk: false,
      claudeAdditionalModels: [],
    };
    hookState.providers = [
      {
        name: "claude",
        displayName: "Claude",
        installed: true,
        authenticated: true,
        enabled: true,
        supportsLaunchCompactPercentOverride: true,
        models: [{ id: "opus", name: "Opus" }],
        additionalModelOptions: [
          {
            id: "claude-opus-4-8",
            name: "Opus 4.8",
            description: "Previous Opus generation",
            catalogGroup: "additional",
          },
        ],
      },
    ];
    versionState.capabilities = [CLAUDE_ADDITIONAL_MODELS_CAPABILITY];
    versionState.pending = false;
    mockUpdateSetting.mockResolvedValue(undefined);
    mockUpdateSettings.mockImplementation(
      async (updates: Partial<ServerSettings>) => ({
        ...hookState.settings,
        ...updates,
      }),
    );
    mockReloadProviders.mockResolvedValue(undefined);
  });

  it("gates instruction restoration on the settings field and saves independent provider choices", async () => {
    const view = render(<AllProviderPages />);
    expect(screen.queryByText("instructionRestorationTitle")).toBeNull();
    hookState.settings.instructionRestoration = {
      providers: {},
      pathPrefix: "",
      pattern: "*.md",
      delayTurns: 2,
    };
    view.rerender(<AllProviderPages />);
    const control = document.querySelector(
      '[data-settings-item="providers-instruction-restoration"]',
    ) as HTMLElement;
    fireEvent.change(
      within(control).getByLabelText("instructionRestorationPrefix"),
      { target: { value: "~/agents/topics/" } },
    );
    fireEvent.click(within(control).getByLabelText("Claude"));
    fireEvent.click(within(control).getByText("instructionRestorationSave"));
    await waitFor(() =>
      expect(mockUpdateSetting).toHaveBeenCalledWith("instructionRestoration", {
        providers: { claude: true },
        pathPrefix: "~/agents/topics/",
        pattern: "*.md",
        delayTurns: 2,
      }),
    );
  });

  it("presents desktop app, runtime, and authentication as separate signals", () => {
    hookState.providers = [
      {
        name: "claude",
        displayName: "Claude",
        installed: true,
        applicationDetected: true,
        authenticated: false,
        enabled: false,
        loginCommand:
          "'/Applications/VibeAllDay.app/claude' auth login --claudeai",
        models: [{ id: "default", name: "Default" }],
      },
    ];

    render(<AllProviderPages />);

    const claudeItem = document.querySelector(
      '[data-settings-item="provider-claude"]',
    );
    if (!(claudeItem instanceof HTMLElement)) {
      throw new Error("expected Claude provider settings item");
    }
    const item = within(claudeItem);

    expect(item.getByText("providersRuntimeReady")).toBeDefined();
    expect(item.getByText("providersDesktopApplicationStatus")).toBeDefined();
    expect(item.getByText("providersAuthenticationStatus")).toBeDefined();
    expect(item.getByText("providersLoginHint")).toBeDefined();
    expect(
      item.getByText(
        "'/Applications/VibeAllDay.app/claude' auth login --claudeai",
      ),
    ).toBeDefined();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("hides the setting when the connected server lacks the capability", () => {
    versionState.capabilities = [];

    render(<AllProviderPages />);

    expect(screen.queryByText("providersAdditionalModelsTitle")).toBeNull();
  });

  it("hides idle harness lifetime from older servers", () => {
    render(<AllProviderPages />);

    expect(screen.queryByText("providersIdleReapHoursLabel")).toBeNull();
    expect(screen.queryByText("providersSubagentMaxDepthLabel")).toBeNull();
  });

  it("hides Codex reasoning summaries from older servers", () => {
    render(<AllProviderPages />);

    expect(
      screen.queryByText("providersCodexReasoningSummaryTitle"),
    ).toBeNull();
    expect(mockUpdateSetting).not.toHaveBeenCalled();
  });

  it("shows the default Codex reasoning-summary mode and saves exact values", async () => {
    versionState.capabilities = [CODEX_REASONING_SUMMARY_SETTING_CAPABILITY];
    render(<AllProviderPages />);
    const select = screen.getByLabelText(
      "providersCodexReasoningSummaryAria",
    ) as HTMLSelectElement;

    expect(select.value).toBe("auto");
    fireEvent.change(select, { target: { value: "detailed" } });

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith(
        "codexReasoningSummary",
        "detailed",
      );
    });
  });

  it("reflects a saved Codex reasoning-summary mode", () => {
    hookState.settings = {
      ...hookState.settings,
      codexReasoningSummary: "concise",
    };
    versionState.capabilities = [CODEX_REASONING_SUMMARY_SETTING_CAPABILITY];

    render(<AllProviderPages />);

    expect(
      (
        screen.getByLabelText(
          "providersCodexReasoningSummaryAria",
        ) as HTMLSelectElement
      ).value,
    ).toBe("concise");
  });

  it("hides the Codex plan-tool setting from older servers", () => {
    render(<AllProviderPages />);

    expect(screen.queryByText("providersCodexPlanToolTitle")).toBeNull();
  });

  it("inherits the Codex plan-tool fallback and saves exact overrides", async () => {
    versionState.capabilities = [CODEX_PLAN_TOOL_SETTING_CAPABILITY];
    render(<AllProviderPages />);
    const select = screen.getByLabelText(
      "providersCodexPlanToolAria",
    ) as HTMLSelectElement;

    expect(select.value).toBe("inherit");

    for (const mode of ["enabled", "disabled", "provider-default"] as const) {
      fireEvent.change(select, { target: { value: mode } });
      await waitFor(() => {
        expect(mockUpdateSetting).toHaveBeenLastCalledWith(
          "codexPlanToolMode",
          mode,
        );
      });
    }

    fireEvent.change(select, { target: { value: "inherit" } });
    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenLastCalledWith(
        "codexPlanToolMode",
        null,
      );
    });
  });

  it("hides the Codex cyber access setting from older servers", () => {
    render(<AllProviderPages />);

    expect(screen.queryByText("providersCodexCyberAccessTitle")).toBeNull();
  });

  it("inherits the Codex cyber access fallback and saves exact overrides", async () => {
    versionState.capabilities = [CODEX_CYBER_ACCESS_PROGRAM_SETTING_CAPABILITY];
    render(<AllProviderPages />);
    const select = screen.getByLabelText(
      "providersCodexCyberAccessAria",
    ) as HTMLSelectElement;

    expect(select.value).toBe("inherit");

    for (const program of [
      "standard",
      "daybreak-blue",
      "daybreak-red",
      "provider-default",
    ] as const) {
      fireEvent.change(select, { target: { value: program } });
      await waitFor(() => {
        expect(mockUpdateSetting).toHaveBeenLastCalledWith(
          "codexCyberAccessProgram",
          program,
        );
      });
    }

    fireEvent.change(select, { target: { value: "inherit" } });
    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenLastCalledWith(
        "codexCyberAccessProgram",
        null,
      );
    });
  });

  it("shows the Never notch as -1", () => {
    hookState.settings = {
      ...hookState.settings,
      idleReapHours: -1,
    };
    versionState.capabilities = [IDLE_REAP_HOURS_SETTING_CAPABILITY];

    render(<AllProviderPages />);

    expect(screen.getByText("providersIdleReapHoursLabel")).toBeTruthy();
    expect(screen.getByText("providersIdleReapNeverHint")).toBeTruthy();
    expect(
      document.querySelector<HTMLInputElement>(
        "#providers-idle-reap-hours-control-number",
      )?.value,
    ).toBe("-1");
  });

  it("saves fractional idle harness hours from the number field", async () => {
    hookState.settings = {
      ...hookState.settings,
      idleReapHours: 24,
    };
    versionState.capabilities = [IDLE_REAP_HOURS_SETTING_CAPABILITY];
    render(<AllProviderPages />);
    const numberInput = document.querySelector<HTMLInputElement>(
      "#providers-idle-reap-hours-control-number",
    );
    expect(numberInput).not.toBeNull();

    fireEvent.change(numberInput as HTMLInputElement, {
      target: { value: "2.5" },
    });
    fireEvent.blur(numberInput as HTMLInputElement);

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith("idleReapHours", 2.5);
    });
  });

  it("shows the default subagent limit and provider coverage", () => {
    versionState.capabilities = [SUBAGENT_MAX_DEPTH_SETTING_CAPABILITY];

    render(<AllProviderPages />);

    expect(screen.getByText("providersSubagentMaxDepthLabel")).toBeTruthy();
    expect(screen.getByText("providersSubagentMaxDepthCoverage")).toBeTruthy();
    expect(
      document.querySelector<HTMLInputElement>(
        "#providers-subagent-max-depth-control-number",
      )?.value,
    ).toBe("1");
  });

  it("renders provider-default subagent depth as an empty number", () => {
    hookState.settings = {
      ...hookState.settings,
      subagentMaxDepth: null,
    };
    versionState.capabilities = [SUBAGENT_MAX_DEPTH_SETTING_CAPABILITY];

    render(<AllProviderPages />);

    expect(
      document.querySelector<HTMLInputElement>(
        "#providers-subagent-max-depth-control-number",
      )?.value,
    ).toBe("");
    expect(
      document.querySelector<HTMLInputElement>(
        "#providers-subagent-max-depth-control",
      )?.value,
    ).toBe("-1");
  });

  it("saves blank and zero subagent depth selections", async () => {
    hookState.settings = {
      ...hookState.settings,
      subagentMaxDepth: 2,
    };
    versionState.capabilities = [SUBAGENT_MAX_DEPTH_SETTING_CAPABILITY];
    render(<AllProviderPages />);
    const numberInput = document.querySelector<HTMLInputElement>(
      "#providers-subagent-max-depth-control-number",
    );
    const slider = document.querySelector<HTMLInputElement>(
      "#providers-subagent-max-depth-control",
    );
    expect(numberInput).not.toBeNull();
    expect(slider).not.toBeNull();

    fireEvent.change(numberInput as HTMLInputElement, {
      target: { value: "" },
    });
    fireEvent.blur(numberInput as HTMLInputElement);
    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith("subagentMaxDepth", null);
    });

    mockUpdateSetting.mockClear();
    fireEvent.change(slider as HTMLInputElement, { target: { value: "0" } });
    fireEvent.pointerUp(slider as HTMLInputElement);
    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith("subagentMaxDepth", 0);
    });
  });

  it("lists ready providers on the overview with Codex before Claude", () => {
    hookState.providers = [
      ...hookState.providers,
      {
        name: "codex",
        displayName: "Codex",
        installed: true,
        authenticated: true,
        enabled: true,
        models: [],
      },
    ];
    render(<ProvidersAt path="/settings/providers" />);
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>("[data-provider-card]"),
    );
    expect(cards.map((card) => card.dataset.providerCard)).toEqual([
      "codex",
      "claude",
    ]);
    expect(
      document.querySelector('[data-settings-item^="provider-"]'),
    ).toBeNull();
  });

  it("puts providers waiting on sign-in under Needs you with a sign-in link", () => {
    hookState.providers = [
      {
        name: "codex",
        displayName: "Codex",
        installed: true,
        authenticated: false,
        enabled: false,
        supportsInAppLogin: true,
        models: [],
      },
    ];
    render(<ProvidersAt path="/settings/providers" />);
    const card = document.querySelector<HTMLElement>(
      '[data-provider-card="codex"]',
    );
    expect(card).not.toBeNull();
    expect(
      within(card as HTMLElement)
        .getByRole("link", { name: "providersSignIn" })
        .getAttribute("href"),
    ).toBe("/provider-sign-in/codex");
    expect(screen.getByText("providersOverviewNeedsYou")).toBeDefined();
  });

  it("forwards a search jump for a provider row to that provider's page", async () => {
    const consume = vi.fn();
    // jsdom has no layout; the landed row scrolls itself into view.
    Element.prototype.scrollIntoView = vi.fn();
    versionState.capabilities = [CODEX_REASONING_SUMMARY_SETTING_CAPABILITY];
    hookState.providers = [
      {
        name: "codex",
        displayName: "Codex",
        installed: true,
        authenticated: true,
        enabled: true,
        models: [],
      },
    ];
    render(
      <SettingsJumpTargetProvider
        value={{ target: "provider-codex-reasoning-summary", consume }}
      >
        <ProvidersAt path="/settings/providers" />
      </SettingsJumpTargetProvider>,
    );
    await waitFor(() =>
      expect(
        document.querySelector(
          '[data-settings-item="provider-codex-reasoning-summary"]',
        ),
      ).not.toBeNull(),
    );
    expect(document.querySelector("[data-provider-card]")).toBeNull();
    await waitFor(() => expect(consume).toHaveBeenCalled());
  });

  it("refreshes the model catalog from the Codex provider card", async () => {
    hookState.providers = [
      {
        name: "codex",
        displayName: "Codex",
        installed: true,
        authenticated: true,
        enabled: true,
        models: [{ id: "gpt-6-astra", name: "Astra" }],
      },
    ];
    render(<AllProviderPages />);

    fireEvent.click(
      screen.getByRole("button", { name: "providersModelsRefresh" }),
    );
    await waitFor(() => expect(mockReloadProviders).toHaveBeenCalledTimes(1));
  });

  it("hides legacy reload-safe Codex settings when advertised", () => {
    hookState.providers = [
      {
        name: "codex",
        displayName: "Codex",
        installed: false,
        authenticated: true,
        enabled: true,
        models: [],
      },
    ];
    versionState.capabilities = [
      RELOAD_SAFE_CODEX_RUNTIME_SETTINGS_CAPABILITY,
      RELOAD_SAFE_CODEX_RUNTIME_CAPABILITY,
    ];

    render(<AllProviderPages />);

    expect(screen.queryByText("providersCodexReloadSafeTitle")).toBeNull();
  });

  it("hides the Claude auto-compaction setting from older servers", () => {
    hookState.providers = hookState.providers.map((provider) => ({
      ...provider,
      supportsLaunchCompactPercentOverride: undefined,
    }));

    render(<AllProviderPages />);

    expect(screen.queryByText("providersClaudeAutoCompactTitle")).toBeNull();
  });

  it("saves and clears the global Claude auto-compaction setting", async () => {
    const { unmount } = render(<AllProviderPages />);
    const numberInput = screen
      .getAllByLabelText("providersClaudeAutoCompactTitle")
      .find((element) => element.getAttribute("type") === "number");
    expect(numberInput).toBeDefined();

    fireEvent.change(numberInput!, { target: { value: "60" } });
    fireEvent.blur(numberInput!);

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith(
        "claudeAutoCompactPercentOverride",
        60,
      );
    });

    unmount();
    vi.clearAllMocks();
    mockUpdateSetting.mockResolvedValue(undefined);
    hookState.settings = {
      serviceWorkerEnabled: true,
      persistRemoteSessionsToDisk: false,
      claudeAdditionalModels: [],
      claudeAutoCompactPercentOverride: 60,
    };

    render(<AllProviderPages />);
    const configuredInput = screen
      .getAllByLabelText("providersClaudeAutoCompactTitle")
      .find((element) => element.getAttribute("type") === "number");
    expect(configuredInput).toBeDefined();

    fireEvent.change(configuredInput!, { target: { value: "0" } });
    fireEvent.blur(configuredInput!);

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith(
        "claudeAutoCompactPercentOverride",
        undefined,
      );
    });
  });

  it("shows a compact empty summary and saves maintained opt-ins", async () => {
    render(<AllProviderPages />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /providersAdditionalModelsNone/u,
      }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Opus 4\.8/u }));

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith("claudeAdditionalModels", [
        {
          id: "claude-opus-4-8",
          label: "Opus 4.8",
          origin: "registry",
        },
      ]);
      expect(mockReloadProviders).toHaveBeenCalledTimes(1);
    });
  });

  it("adds a custom exact id from the advanced editor", async () => {
    render(<AllProviderPages />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /providersAdditionalModelsNone/u,
      }),
    );
    fireEvent.click(screen.getByText("providersAdditionalModelsCustomTitle"));
    fireEvent.change(
      screen.getByPlaceholderText("providersAdditionalModelsCustomPlaceholder"),
      { target: { value: "claude-experimental-6" } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "providersAdditionalModelsAdd",
      }),
    );

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith("claudeAdditionalModels", [
        {
          id: "claude-experimental-6",
          label: "claude-experimental-6",
          origin: "custom",
        },
      ]);
    });
  });

  it("keeps a removed registry selection visible for opt-out", () => {
    hookState.settings = {
      serviceWorkerEnabled: true,
      persistRemoteSessionsToDisk: false,
      claudeAdditionalModels: [
        {
          id: "claude-opus-4-5",
          label: "Opus 4.5",
          origin: "registry",
        },
      ],
    };

    render(<AllProviderPages />);
    fireEvent.click(
      screen.getByRole("button", { name: /providersAdditionalModelsOne/u }),
    );

    expect(screen.getByRole("checkbox", { name: /Opus 4\.5/u })).toHaveProperty(
      "checked",
      true,
    );
    expect(
      screen.getByText("providersAdditionalModelsUnlistedDescription"),
    ).toBeTruthy();
  });

  it("answers a capability-gated detail URL by what this server serves", () => {
    versionState.pending = true;
    render(<ProvidersAt path="/settings/providers/gateway-services" />);
    expect(screen.getByText("loading")).toBeTruthy();
    expect(screen.queryByText("providersDetailNotFound")).toBeNull();
    cleanup();

    versionState.pending = false;
    render(<ProvidersAt path="/settings/providers/gateway-services" />);
    expect(screen.getByText("providersDetailNotFound")).toBeTruthy();
  });

  it("hides Claude Gateway configuration from older servers", () => {
    render(<AllProviderPages />);

    expect(screen.queryByText("providersClaudeGatewayTitle")).toBeNull();
  });

  it("saves isolated Claude Gateway configuration and reloads providers", async () => {
    versionState.capabilities = [CLAUDE_GATEWAY_CAPABILITY];
    render(<AllProviderPages />);

    const gatewayCard = document.querySelector<HTMLElement>(
      '[data-settings-item="provider-claude-gateway"]',
    );
    expect(gatewayCard).not.toBeNull();
    expect(
      within(gatewayCard as HTMLElement).getByText(
        "providersClaudeGatewayTitle",
      ),
    ).toBeTruthy();

    fireEvent.change(
      screen.getByRole("textbox", {
        name: "providersClaudeGatewayUrlAria",
      }),
      { target: { value: "http://localhost:4141" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "providersSave" }));

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith(
        "claudeGatewayUrl",
        "http://localhost:4141",
      );
      expect(mockReloadProviders).toHaveBeenCalledTimes(1);
    });
  });

  it("submits Claude Gateway edits through its form", async () => {
    versionState.capabilities = [CLAUDE_GATEWAY_CAPABILITY];
    render(<AllProviderPages />);

    const input = screen.getByRole("textbox", {
      name: "providersClaudeGatewayUrlAria",
    });
    fireEvent.change(input, {
      target: { value: "http://localhost:4242" },
    });
    const form = input.closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith(
        "claudeGatewayUrl",
        "http://localhost:4242",
      );
    });
  });

  it("materializes the Claude Gateway example URL on focus", () => {
    versionState.capabilities = [CLAUDE_GATEWAY_CAPABILITY];
    render(<AllProviderPages />);

    const input = screen.getByRole("textbox", {
      name: "providersClaudeGatewayUrlAria",
    });
    expect(input).toHaveProperty("value", "");

    fireEvent.focus(input);

    expect(input).toHaveProperty("value", "http://localhost:4141");
    expect(mockUpdateSetting).not.toHaveBeenCalled();
  });

  it("edits and saves the services list when the server supports it", async () => {
    versionState.capabilities = [
      CLAUDE_GATEWAY_CAPABILITY,
      CLAUDE_GATEWAY_SERVICES_CAPABILITY,
    ];
    hookState.settings = {
      serviceWorkerEnabled: true,
      persistRemoteSessionsToDisk: false,
      gatewayServices: [
        {
          id: "vllm",
          label: "",
          shortName: "",
          url: "http://127.0.0.1:8001",
          enabled: true,
          autoStop: false,
          autoStopAfterSeconds: 300,
          codexEnabled: false,
          codexWireApi: "responses",
        },
      ],
      defaultGatewayServiceId: "vllm",
    };
    render(<AllProviderPages />);

    // The single-URL form belongs to older servers only.
    expect(
      screen.queryByRole("textbox", {
        name: "providersClaudeGatewayUrlAria",
      }),
    ).toBeNull();

    // There is no Save button here: a typed field writes itself when it loses
    // focus and a checkbox writes itself as it is clicked.
    const contextInput = screen.getByRole("spinbutton", {
      name: "providersGatewayServiceContextAria",
    });
    fireEvent.change(contextInput, { target: { value: "252000" } });
    fireEvent.blur(contextInput);

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        gatewayServices: [
          expect.objectContaining({ id: "vllm", contextWindowTokens: 252000 }),
        ],
        defaultGatewayServiceId: "vllm",
      });
    });

    fireEvent.click(
      screen.getByRole("checkbox", { name: /providersGatewayServiceCodex/u }),
    );

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        gatewayServices: [
          expect.objectContaining({
            id: "vllm",
            contextWindowTokens: 252000,
            codexEnabled: true,
          }),
        ],
        defaultGatewayServiceId: "vllm",
      });
      expect(mockReloadProviders).toHaveBeenCalled();
    });
  });

  it("saves a reordered services list, which is the order pickers show", async () => {
    versionState.capabilities = [
      CLAUDE_GATEWAY_CAPABILITY,
      CLAUDE_GATEWAY_SERVICES_CAPABILITY,
    ];
    const entry = (id: string, url: string) => ({
      id,
      label: "",
      shortName: "",
      url,
      enabled: true,
      autoStop: false,
      autoStopAfterSeconds: 0,
      codexEnabled: true,
      codexWireApi: "responses" as const,
    });
    hookState.settings = {
      serviceWorkerEnabled: true,
      persistRemoteSessionsToDisk: false,
      gatewayServices: [
        entry("copilot", "http://127.0.0.1:4141"),
        entry("vllm", "http://127.0.0.1:8001"),
      ],
      // The default entry is deliberately not the first one: marking a service
      // default says which one is used when nothing names one, and must not be
      // what decides where its models sit in the list.
      defaultGatewayServiceId: "copilot",
    };
    render(<AllProviderPages />);

    const moveUp = screen.getAllByRole("button", {
      name: "providersGatewayServiceMoveUp",
    });
    // Two entries, so the first entry's control is disabled and the second's
    // is the one that can act.
    expect(moveUp[0]).toHaveProperty("disabled", true);
    // Reordering saves itself; there is no Save button to reach for.
    fireEvent.click(moveUp[1]!);

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        gatewayServices: [
          expect.objectContaining({ id: "vllm" }),
          expect.objectContaining({ id: "copilot" }),
        ],
        defaultGatewayServiceId: "copilot",
      });
    });
  });

  it("states the terminal command for each service once export is on", () => {
    versionState.capabilities = [
      CLAUDE_GATEWAY_CAPABILITY,
      CLAUDE_GATEWAY_SERVICES_CAPABILITY,
    ];
    hookState.settings = {
      serviceWorkerEnabled: true,
      persistRemoteSessionsToDisk: false,
      gatewayServiceExportEnabled: true,
      gatewayServiceExportPaths: {
        codexHome: "/home/dev/.codex",
        claudeHome: "/home/dev/.claude",
      },
      gatewayServices: [
        {
          id: "vllm",
          label: "",
          shortName: "",
          url: "http://127.0.0.1:8001",
          enabled: true,
          autoStop: false,
          autoStopAfterSeconds: 300,
          codexEnabled: true,
          codexWireApi: "responses",
        },
      ],
      defaultGatewayServiceId: "vllm",
    };
    render(<AllProviderPages />);

    expect(
      screen.getByText(
        "claude --settings /home/dev/.claude/vibeallday-vllm.settings.json",
      ),
    ).toBeTruthy();
    expect(screen.getByText("codex -p vibeallday-vllm")).toBeTruthy();
  });

  it("hides the terminal commands until the export is enabled", () => {
    versionState.capabilities = [
      CLAUDE_GATEWAY_CAPABILITY,
      CLAUDE_GATEWAY_SERVICES_CAPABILITY,
    ];
    hookState.settings = {
      serviceWorkerEnabled: true,
      persistRemoteSessionsToDisk: false,
      gatewayServiceExportPaths: {
        codexHome: "/home/dev/.codex",
        claudeHome: "/home/dev/.claude",
      },
      gatewayServices: [
        {
          id: "vllm",
          label: "",
          shortName: "",
          url: "http://127.0.0.1:8001",
          enabled: true,
          autoStop: false,
          autoStopAfterSeconds: 300,
          codexEnabled: true,
          codexWireApi: "responses",
        },
      ],
    };
    render(<AllProviderPages />);

    expect(screen.queryByText("codex -p vibeallday-vllm")).toBeNull();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /providersGatewayServiceExportTitle/u,
      }),
    );
    expect(mockUpdateSetting).toHaveBeenCalledWith(
      "gatewayServiceExportEnabled",
      true,
    );
  });

  it("adds a service entry with a slug derived from its endpoint", async () => {
    versionState.capabilities = [
      CLAUDE_GATEWAY_CAPABILITY,
      CLAUDE_GATEWAY_SERVICES_CAPABILITY,
    ];
    render(<AllProviderPages />);

    fireEvent.click(
      screen.getByRole("button", { name: "providersGatewayServiceAdd" }),
    );
    // Nothing is saved until the new entry names an endpoint.
    expect(mockUpdateSettings).not.toHaveBeenCalled();
    const url = screen.getByRole("textbox", {
      name: "providersGatewayServiceUrlAria",
    });
    fireEvent.change(url, { target: { value: "http://127.0.0.1:8001" } });
    fireEvent.blur(url);

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        gatewayServices: [
          expect.objectContaining({
            id: "127-0-0-1-8001",
            url: "http://127.0.0.1:8001",
            enabled: true,
            // A newly added endpoint defaults into CodexOSS use, so the
            // provider is usable without a separate local server.
            codexEnabled: true,
          }),
        ],
        defaultGatewayServiceId: "127-0-0-1-8001",
      });
    });
  });

  it("hides Gateway autostart from servers with only the base capability", () => {
    versionState.capabilities = [CLAUDE_GATEWAY_CAPABILITY];
    render(<AllProviderPages />);

    expect(
      screen.queryByRole("textbox", {
        name: "providersClaudeGatewayStartCommandAria",
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("checkbox", {
        name: "providersClaudeGatewayDisableAgentTitle",
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("checkbox", {
        name: "providersClaudeGatewayDisablePlanModeTitle",
      }),
    ).toBeNull();
  });

  it("defaults the capability-gated Gateway Agent denial on", () => {
    versionState.capabilities = [
      CLAUDE_GATEWAY_CAPABILITY,
      CLAUDE_GATEWAY_DISABLE_AGENT_CAPABILITY,
    ];
    render(<AllProviderPages />);

    const checkbox = screen.getByRole("checkbox", {
      name: "providersClaudeGatewayDisableAgentTitle",
    });
    expect(checkbox).toHaveProperty("checked", true);

    fireEvent.click(checkbox);

    expect(mockUpdateSetting).toHaveBeenCalledWith(
      "claudeGatewayDisableAgent",
      false,
    );
  });

  it("defaults the capability-gated Gateway plan-mode exclusion on", () => {
    versionState.capabilities = [
      CLAUDE_GATEWAY_CAPABILITY,
      CLAUDE_GATEWAY_DISABLE_PLAN_MODE_CAPABILITY,
    ];
    render(<AllProviderPages />);

    const checkbox = screen.getByRole("checkbox", {
      name: "providersClaudeGatewayDisablePlanModeTitle",
    });
    expect(checkbox).toHaveProperty("checked", true);

    fireEvent.click(checkbox);

    expect(mockUpdateSetting).toHaveBeenCalledWith(
      "claudeGatewayDisablePlanMode",
      false,
    );
  });

  it("saves a capability-gated Gateway start command with the URL", async () => {
    versionState.capabilities = [
      CLAUDE_GATEWAY_CAPABILITY,
      CLAUDE_GATEWAY_AUTOSTART_CAPABILITY,
    ];
    render(<AllProviderPages />);

    fireEvent.change(
      screen.getByRole("textbox", {
        name: "providersClaudeGatewayUrlAria",
      }),
      { target: { value: "http://localhost:4041" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "providersClaudeGatewayStartCommandAria",
      }),
      {
        target: {
          value:
            "cd /srv/copilot-api && HOST=localhost bun run ./src/main.ts start --port 4041",
        },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "providersSave" }));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        claudeGatewayUrl: "http://localhost:4041",
        claudeGatewayStartCommand:
          "cd /srv/copilot-api && HOST=localhost bun run ./src/main.ts start --port 4041",
      });
      expect(mockReloadProviders).toHaveBeenCalledTimes(1);
    });
  });

  it("hides legacy ClaudeOllama when the server has no configuration or use", () => {
    render(<AllProviderPages />);

    expect(screen.queryByText("Claude + Ollama")).toBeNull();
  });

  it("keeps legacy ClaudeOllama visible when the server advertises it", () => {
    hookState.providers = [
      ...hookState.providers,
      {
        name: "claude-ollama",
        displayName: "Claude + Ollama",
        installed: true,
        authenticated: true,
        enabled: true,
        models: [],
      },
    ];

    render(<AllProviderPages />);

    expect(
      document.querySelector('[data-settings-item="provider-claude-ollama"]'),
    ).not.toBeNull();
    expect(
      screen.getByText("providersClaudeOllamaDeprecationNotice"),
    ).toBeTruthy();
  });

  it("permanently dismisses the ClaudeOllama deprecation notice", () => {
    hookState.providers = [
      ...hookState.providers,
      {
        name: "claude-ollama",
        displayName: "Claude + Ollama",
        installed: true,
        authenticated: true,
        enabled: true,
        models: [],
      },
    ];

    const { unmount } = render(<AllProviderPages />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "providersClaudeOllamaDeprecationDismissAria",
      }),
    );
    expect(
      screen.queryByText("providersClaudeOllamaDeprecationNotice"),
    ).toBeNull();

    unmount();
    render(<AllProviderPages />);
    expect(
      screen.queryByText("providersClaudeOllamaDeprecationNotice"),
    ).toBeNull();
  });

  it("hides post-compact continuation on older servers", () => {
    render(<AllProviderPages />);
    expect(screen.queryByText("providersPostCompactReplayTitle")).toBeNull();
  });

  it("saves a post-compact provider checkbox and replay count", async () => {
    hookState.settings = {
      ...hookState.settings,
      postCompactReplay: { providers: {}, replayTurnCount: 0 },
    };

    render(<AllProviderPages />);

    expect(screen.getByText("providersPostCompactReplayTitle")).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: "Claude" }));

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith("postCompactReplay", {
        providers: { claude: true },
        replayTurnCount: 0,
      });
    });

    const numberInput = screen
      .getAllByLabelText("providersPostCompactReplayCountAria")
      .find((element) => element.getAttribute("type") === "number");
    expect(numberInput).toBeDefined();
    fireEvent.change(numberInput!, { target: { value: "4" } });
    fireEvent.blur(numberInput!);

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith("postCompactReplay", {
        providers: {},
        replayTurnCount: 4,
      });
    });
  });
});
