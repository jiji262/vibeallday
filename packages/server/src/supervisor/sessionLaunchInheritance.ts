import {
  type EffortLevel,
  type PermissionMode,
  type ThinkingConfig,
  type ThinkingOption,
  thinkingOptionToConfig,
} from "@vibeallday/shared";
import type { EffectiveSessionLaunchSettingsValue } from "../metadata/index.js";

/**
 * Settings a successor session is explicitly asked to launch with. An
 * undefined field inherits the source's; a null service tier asks for the
 * provider default.
 */
export interface SuccessorLaunchOverrides {
  requestedModel?: string;
  thinking?: ThinkingOption;
  /** Orthogonal to `thinking`: a thinking override does not clear it. */
  ultracode?: boolean;
  serviceTier?: string | null;
  permissionMode?: PermissionMode;
}

export interface SuccessorLaunchSettings {
  requestedModel: string | undefined;
  thinking: ThinkingConfig | undefined;
  effort: EffortLevel | undefined;
  ultracode: boolean | undefined;
  serviceTier: string | undefined;
  permissionMode: PermissionMode | undefined;
}

/**
 * Whether the successor runs the model the source ran. A fork re-states the
 * source's own model, which counts as keeping it; only a request that names a
 * different one is a model change.
 */
function keepsSourceModel(
  source: EffectiveSessionLaunchSettingsValue | undefined,
  inheritance: { sameProvider: boolean },
  overrides: SuccessorLaunchOverrides,
): boolean {
  if (!inheritance.sameProvider) return false;
  if (overrides.requestedModel === undefined) return true;
  return overrides.requestedModel === (source?.requestedModel ?? undefined);
}

/**
 * Successor launch inheritance: the launch settings a restart, handoff, or
 * fork starts with. Each explicit override wins. Otherwise the model,
 * thinking, effort, and service tier come from the source's recorded launch
 * settings only when the successor keeps the source's provider (falling back
 * to the source's legacy requested model), while the permission mode is
 * inherited across providers.
 */
export function inheritSuccessorLaunchSettings(
  source: EffectiveSessionLaunchSettingsValue | undefined,
  inheritance: {
    sameProvider: boolean;
    /** Read only when neither an override nor the source names a model. */
    legacyRequestedModel?: () => string | undefined;
  },
  overrides: SuccessorLaunchOverrides,
): SuccessorLaunchSettings {
  const providerSource = inheritance.sameProvider ? source : undefined;
  const thinking =
    overrides.thinking !== undefined
      ? thinkingOptionToConfig(overrides.thinking)
      : {
          thinking: providerSource?.thinking ?? undefined,
          effort: providerSource?.effort ?? undefined,
        };
  return {
    requestedModel:
      overrides.requestedModel ??
      providerSource?.requestedModel ??
      (inheritance.sameProvider
        ? inheritance.legacyRequestedModel?.()
        : undefined),
    thinking: thinking.thinking,
    effort: thinking.effort,
    // Read from the source even when a thinking override replaced the effort
    // above: a ThinkingOption cannot express ultracode, so deriving it from
    // one would silently drop a standing selection. An override that moves
    // the successor to a different model drops it instead, because the
    // selection was made against the source model's capabilities and this
    // helper has no catalog to re-check them against.
    ultracode:
      overrides.ultracode ??
      (keepsSourceModel(source, inheritance, overrides)
        ? providerSource?.ultracode
        : undefined),
    serviceTier:
      overrides.serviceTier !== undefined
        ? (overrides.serviceTier ?? undefined)
        : (providerSource?.serviceTier ?? undefined),
    permissionMode: overrides.permissionMode ?? source?.permissionMode,
  };
}
