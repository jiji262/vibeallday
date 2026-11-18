import { lazy } from "react";
import { Route } from "react-router-dom";
import { RouteModule, routeModule } from "../components/RouteModule";
import { preloadableComponent } from "../lib/preloadableComponent";

export function cachedModule<T>(load: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | undefined;
  return () => {
    promise ??= load();
    return promise;
  };
}

export const sharedPageModuleLoaders = {
  layouts: cachedModule(() => import("../layouts")),
  agentsPage: cachedModule(() => import("../pages/AgentsPage")),
  morePage: cachedModule(() => import("../pages/MorePage")),
  filePage: cachedModule(() => import("../pages/FilePage")),
  localSourcePage: cachedModule(() => import("../pages/LocalSourcePage")),
  gitStatusPage: cachedModule(() => import("../pages/GitStatusPage")),
  globalSessionsPage: cachedModule(() => import("../pages/GlobalSessionsPage")),
  inboxPage: cachedModule(() => import("../pages/InboxPage")),
  issuesPage: cachedModule(() => import("../pages/IssuesPage")),
  projectHomePage: cachedModule(() => import("../pages/ProjectHomePage")),
  triagePage: cachedModule(() => import("../pages/TriagePage")),
  newSessionPage: cachedModule(() => import("../pages/NewSessionPage")),
  projectsPage: cachedModule(() => import("../pages/ProjectsPage")),
  sessionPage: cachedModule(() => import("../pages/SessionPage")),
  providerChildSessionPage: cachedModule(
    () => import("../pages/ProviderChildSessionPage"),
  ),
  settings: cachedModule(() => import("../pages/settings")),
} as const;

const NavigationLayout = preloadableComponent(async () => ({
  default: (await sharedPageModuleLoaders.layouts()).NavigationLayout,
}));

const NewSessionPage = preloadableComponent(async () => ({
  default: (await sharedPageModuleLoaders.newSessionPage()).NewSessionPage,
}));

export function preloadNewSessionRouteModules(): Promise<unknown> {
  return Promise.all([NavigationLayout.preload(), NewSessionPage.preload()]);
}

const SessionDomLingerRouteMarker = lazy(() =>
  sharedPageModuleLoaders.layouts().then(({ SessionDomLingerRouteMarker }) => ({
    default: SessionDomLingerRouteMarker,
  })),
);
const AgentsPage = lazy(() =>
  sharedPageModuleLoaders.agentsPage().then(({ AgentsPage }) => ({
    default: AgentsPage,
  })),
);
const IssuesPage = lazy(() =>
  sharedPageModuleLoaders.issuesPage().then((m) => ({
    default: m.IssuesPage,
  })),
);
const FilePage = lazy(() =>
  sharedPageModuleLoaders.filePage().then(({ FilePage }) => ({
    default: FilePage,
  })),
);
const LocalSourcePage = lazy(() =>
  sharedPageModuleLoaders.localSourcePage().then(({ LocalSourcePage }) => ({
    default: LocalSourcePage,
  })),
);
const ViewerModePage = lazy(() =>
  import("../pages/ViewerModePage").then(({ ViewerModePage }) => ({
    default: ViewerModePage,
  })),
);
const GitStatusPage = lazy(() =>
  sharedPageModuleLoaders.gitStatusPage().then(({ GitStatusPage }) => ({
    default: GitStatusPage,
  })),
);
const GlobalSessionsPage = lazy(() =>
  sharedPageModuleLoaders
    .globalSessionsPage()
    .then(({ GlobalSessionsPage }) => ({
      default: GlobalSessionsPage,
    })),
);
const InboxPage = lazy(() =>
  sharedPageModuleLoaders.inboxPage().then(({ InboxPage }) => ({
    default: InboxPage,
  })),
);
const MorePage = lazy(() =>
  sharedPageModuleLoaders.morePage().then(({ MorePage }) => ({
    default: MorePage,
  })),
);
const ProjectAppPage = lazy(() =>
  import("../pages/ProjectAppPage").then(({ ProjectAppPage }) => ({
    default: ProjectAppPage,
  })),
);
const ProjectsPage = lazy(() =>
  sharedPageModuleLoaders.projectsPage().then(({ ProjectsPage }) => ({
    default: ProjectsPage,
  })),
);
const ProjectHomePage = lazy(() =>
  sharedPageModuleLoaders.projectHomePage().then(({ ProjectHomePage }) => ({
    default: ProjectHomePage,
  })),
);
const TriagePage = lazy(() =>
  sharedPageModuleLoaders.triagePage().then(({ TriagePage }) => ({
    default: TriagePage,
  })),
);
const SessionPage = lazy(() =>
  sharedPageModuleLoaders.sessionPage().then(({ SessionPage }) => ({
    default: SessionPage,
  })),
);
const ProviderChildSessionPage = lazy(() =>
  sharedPageModuleLoaders
    .providerChildSessionPage()
    .then(({ ProviderChildSessionPage }) => ({
      default: ProviderChildSessionPage,
    })),
);
const SettingsLayout = lazy(() =>
  sharedPageModuleLoaders.settings().then(({ SettingsLayout }) => ({
    default: SettingsLayout,
  })),
);
const ProviderSignInPage = lazy(() =>
  import("../pages/ProviderSignInPage").then((m) => ({
    default: m.ProviderSignInPage,
  })),
);

/**
 * Single canonical `<NavigationLayout>` route tree shared by local (`main.tsx`),
 * direct remote (`ConnectionGate`), and relay remote (`RelayConnectionGate`).
 * Relative paths resolve identically under `/` and `/-/relay/:relayUsername`.
 */
export const SHARED_NAVIGATION_LAYOUT_ROUTE = (
  <Route
    element={
      <RouteModule>
        <NavigationLayout
          sessionElement={(route, { parked, progressiveRenderPauseSignal }) => (
            <RouteModule key={route.key}>
              <SessionPage
                projectId={route.projectId}
                sessionId={route.sessionId}
                routeLocation={route.location}
                isDomLingerParked={parked}
                progressiveRenderPauseSignal={progressiveRenderPauseSignal}
              />
            </RouteModule>
          )}
        />
      </RouteModule>
    }
  >
    <Route path="projects" element={routeModule(<ProjectsPage />)} />
    <Route
      path="projects/:projectId/app"
      element={routeModule(<ProjectAppPage />)}
    />
    <Route
      path="projects/:projectId"
      element={routeModule(<ProjectHomePage />)}
    />
    <Route path="sessions" element={routeModule(<GlobalSessionsPage />)} />
    <Route path="agents" element={routeModule(<AgentsPage />)} />
    <Route path="issues" element={routeModule(<IssuesPage />)} />
    <Route path="inbox" element={routeModule(<InboxPage />)} />
    <Route path="triage" element={routeModule(<TriagePage />)} />
    <Route path="more" element={routeModule(<MorePage />)} />
    <Route path="git-status" element={routeModule(<GitStatusPage />)} />
    <Route
      path="provider-sign-in/:provider"
      element={routeModule(<ProviderSignInPage />)}
    />
    <Route path="settings" element={routeModule(<SettingsLayout />)} />
    <Route
      path="settings/:category"
      element={routeModule(<SettingsLayout />)}
    />
    <Route
      path="settings/:category/:itemId"
      element={routeModule(<SettingsLayout />)}
    />
    <Route path="new-session" element={routeModule(<NewSessionPage />)} />
    <Route
      path="projects/:projectId/file"
      element={routeModule(<FilePage />)}
    />
    <Route
      path="projects/:projectId/browse"
      element={routeModule(<LocalSourcePage />)}
    />
    <Route path="file-view" element={routeModule(<ViewerModePage />)} />
    <Route
      path="projects/:projectId/sessions/:sessionId"
      element={routeModule(<SessionDomLingerRouteMarker />)}
    />
    <Route
      path="projects/:projectId/sessions/:sessionId/agents/:agentId"
      element={routeModule(<ProviderChildSessionPage />)}
    />
  </Route>
);
