import type { ProviderName } from "./types.js";

export type ProviderSubscriptionUsageScope =
  | {
      type: "provider";
      /** A provider-wide sub-bucket, when it is narrower than all account use. */
      category?: "oauthApps";
    }
  | {
      type: "models";
      /** VIBEALLDAY model ids to which this provider bucket applies. */
      modelIds: string[];
      /** Provider-supplied bucket/model label for display and diagnostics. */
      label?: string;
    };

export interface ProviderSubscriptionUsageWindow {
  /** Stable within one provider response; opaque to clients. */
  id: string;
  /** Provider-reported utilization, normalized to the inclusive 0-100 range. */
  usedPercent: number;
  /** Rolling-window duration when the provider reports or defines it. */
  windowDurationMinutes?: number;
  /** ISO 8601 reset timestamp when the provider reports one. */
  resetsAt?: string;
  scope: ProviderSubscriptionUsageScope;
}

/**
 * Read-only account/subscription quota state. This is separate from session
 * token accounting: it may combine provider-wide and model-specific windows.
 */
export interface ProviderSubscriptionUsage {
  provider: ProviderName;
  windows: ProviderSubscriptionUsageWindow[];
  fetchedAt: string;
}

export function getApplicableSubscriptionUsageWindows(
  usage: ProviderSubscriptionUsage | null | undefined,
  modelId?: string | null,
): ProviderSubscriptionUsageWindow[] {
  if (!usage) return [];
  return usage.windows.filter(
    (window) =>
      window.scope.type === "provider" ||
      (!!modelId && window.scope.modelIds.includes(modelId)),
  );
}

/**
 * The binding window that belongs to one model alone. Provider-wide windows
 * are deliberately excluded: they apply to every model equally, so repeating
 * one on each row of a model list states it as a per-model number, which it is
 * not. Use {@link getMostUsedSubscriptionUsageWindow} where a single model is
 * in view and the account-wide limit is the one that binds it.
 */
export function getModelSubscriptionUsageWindow(
  usage: ProviderSubscriptionUsage | null | undefined,
  modelId: string | null | undefined,
): ProviderSubscriptionUsageWindow | null {
  if (!usage || !modelId) return null;
  let mostUsed: ProviderSubscriptionUsageWindow | null = null;
  for (const window of usage.windows) {
    if (window.scope.type !== "models") continue;
    if (!window.scope.modelIds.includes(modelId)) continue;
    if (!mostUsed || window.usedPercent > mostUsed.usedPercent) {
      mostUsed = window;
    }
  }
  return mostUsed;
}

/** The account-wide binding window, independent of any model. */
export function getAccountSubscriptionUsageWindow(
  usage: ProviderSubscriptionUsage | null | undefined,
): ProviderSubscriptionUsageWindow | null {
  if (!usage) return null;
  let mostUsed: ProviderSubscriptionUsageWindow | null = null;
  for (const window of usage.windows) {
    if (window.scope.type !== "provider") continue;
    if (!mostUsed || window.usedPercent > mostUsed.usedPercent) {
      mostUsed = window;
    }
  }
  return mostUsed;
}

/**
 * Return the binding quota window for a model: maximum percent used, which is
 * equivalently the smallest remaining capacity.
 */
export function getMostUsedSubscriptionUsageWindow(
  usage: ProviderSubscriptionUsage | null | undefined,
  modelId?: string | null,
): ProviderSubscriptionUsageWindow | null {
  const applicable = getApplicableSubscriptionUsageWindows(usage, modelId);
  let mostUsed: ProviderSubscriptionUsageWindow | null = null;
  for (const window of applicable) {
    if (!mostUsed || window.usedPercent > mostUsed.usedPercent) {
      mostUsed = window;
    }
  }
  return mostUsed;
}
