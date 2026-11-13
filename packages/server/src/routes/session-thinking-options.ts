import {
  thinkingOptionToConfig,
  type EffortLevel,
  type ShowThinking,
  type ThinkingConfig,
  type ThinkingOption,
} from "@vibeallday/shared";

interface ThinkingOptionsBody {
  thinking?: ThinkingOption;
  showThinking?: ShowThinking;
  ultracode?: boolean;
}

export interface SessionThinkingOptions {
  thinking: ThinkingConfig | undefined;
  effort?: EffortLevel;
  ultracode?: boolean;
}

export function buildThinkingOptions(
  body: ThinkingOptionsBody,
): SessionThinkingOptions {
  const selected = body.thinking
    ? thinkingOptionToConfig(body.thinking, body.showThinking)
    : { thinking: undefined, effort: undefined };
  // Read independently of the ThinkingOption, which cannot express it, and
  // left absent rather than false when the request says nothing.
  return typeof body.ultracode === "boolean"
    ? { ...selected, ultracode: body.ultracode }
    : selected;
}
