import type { Query, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import {
  resolveTurnEffort,
  thinkingOptionToConfig,
  type EffortLevel,
  type ModelInfo,
  type ThinkingConfig,
  type ThinkingOption,
} from "@vibeallday/shared";
import type { QueuedSDKUserMessage } from "../messageQueue.js";

type ClaudeFlagQuery = Pick<
  Query,
  "setMaxThinkingTokens" | "applyFlagSettings"
>;

export interface ClaudeTurnEffortOptions {
  query: () => ClaudeFlagQuery;
  model: () => Promise<ModelInfo>;
  thinking?: ThinkingConfig;
  effort?: EffortLevel;
  /** Standing ultracode selection for the session, independent of effort. */
  ultracode?: boolean;
}

/**
 * The session's single issuer of effort and ultracode flag settings. Both keys
 * travel together on every write because an `effortLevel` that moves the
 * session to a different level, sent without an `ultracode` key, also turns
 * ultracode off — so a per-turn effort modifier would silently clear a
 * standing ultracode selection.
 */
export class ClaudeTurnEffort {
  private overridden = false;
  private readonly query: () => ClaudeFlagQuery;
  private readonly model: () => Promise<ModelInfo>;
  private thinking?: ThinkingConfig;
  private effort?: EffortLevel;
  private ultracode?: boolean;

  constructor(options: ClaudeTurnEffortOptions) {
    this.query = options.query;
    this.model = options.model;
    this.thinking = options.thinking;
    this.effort = options.effort;
    this.ultracode = options.ultracode;
  }

  async *input(
    messages: AsyncIterable<QueuedSDKUserMessage>,
  ): AsyncIterable<SDKUserMessage> {
    for await (const message of messages) {
      const { turnEffort, ...providerMessage } = message;
      if (turnEffort) {
        if (this.overridden)
          throw new Error("An effort-modified turn is already active");
        const normal: ThinkingOption =
          this.thinking?.type === "disabled"
            ? "off"
            : this.effort
              ? `on:${this.effort}`
              : "auto";
        const selected = thinkingOptionToConfig(
          resolveTurnEffort(turnEffort, normal, await this.model()),
        );
        await this.apply(selected.thinking, selected.effort);
        this.overridden = true;
      }
      yield providerMessage;
    }
  }

  async complete(): Promise<void> {
    if (!this.overridden) return;
    await this.apply(this.thinking, this.effort);
    this.overridden = false;
  }

  /**
   * Select the session's standing effort and ultracode as one write. Both
   * arguments are the full desired state, not a patch. While an
   * effort-modified turn is active the selection is only stored, because
   * writing it would end that turn's override early; `complete()` applies it.
   */
  async setEffort(effort?: EffortLevel, ultracode?: boolean): Promise<void> {
    this.effort = effort;
    this.ultracode = ultracode;
    if (!this.overridden) await this.applyFlagSettings(effort);
  }

  async setThinking(tokens: number | null): Promise<void> {
    if (!this.overridden) await this.query().setMaxThinkingTokens(tokens);
    this.thinking =
      tokens === 0
        ? { type: "disabled" }
        : tokens === null
          ? undefined
          : { type: "adaptive", display: "summarized" };
  }

  private async applyFlagSettings(effort?: EffortLevel): Promise<void> {
    await this.query().applyFlagSettings({
      effortLevel: effort ?? null,
      // Stated only where this host has an opinion. An explicit `false` turns
      // ultracode off, so asserting one for a session VibeAllDay never
      // configured would silently override whatever the user's own settings
      // files resolved to — these launches read user, project and local
      // sources. A selection VibeAllDay does hold, `true` or `false`, is
      // restated on every write, which is what keeps an effort change from
      // clearing it.
      ...(this.ultracode === undefined ? {} : { ultracode: this.ultracode }),
    });
  }

  private async apply(
    thinking?: ThinkingConfig,
    effort?: EffortLevel,
  ): Promise<void> {
    await this.query().setMaxThinkingTokens(
      thinking?.type === "disabled" ? 0 : thinking ? 1 : null,
      thinking?.type === "adaptive" ? (thinking.display ?? "summarized") : null,
    );
    await this.applyFlagSettings(effort);
  }
}
