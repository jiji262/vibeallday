import { lazy } from "react";

// Map consolidated category IDs to their components
export const CATEGORY_COMPONENTS: Record<string, React.ComponentType> = {
  providers: lazy(() =>
    import("./ProvidersSettings").then((m) => ({
      default: m.ProvidersSettings,
    })),
  ),
  model: lazy(() =>
    import("./ModelSettings").then((m) => ({ default: m.ModelSettings })),
  ),
  appearance: lazy(() =>
    import("./AppearanceSettings").then((m) => ({
      default: m.AppearanceSettings,
    })),
  ),
  speech: lazy(() =>
    import("./SpeechSettings").then((m) => ({ default: m.SpeechSettings })),
  ),
  "local-access": lazy(() =>
    import("./LocalAccessSettings").then((m) => ({
      default: m.LocalAccessSettings,
    })),
  ),
  remote: lazy(() =>
    import("./RemoteAccessSettings").then((m) => ({
      default: m.RemoteAccessSettings,
    })),
  ),
  notifications: lazy(() =>
    import("./NotificationsSettings").then((m) => ({
      default: m.NotificationsSettings,
    })),
  ),
  users: lazy(() =>
    import("./UsersSettings").then((m) => ({ default: m.UsersSettings })),
  ),
  "source-control": lazy(() =>
    import("./SourceControlSettings").then((m) => ({
      default: m.SourceControlSettings,
    })),
  ),
  apps: lazy(() =>
    import("./AppsSettings").then((m) => ({ default: m.AppsSettings })),
  ),
  storage: lazy(() =>
    import("./StorageSettings").then((m) => ({ default: m.StorageSettings })),
  ),
  about: lazy(() =>
    import("./AboutSettings").then((m) => ({ default: m.AboutSettings })),
  ),
};
