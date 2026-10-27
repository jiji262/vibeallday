const DIRECT_APP_ROUTE_SEGMENTS = new Set([
  "agents",
  "bang-commands",
  "devices",
  "git-status",
  "inbox",
  "issues",
  "more",
  "new-session",
  "projects",
  "sessions",
  "settings",
]);

const RESERVED_REMOTE_ROUTE_SEGMENTS = new Set([
  ...DIRECT_APP_ROUTE_SEGMENTS,
  "-",
  // Removed app route: old /activity links must not read as a relay username.
  "activity",
  "login",
  "remote",
  "share",
]);

export function isDirectAppRouteSegment(segment: string): boolean {
  return DIRECT_APP_ROUTE_SEGMENTS.has(segment);
}

export function isReservedRemoteRouteSegment(segment: string): boolean {
  return RESERVED_REMOTE_ROUTE_SEGMENTS.has(segment);
}
