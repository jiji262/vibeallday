const DIRECT_APP_ROUTE_SEGMENTS = new Set([
  "agents",
  "git-status",
  "inbox",
  "issues",
  "more",
  "new-session",
  "projects",
  "sessions",
  "settings",
  "triage",
]);

const RESERVED_REMOTE_ROUTE_SEGMENTS = new Set([
  ...DIRECT_APP_ROUTE_SEGMENTS,
  "-",
  // Removed app routes: old links must not read as a relay username.
  "activity",
  "bang-commands",
  "devices",
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
