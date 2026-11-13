/**
 * Route classes the navigation shell decides chrome from. Paths may carry a
 * relay base (`/-/relay/<host>`); the router basename is already stripped.
 */

const RELAY_BASE_PATTERN = /^\/-\/relay\/[^/]+/;

/** Phone root pages: the only routes that show the bottom tab bar. */
const TAB_BAR_ROOT_PATHS = new Set([
  "/inbox",
  "/sessions",
  "/projects",
  "/more",
]);

/** The app path below any relay base, without a trailing slash. */
export function appPathname(pathname: string): string {
  const appPath = pathname.replace(RELAY_BASE_PATTERN, "") || "/";
  return appPath.length > 1 ? appPath.replace(/\/+$/, "") : appPath;
}

export function isTabBarRootPathname(pathname: string): boolean {
  return TAB_BAR_ROOT_PATHS.has(appPathname(pathname));
}

/** Session details carry their own back link to the session list. */
export function isSessionDetailPathname(pathname: string): boolean {
  return /^\/projects\/[^/]+\/sessions\/[^/]+/.test(appPathname(pathname));
}

/** Settings replace the app sidebar with their own rail on desktop. */
export function isSettingsPathname(pathname: string): boolean {
  return /^\/settings(?:\/|$)/.test(appPathname(pathname));
}
