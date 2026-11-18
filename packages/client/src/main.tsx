import "./lib/developmentPerformanceBootstrap";
import { Fragment, lazy, type ReactNode, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { initializeClientEnvironment } from "./bootstrap/initializeClientEnvironment";
import {
  preloadNewSessionRouteModules,
  SHARED_NAVIGATION_LAYOUT_ROUTE,
  sharedPageModuleLoaders,
} from "./bootstrap/sharedAppRoutes";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PrebootComposerRetirement } from "./components/PrebootComposerRetirement";
import { RouteModule, routeModule } from "./components/RouteModule";
import { TooltipLayer } from "./components/ui/TooltipLayer";
import { I18nProvider, useI18n } from "./i18n";
import { preloadableComponent } from "./lib/preloadableComponent";
import "./styles/index.css";

// Toggle to disable StrictMode for easier debugging (avoids double renders)
const STRICT_MODE = false;
const Wrapper = STRICT_MODE ? StrictMode : Fragment;

const App = preloadableComponent(async () => ({
  default: (await import("./App")).App,
}));
const ConversationPreviewPage = lazy(() =>
  import("./pages/ConversationPreviewPage").then(
    ({ ConversationPreviewPage }) => ({ default: ConversationPreviewPage }),
  ),
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then(({ LoginPage }) => ({
    default: LoginPage,
  })),
);

/** The preview route owns its connections without the full app runtime. */
function LocalAppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return /^\/-\/preview\/?$/.test(pathname) ? children : <App>{children}</App>;
}

/**
 * Dev-only notice shown when the app is loaded directly from the Vite dev port
 * instead of through the main server. Rendered before theme init, so it uses
 * self-contained inline styles rather than relying on app CSS variables.
 */
function WrongPortNotice({ backendUrl }: { backendUrl: string }) {
  const { t } = useI18n();
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "#0f1115",
        color: "#e6e6e6",
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: "100%",
          border: "1px solid #2a2f3a",
          borderRadius: 12,
          padding: "28px 28px 24px",
          background: "#161a22",
          boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.4,
            color: "#8aa0ff",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          {t("wrongPortLabel")}
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 650, margin: "0 0 10px" }}>
          {t("wrongPortTitle")}
        </h1>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            margin: "0 0 20px",
            color: "#b6bcc8",
          }}
        >
          {t("wrongPortBody", { port: __VITE_DEV_PORT__ })}
        </p>
        <a
          href={backendUrl}
          style={{
            display: "inline-block",
            padding: "10px 16px",
            borderRadius: 8,
            background: "#3b6cf6",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {t("wrongPortOpen")}
        </a>
        <div
          style={{
            marginTop: 14,
            fontSize: 12.5,
            color: "#7a8290",
            wordBreak: "break-all",
          }}
        >
          {backendUrl}
        </div>
      </div>
    </div>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

if (import.meta.env.DEV && window.location.port === String(__VITE_DEV_PORT__)) {
  const backendUrl = `${window.location.protocol}//${window.location.hostname}:${__BACKEND_PORT__}${window.location.pathname}${window.location.search}${window.location.hash}`;
  createRoot(rootElement).render(
    <I18nProvider>
      <WrongPortNotice backendUrl={backendUrl} />
    </I18nProvider>,
  );
} else {
  initializeClientEnvironment();

  if (import.meta.env.VITE_E2E_SOURCE_TRANSPORT_SMOKE === "true") {
    void import("./lib/e2e/sourceTransportCoexistenceSmoke").then(
      ({ installSourceTransportCoexistenceSmoke }) => {
        installSourceTransportCoexistenceSmoke();
      },
    );
  }

  const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;
  const initialPath = basename
    ? window.location.pathname.slice(basename.length)
    : window.location.pathname;
  let initialModules: Promise<unknown> | undefined;

  if (/^\/settings(?:\/|$)/.test(initialPath)) {
    void Promise.allSettled([
      import("./App"),
      sharedPageModuleLoaders.layouts(),
      sharedPageModuleLoaders.settings(),
    ]);
  } else if (/^\/new-session\/?$/.test(initialPath)) {
    initialModules = Promise.all([
      App.preload(),
      preloadNewSessionRouteModules(),
    ]);
  }

  const app = (
    <Wrapper>
      <ErrorBoundary>
        <TooltipLayer />
        <BrowserRouter basename={basename}>
          <PrebootComposerRetirement />
          <I18nProvider>
            <RouteModule>
              <LocalAppShell>
                <Routes>
                  <Route
                    path="/-/preview"
                    element={routeModule(<ConversationPreviewPage local />)}
                  />
                  <Route path="/" element={<Navigate to="/inbox" replace />} />
                  <Route path="/login" element={routeModule(<LoginPage />)} />
                  {SHARED_NAVIGATION_LAYOUT_ROUTE}
                  <Route path="*" element={<Navigate to="/inbox" replace />} />
                </Routes>
              </LocalAppShell>
            </RouteModule>
          </I18nProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </Wrapper>
  );

  const renderApp = () => createRoot(rootElement).render(app);
  if (initialModules) void initialModules.then(renderApp, renderApp);
  else renderApp();
}
