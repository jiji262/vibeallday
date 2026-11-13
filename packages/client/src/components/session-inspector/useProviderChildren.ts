import type { ProviderChildSessionSummary } from "@vibeallday/shared";
import { useMemo } from "react";
import { useProcesses } from "../../hooks/useProcesses";
import { firstDefinedProviderChildren } from "../../lib/providerChildSessions";

/**
 * A session's provider children: the live process list first (it updates
 * mid-turn), then the session record's copy. No extra request.
 */
export function useProviderChildren(
  sessionId: string,
  fromSession?: ProviderChildSessionSummary[],
): ProviderChildSessionSummary[] {
  const { processes, terminatedProcesses } = useProcesses();
  const fromProcess = useMemo(
    () =>
      [...processes, ...terminatedProcesses].find(
        (process) => process.sessionId === sessionId,
      )?.providerChildren,
    [processes, sessionId, terminatedProcesses],
  );
  return firstDefinedProviderChildren(fromProcess, fromSession);
}
