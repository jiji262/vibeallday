import {
  REMOTE_NONE_CLIENT_SUMMARY_SOURCE_KEY,
  type ClientSummarySourceKey,
} from "../clientSummaryStore";
import {
  resumeScopeKey,
  safeResumeEndpoint,
  type ResumeScope,
} from "../rejectedResumeStorage";
import type { ResumeObservation } from "../resumeDiagnostics";
import { getSourceRuntimeRegistry } from "../sourceRuntime";
import { SecureSourceTransport } from "../transport";
import { getConsoleDiagnosticScope } from "./scopedConsole";

export function captureClientLogTarget(sourceKey?: ClientSummarySourceKey) {
  const registry = getSourceRuntimeRegistry();
  const runtime = sourceKey
    ? registry.getOrCreateSourceRuntime(sourceKey)
    : registry.getCurrentSourceRuntime();
  if (runtime.sourceKey === REMOTE_NONE_CLIENT_SUMMARY_SOURCE_KEY) return null;
  const transport = runtime.transport;
  if (transport instanceof SecureSourceTransport) {
    const connection = transport.captureDiagnosticConnection();
    if (!connection) return null;
    const scope = connection.getDiagnosticScope();
    return {
      key: JSON.stringify([runtime.sourceKey, resumeScopeKey(scope)]),
      connection,
      scope,
      transport,
      fetch: (init: RequestInit) => connection.fetch("/client-logs", init),
    };
  }
  if (transport.kind !== "localhost") return null;
  return {
    key: JSON.stringify([runtime.sourceKey, window.location.origin]),
    connection: transport,
    scope: null,
    transport,
    fetch: (init: RequestInit) => transport.fetch("/client-logs", init),
  };
}

export function canCaptureConsoleForCurrentTarget(): boolean {
  const target = captureClientLogTarget();
  if (!target) return false;
  const scope = getConsoleDiagnosticScope();
  if (!target.scope) return scope === undefined;
  return (
    scope != null && resumeScopeKey(scope) === resumeScopeKey(target.scope)
  );
}

export type ClientLogTarget = NonNullable<
  ReturnType<typeof captureClientLogTarget>
>;

export function isCurrentClientLogTarget(target: ClientLogTarget): boolean {
  const current = captureClientLogTarget();
  return (
    current?.key === target.key &&
    current.connection === target.connection &&
    current.transport === target.transport
  );
}

export function observationMatchesTarget(
  event: ResumeObservation,
  scope: ResumeScope | null,
): boolean {
  return (
    scope !== null &&
    event.mode === scope.mode &&
    scope.endpoint === safeResumeEndpoint(scope.endpoint) &&
    event.endpoint === safeResumeEndpoint(scope.endpoint) &&
    event.identity === scope.identity &&
    event.relayUsername === scope.relayUsername
  );
}
