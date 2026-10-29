import { useMemo } from "react";
import {
  type RemoteConnectionState,
  useOptionalRemoteConnection,
} from "../../contexts/RemoteConnectionContext";
import { useVersion } from "../../hooks/useVersion";
import { useI18n } from "../../i18n";
import { buildFrontendReloadUrl } from "../../lib/frontendReload";
import { loadSavedHosts } from "../../lib/hostStorage";
import { markSwitchHostReload } from "../../lib/switchHostReload";
import { formatVersionTag } from "./SidebarBrand";

export type HostMode = "local" | "relay" | "direct";

const HOST_MODE_LABEL = {
  local: "sidebarHostModeLocal",
  relay: "sidebarHostModeRelay",
  direct: "sidebarHostModeDirect",
} as const;

export interface ConnectedHost {
  /** Null for the local app, which has no host to switch. */
  remote: RemoteConnectionState | null;
  mode: HostMode;
  name: string;
  /** "MODE · vX.Y.Z" */
  caption: string;
}

function directHostName(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

/** The connected machine's name as the reader saved it. */
function useSavedHostName(remote: RemoteConnectionState | null): string | null {
  const hostId = remote?.currentHostId ?? null;
  const relayUsername = remote?.currentRelayUsername ?? null;
  const directUrl = remote?.currentDirectUrl ?? null;
  return useMemo(() => {
    const saved = hostId
      ? loadSavedHosts().hosts.find((host) => host.id === hostId)
      : undefined;
    return saved?.displayName ?? relayUsername ?? directHostName(directUrl);
  }, [directUrl, hostId, relayUsername]);
}

/** Which machine this app talks to, for the host pill and the More page. */
export function useConnectedHost(): ConnectedHost {
  const { t } = useI18n();
  const remote = useOptionalRemoteConnection();
  const { version } = useVersion();
  const savedName = useSavedHostName(remote);
  const mode: HostMode = !remote
    ? "local"
    : remote.currentRelayUsername
      ? "relay"
      : "direct";
  const name =
    savedName ?? t(remote ? "sidebarHostRemote" : "sidebarHostLocal");
  const caption = [t(HOST_MODE_LABEL[mode]), formatVersionTag(version?.current)]
    .filter(Boolean)
    .join(" · ");
  return { remote, mode, name, caption };
}

/** Disconnect, cache-bust this document, then open the host picker. */
export function switchHost(remote: RemoteConnectionState) {
  if (remote.switchHost) {
    remote.switchHost();
    return;
  }
  remote.disconnect();
  markSwitchHostReload();
  window.location.replace(
    buildFrontendReloadUrl(window.location.href, String(Date.now())),
  );
}
