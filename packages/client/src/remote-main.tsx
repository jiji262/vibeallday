/**
 * Remote client entry point.
 *
 * Uses SecureConnection (SRP + NaCl encryption) for direct and relay hosts,
 * sharing startup initialization and authenticated app routes with `main.tsx`.
 */

import "./lib/developmentPerformanceBootstrap";
import { Fragment, lazy, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { initializeClientEnvironment } from "./bootstrap/initializeClientEnvironment";
import {
  cachedModule,
  preloadNewSessionRouteModules,
  SHARED_NAVIGATION_LAYOUT_ROUTE,
  sharedPageModuleLoaders,
} from "./bootstrap/sharedAppRoutes";
import { PrebootComposerRetirement } from "./components/PrebootComposerRetirement";
import { RouteModule, routeModule } from "./components/RouteModule";
import { TooltipLayer } from "./components/ui/TooltipLayer";
import { I18nProvider } from "./i18n";
import { preloadableComponent } from "./lib/preloadableComponent";
import {
  getInitialRemoteRouteModuleKeys,
  type RemoteRouteModuleKey,
} from "./lib/remoteRoutePreload";
import { loadSessionCoreModules } from "./lib/sessionRouteModules";
import "./styles/index.css";

// Toggle to disable StrictMode for easier debugging (avoids double renders)
const STRICT_MODE = false;
const Wrapper = STRICT_MODE ? StrictMode : Fragment;

const loadRemoteAppModule = cachedModule(() => import("./RemoteApp"));
const loadDirectLoginPageModule = cachedModule(
  () => import("./pages/DirectLoginPage"),
);
const loadHostPickerPageModule = cachedModule(
  () => import("./pages/HostPickerPage"),
);
const loadLegacyRelayRouteRedirectModule = cachedModule(
  () => import("./pages/LegacyRelayRouteRedirect"),
);
const loadPublicShareFilePageModule = cachedModule(
  () => import("./pages/PublicShareFilePage"),
);
const loadPublicSharePageModule = cachedModule(
  () => import("./pages/PublicSharePage"),
);
const loadRelayConnectionGateModule = cachedModule(
  () => import("./pages/RelayConnectionGate"),
);
const loadRelayLoginPageModule = cachedModule(
  () => import("./pages/RelayLoginPage"),
);

const ConnectionGate = preloadableComponent(async () => ({
  default: (await loadRemoteAppModule()).ConnectionGate,
}));
const RemoteApp = preloadableComponent(async () => ({
  default: (await loadRemoteAppModule()).RemoteApp,
}));
const UnauthenticatedGate = lazy(() =>
  loadRemoteAppModule().then(({ UnauthenticatedGate }) => ({
    default: UnauthenticatedGate,
  })),
);
const RelayConnectionGate = preloadableComponent(async () => ({
  default: (await loadRelayConnectionGateModule()).RelayConnectionGate,
}));

const ConversationPreviewPage = lazy(() =>
  import("./pages/ConversationPreviewPage").then(
    ({ ConversationPreviewPage }) => ({ default: ConversationPreviewPage }),
  ),
);
const DirectLoginPage = lazy(() =>
  loadDirectLoginPageModule().then(({ DirectLoginPage }) => ({
    default: DirectLoginPage,
  })),
);
const HostPickerPage = lazy(() =>
  loadHostPickerPageModule().then(({ HostPickerPage }) => ({
    default: HostPickerPage,
  })),
);
const LegacyRelayRouteRedirect = lazy(() =>
  loadLegacyRelayRouteRedirectModule().then(({ LegacyRelayRouteRedirect }) => ({
    default: LegacyRelayRouteRedirect,
  })),
);
const PublicShareFilePage = lazy(() =>
  loadPublicShareFilePageModule().then(({ PublicShareFilePage }) => ({
    default: PublicShareFilePage,
  })),
);
const PublicSharePage = lazy(() =>
  loadPublicSharePageModule().then(({ PublicSharePage }) => ({
    default: PublicSharePage,
  })),
);
const RelayLoginPage = lazy(() =>
  loadRelayLoginPageModule().then(({ RelayLoginPage }) => ({
    default: RelayLoginPage,
  })),
);

const initialRemoteModuleLoaders: Record<
  RemoteRouteModuleKey,
  () => Promise<unknown>
> = {
  agentsPage: sharedPageModuleLoaders.agentsPage,
  directLoginPage: loadDirectLoginPageModule,
  filePage: sharedPageModuleLoaders.filePage,
  localSourcePage: sharedPageModuleLoaders.localSourcePage,
  gitStatusPage: sharedPageModuleLoaders.gitStatusPage,
  globalSessionsPage: sharedPageModuleLoaders.globalSessionsPage,
  hostPickerPage: loadHostPickerPageModule,
  inboxPage: sharedPageModuleLoaders.inboxPage,
  issuesPage: sharedPageModuleLoaders.issuesPage,
  layouts: sharedPageModuleLoaders.layouts,
  legacyRelayRouteRedirect: loadLegacyRelayRouteRedirectModule,
  morePage: sharedPageModuleLoaders.morePage,
  newSessionPage: sharedPageModuleLoaders.newSessionPage,
  projectHomePage: sharedPageModuleLoaders.projectHomePage,
  projectsPage: sharedPageModuleLoaders.projectsPage,
  publicShareFilePage: loadPublicShareFilePageModule,
  publicSharePage: loadPublicSharePageModule,
  relayConnectionGate: loadRelayConnectionGateModule,
  relayLoginPage: loadRelayLoginPageModule,
  remoteApp: loadRemoteAppModule,
  sessionCore: loadSessionCoreModules,
  sessionPage: sharedPageModuleLoaders.sessionPage,
  settings: sharedPageModuleLoaders.settings,
  triagePage: sharedPageModuleLoaders.triagePage,
};

const initialRouteModuleKeys = getInitialRemoteRouteModuleKeys(
  window.location.pathname,
  import.meta.env.BASE_URL,
);
void Promise.allSettled(
  initialRouteModuleKeys.map((key) => initialRemoteModuleLoaders[key]()),
);

const initialModules = initialRouteModuleKeys.includes("newSessionPage")
  ? Promise.all([
      RemoteApp.preload(),
      preloadNewSessionRouteModules(),
      initialRouteModuleKeys.includes("relayConnectionGate")
        ? RelayConnectionGate.preload()
        : ConnectionGate.preload(),
    ])
  : undefined;

initializeClientEnvironment();

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

const APP_ROUTES = (
  <>
    <Route index element={<Navigate to="inbox" replace />} />
    {SHARED_NAVIGATION_LAYOUT_ROUTE}
    <Route path="*" element={<Navigate to="../inbox" replace />} />
  </>
);

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const app = (
  <Wrapper>
    <TooltipLayer />
    <BrowserRouter basename={basename}>
      <PrebootComposerRetirement />
      <I18nProvider>
        <Routes>
          <Route
            path="/share/:secret/file"
            element={routeModule(<PublicShareFilePage />)}
          />
          <Route
            path="/share/:secret"
            element={routeModule(<PublicSharePage />)}
          />
          <Route
            path="/remote/share/:secret/file"
            element={routeModule(<PublicShareFilePage />)}
          />
          <Route
            path="/remote/share/:secret"
            element={routeModule(<PublicSharePage />)}
          />
          <Route
            path="/-/preview"
            element={routeModule(<ConversationPreviewPage />)}
          />
          <Route
            path="*"
            element={
              <RouteModule>
                <RemoteApp>
                  <Routes>
                    <Route element={routeModule(<UnauthenticatedGate />)}>
                      <Route
                        path="/login"
                        element={routeModule(<HostPickerPage />)}
                      />
                      <Route
                        path="/login/direct"
                        element={routeModule(<DirectLoginPage />)}
                      />
                      <Route
                        path="/login/relay"
                        element={routeModule(<RelayLoginPage />)}
                      />
                    </Route>

                    <Route element={routeModule(<ConnectionGate />)}>
                      {APP_ROUTES}
                    </Route>

                    <Route
                      path="/-/relay/:relayUsername"
                      element={routeModule(<RelayConnectionGate />)}
                    >
                      {APP_ROUTES}
                    </Route>

                    <Route
                      path="/:legacyRelayUsername/*"
                      element={routeModule(<LegacyRelayRouteRedirect />)}
                    />
                  </Routes>
                </RemoteApp>
              </RouteModule>
            }
          />
        </Routes>
      </I18nProvider>
    </BrowserRouter>
  </Wrapper>
);

const renderApp = () => createRoot(rootElement).render(app);
if (initialModules) void initialModules.then(renderApp, renderApp);
else renderApp();
