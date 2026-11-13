import {
  SERVER_CAPABILITIES,
  serverHasCapability,
  type SessionCreationProvenance,
} from "@vibeallday/shared";
import type { VersionInfo } from "../api/serverMetadataClient";
import { getClientVersion } from "./clientVersion";

export function getUiCreationProvenance(
  versionInfo: VersionInfo | null | undefined,
): SessionCreationProvenance | undefined {
  if (
    !serverHasCapability(
      versionInfo,
      SERVER_CAPABILITIES.sessionCreationProvenance.name,
    )
  ) {
    return undefined;
  }
  return {
    surface: "web",
    clientOrigin: window.location.origin,
    clientVersion: getClientVersion(),
  };
}
