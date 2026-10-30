import { lazy } from "react";

// Map category IDs to their components
export const CATEGORY_COMPONENTS: Record<string, React.ComponentType> = {
  appearance: lazy(() =>
    import("./AppearanceSettings").then((m) => ({
      default: m.AppearanceSettings,
    })),
  ),
  performance: lazy(() =>
    import("./PerformanceSettings").then((m) => ({
      default: m.PerformanceSettings,
    })),
  ),
  toolbar: lazy(() =>
    import("./ToolbarSettings").then((m) => ({ default: m.ToolbarSettings })),
  ),
  model: lazy(() =>
    import("./ModelSettings").then((m) => ({ default: m.ModelSettings })),
  ),
  "cache-miss-billing": lazy(() =>
    import("./CacheMissBillingSettings").then((m) => ({
      default: m.CacheMissBillingSettings,
    })),
  ),
  "message-delivery": lazy(() =>
    import("./MessageDeliverySettings").then((m) => ({
      default: m.MessageDeliverySettings,
    })),
  ),
  "source-control": lazy(() =>
    import("./SourceControlSettings").then((m) => ({
      default: m.SourceControlSettings,
    })),
  ),
  issues: lazy(() =>
    import("./IssueSettings").then((m) => ({ default: m.IssueSettings })),
  ),
  "browser-extension": lazy(() =>
    import("./BrowserExtensionSettings").then((m) => ({
      default: m.BrowserExtensionSettings,
    })),
  ),
  storage: lazy(() =>
    import("./StorageSettings").then((m) => ({ default: m.StorageSettings })),
  ),
  "agent-context": lazy(() =>
    import("./AgentContextSettings").then((m) => ({
      default: m.AgentContextSettings,
    })),
  ),
  "agent-behavior": lazy(() =>
    import("./AgentBehaviorSettings").then((m) => ({
      default: m.AgentBehaviorSettings,
    })),
  ),
  "import-export": lazy(() =>
    import("./ImportExportSettings").then((m) => ({
      default: m.ImportExportSettings,
    })),
  ),
  notifications: lazy(() =>
    import("./NotificationsSettings").then((m) => ({
      default: m.NotificationsSettings,
    })),
  ),
  webhooks: lazy(() =>
    import("./LifecycleWebhooksSettings").then((m) => ({
      default: m.LifecycleWebhooksSettings,
    })),
  ),
  devices: lazy(() =>
    import("./DevicesSettings").then((m) => ({ default: m.DevicesSettings })),
  ),
  "local-access": lazy(() =>
    import("./LocalAccessSettings").then((m) => ({
      default: m.LocalAccessSettings,
    })),
  ),
  users: lazy(() =>
    import("./UsersSettings").then((m) => ({ default: m.UsersSettings })),
  ),
  "project-templates": lazy(() =>
    import("./ProjectTemplatesSettings").then((m) => ({
      default: m.ProjectTemplatesSettings,
    })),
  ),
  apps: lazy(() =>
    import("./AppsSettings").then((m) => ({ default: m.AppsSettings })),
  ),
  remote: lazy(() =>
    import("./RemoteAccessSettings").then((m) => ({
      default: m.RemoteAccessSettings,
    })),
  ),
  providers: lazy(() =>
    import("./ProvidersSettings").then((m) => ({
      default: m.ProvidersSettings,
    })),
  ),
  speech: lazy(() =>
    import("./SpeechSettings").then((m) => ({ default: m.SpeechSettings })),
  ),
  "remote-executors": lazy(() =>
    import("./RemoteExecutorsSettings").then((m) => ({
      default: m.RemoteExecutorsSettings,
    })),
  ),
  emulator: lazy(() =>
    import("./EmulatorSettings").then((m) => ({ default: m.EmulatorSettings })),
  ),
  environment: lazy(() =>
    import("./EnvironmentSettings").then((m) => ({
      default: m.EnvironmentSettings,
    })),
  ),
  about: lazy(() =>
    import("./AboutSettings").then((m) => ({ default: m.AboutSettings })),
  ),
  development: lazy(() =>
    import("./DevelopmentSettings").then((m) => ({
      default: m.DevelopmentSettings,
    })),
  ),
};
