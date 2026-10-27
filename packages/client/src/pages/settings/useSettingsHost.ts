import { useMemo } from "react";
import { useOptionalRemoteConnection } from "../../contexts/RemoteConnectionContext";
import { useVersion } from "../../hooks/useVersion";
import { getHostById } from "../../lib/hostStorage";

export type SettingsHostMode = "local" | "relay" | "direct";

export interface SettingsHostInfo {
  /** What to call the computer: a saved name, relay name or hostname. */
  name: string;
  mode: SettingsHostMode;
  /** host[:port] the client talks to, when it is not the name itself. */
  address: string | null;
  /** Server version, e.g. "0.10.2". */
  version: string | null;
}

/** host[:port] of a ws:// or https:// URL; null when it does not parse. */
function hostOfUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).host || null;
  } catch {
    return null;
  }
}

/**
 * Which computer this client is connected to. The same-origin app is served
 * by the host itself; a hosted or native client goes through the remote
 * connection, which knows the saved host's name.
 */
export function useSettingsHost(): SettingsHostInfo {
  const remote = useOptionalRemoteConnection();
  const { version } = useVersion();
  const hostId = remote?.currentHostId ?? null;
  const relayUsername = remote?.currentRelayUsername ?? null;
  const relayUrl = remote?.currentRelayUrl ?? null;
  const directUrl = remote?.currentDirectUrl ?? null;
  const serverVersion = version?.current ?? null;

  return useMemo(() => {
    if (!remote) {
      const { hostname, port } = window.location;
      return {
        name: hostname,
        mode: "local",
        address: port ? `:${port}` : null,
        version: serverVersion,
      };
    }
    const saved = hostId ? getHostById(hostId) : undefined;
    if (relayUsername || saved?.mode === "relay") {
      const username = relayUsername ?? saved?.relayUsername ?? "";
      return {
        name: saved?.displayName ?? username,
        mode: "relay",
        address: hostOfUrl(relayUrl ?? saved?.relayUrl),
        version: serverVersion,
      };
    }
    const address = hostOfUrl(directUrl ?? saved?.wsUrl);
    return {
      name: saved?.displayName ?? address ?? "",
      mode: "direct",
      address,
      version: serverVersion,
    };
  }, [remote, hostId, relayUsername, relayUrl, directUrl, serverVersion]);
}
