import type { ProviderInfo } from "@vibeallday/shared";
import { getAllProviders } from "../../providers/registry";

/** Client provider metadata merged with what the server detected. */
export type ProviderDisplayEntry = ReturnType<
  typeof buildProviderDisplayList
>[number];

/** Where a provider sits on the overview: missing, waiting on sign-in, or usable. */
export type ProviderReadiness = "missing" | "needs-auth" | "ready";

/** Detail pages for the overview's routing rows, beside the provider ids. */
export const GATEWAY_SERVICES_ITEM_ID = "gateway-services";
export const AUTH_ROUTER_ITEM_ID = "auth-router";

const PROVIDER_ROW_PREFIX = "provider-";

/**
 * Rows whose id does not start with their provider's id. The Claude
 * compact-early mirror is a Claude-only row named after VibeAllDay.
 */
const ROW_OWNER_OVERRIDES: Readonly<Record<string, string>> = {
  "provider-vibeallday-compact-early": "claude",
};

/**
 * Merge server detection status with client-side metadata. A Claude Ollama
 * entry the server does not report, and a Gateway entry on a server without
 * Gateway support, are left out.
 */
export function buildProviderDisplayList(
  serverProviders: readonly ProviderInfo[],
  supportsClaudeGateway: boolean,
) {
  return getAllProviders().flatMap((clientProvider) => {
    const serverInfo = serverProviders.find(
      (p) => p.name === clientProvider.id,
    );
    if (clientProvider.id === "claude-ollama" && !serverInfo) return [];
    if (
      clientProvider.id === "claude-gateway" &&
      !serverInfo &&
      !supportsClaudeGateway
    ) {
      return [];
    }
    return [
      {
        ...clientProvider,
        installed: serverInfo?.installed ?? false,
        applicationDetected: serverInfo?.applicationDetected,
        authenticated: serverInfo?.authenticated ?? false,
        enabled: serverInfo?.enabled ?? false,
        loginCommand: serverInfo?.loginCommand,
        supportsInAppLogin: serverInfo?.supportsInAppLogin === true,
        supportsHostTerminalLogin:
          serverInfo?.supportsHostTerminalLogin === true,
        additionalModelOptions: serverInfo?.additionalModelOptions,
        supportsLaunchCompactPercentOverride:
          serverInfo?.supportsLaunchCompactPercentOverride === true,
        userEmail: serverInfo?.user?.email,
        modelCount: serverInfo?.models?.length ?? 0,
      },
    ];
  });
}

/** Same signal the per-provider row prints as "Authentication: …". */
export function providerIsAuthenticated(entry: {
  authenticated: boolean;
  enabled: boolean;
}): boolean {
  return entry.authenticated || entry.enabled;
}

export function providerReadiness(entry: {
  installed: boolean;
  authenticated: boolean;
  enabled: boolean;
}): ProviderReadiness {
  if (!entry.installed) return "missing";
  return providerIsAuthenticated(entry) ? "ready" : "needs-auth";
}

/**
 * The provider detail page that renders a settings row, so a search jump
 * that lands on the overview can continue to the page holding the row.
 * The longest matching provider id wins (`claude-gateway` over `claude`).
 */
export function providerDetailForRow(
  rowId: string,
  providerIds: readonly string[],
): string | null {
  const override = ROW_OWNER_OVERRIDES[rowId];
  if (override) return providerIds.includes(override) ? override : null;
  if (!rowId.startsWith(PROVIDER_ROW_PREFIX)) return null;
  const rest = rowId.slice(PROVIDER_ROW_PREFIX.length);
  const owners = providerIds.filter(
    (id) => rest === id || rest.startsWith(`${id}-`),
  );
  if (owners.length === 0) return null;
  return owners.reduce((longest, id) =>
    id.length > longest.length ? id : longest,
  );
}
