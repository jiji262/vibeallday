import { isDirectAppRouteSegment } from "./remoteRouteSegments";

export type RemoteRouteModuleKey =
  | "agentsPage"
  | "bangCommandsPage"
  | "directLoginPage"
  | "emulatorPage"
  | "filePage"
  | "gitStatusPage"
  | "globalSessionsPage"
  | "hostPickerPage"
  | "inboxPage"
  | "issuesPage"
  | "layouts"
  | "legacyRelayRouteRedirect"
  | "morePage"
  | "localSourcePage"
  | "multiHostMonitorPage"
  | "newSessionPage"
  | "projectSessionsRedirect"
  | "projectsPage"
  | "publicShareFilePage"
  | "publicSharePage"
  | "relayConnectionGate"
  | "relayLoginPage"
  | "remoteApp"
  | "sessionCore"
  | "sessionPage"
  | "settings"
  | "workstreamsPage";

function normalizeRouterPathname(pathname: string, baseUrl: string): string {
  const basePath = baseUrl.replace(/\/$/, "");
  if (!basePath || basePath === "/") return pathname || "/";
  if (pathname === basePath) return "/";
  return pathname.startsWith(`${basePath}/`)
    ? pathname.slice(basePath.length)
    : pathname;
}

function selectedAppPageModules(pathname: string): RemoteRouteModuleKey[] {
  const modules: RemoteRouteModuleKey[] = ["layouts"];
  if (pathname === "/" || pathname === "/inbox") {
    return [...modules, "inboxPage"];
  }
  if (pathname === "/projects") return [...modules, "projectsPage"];
  if (pathname === "/more") return [...modules, "morePage"];
  if (/^\/projects\/[^/]+\/sessions\/[^/]+(?:\/|$)/.test(pathname)) {
    return [...modules, "sessionPage", "sessionCore"];
  }
  if (/^\/projects\/[^/]+\/workstreams(?:\/|$)/.test(pathname)) {
    return [...modules, "workstreamsPage"];
  }
  if (/^\/projects\/[^/]+\/file(?:\/|$)/.test(pathname)) {
    return [...modules, "filePage"];
  }
  if (/^\/projects\/[^/]+\/browse(?:\/|$)/.test(pathname)) {
    return [...modules, "localSourcePage"];
  }
  if (/^\/projects\/[^/]+(?:\/|$)/.test(pathname)) {
    return [...modules, "projectSessionsRedirect"];
  }
  if (pathname === "/sessions") return [...modules, "globalSessionsPage"];
  if (pathname === "/agents") return [...modules, "agentsPage"];
  if (pathname === "/issues") return [...modules, "issuesPage"];
  if (pathname === "/git-status") return [...modules, "gitStatusPage"];
  if (pathname === "/bang-commands") {
    return [...modules, "bangCommandsPage"];
  }
  if (pathname === "/devices" || pathname.startsWith("/devices/")) {
    return [...modules, "emulatorPage"];
  }
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return [...modules, "settings"];
  }
  if (/^\/new-session\/?$/.test(pathname))
    return [...modules, "newSessionPage"];
  return [...modules, "inboxPage"];
}

export function getInitialRemoteRouteModuleKeys(
  browserPathname: string,
  baseUrl: string,
): RemoteRouteModuleKey[] {
  const pathname = normalizeRouterPathname(browserPathname, baseUrl);

  if (/^\/(?:remote\/)?share\/[^/]+\/file(?:\/|$)/.test(pathname)) {
    return ["publicShareFilePage"];
  }
  if (/^\/(?:remote\/)?share\/[^/]+(?:\/|$)/.test(pathname)) {
    return ["publicSharePage"];
  }
  if (pathname === "/-/monitor") return ["multiHostMonitorPage"];

  if (pathname === "/login" || pathname === "/login/") {
    return ["remoteApp", "hostPickerPage"];
  }
  if (pathname === "/login/direct") {
    return ["remoteApp", "directLoginPage"];
  }
  if (pathname === "/login/relay") {
    return ["remoteApp", "relayLoginPage"];
  }

  const relayMatch = pathname.match(/^\/-\/relay\/[^/]+(\/.*)?$/);
  if (relayMatch) {
    const appPathname = relayMatch[1] || "/";
    return [
      "remoteApp",
      "relayConnectionGate",
      ...selectedAppPageModules(appPathname),
    ];
  }

  const firstSegment = pathname.split("/")[1];
  if (
    pathname === "/" ||
    (firstSegment && isDirectAppRouteSegment(firstSegment))
  ) {
    return ["remoteApp", ...selectedAppPageModules(pathname)];
  }

  return ["remoteApp", "legacyRelayRouteRedirect"];
}
