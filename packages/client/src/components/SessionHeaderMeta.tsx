import type { ProviderName } from "@vibeallday/shared";
import type { MouseEvent } from "react";
import { useI18n } from "../i18n";
import { Badge, type BadgeTone } from "./garden/Badge";
import { ProviderBadge } from "./ProviderBadge";
import styles from "./SessionHeaderMeta.module.css";

/** What the header's state word says; the tone follows the Garden semantics. */
export type SessionHeaderState =
  | "running"
  | "needs-you"
  | "idle"
  | "stopped"
  | "external";

const STATE_LABEL_KEY = {
  running: "sessionHeaderStateRunning",
  "needs-you": "sessionHeaderStateNeedsYou",
  idle: "sessionHeaderStateIdle",
  stopped: "sessionHeaderStateStopped",
  external: "sessionHeaderStateExternal",
} as const;

const STATE_CLASS: Record<SessionHeaderState, string | undefined> = {
  running: styles.running,
  "needs-you": styles.needsYou,
  idle: styles.quiet,
  stopped: styles.quiet,
  external: styles.external,
};

const STATE_TONE: Record<SessionHeaderState, BadgeTone> = {
  running: "mint",
  "needs-you": "rose",
  idle: "grey",
  stopped: "outline",
  external: "sand",
};

/**
 * Wide-header state pill after the title: mint pulse while a turn runs, rose
 * when the session waits on the reader, grey when idle. Narrow headers carry
 * the same word in their mono meta line instead.
 */
export function SessionHeaderStateBadge({
  state,
  className,
}: {
  state: SessionHeaderState;
  className?: string;
}) {
  const { t } = useI18n();
  const live = state === "running" || state === "needs-you";
  return (
    <Badge
      tone={STATE_TONE[state]}
      dot={state === "running" ? "pulse" : live}
      className={className}
    >
      {t(STATE_LABEL_KEY[state])}
    </Badge>
  );
}

/** Map ownership and process state to the single word the header shows. */
export function getSessionHeaderState(
  owner: "self" | "external" | "none",
  processState: "idle" | "in-turn" | "waiting-input",
  hasPendingInput: boolean,
): SessionHeaderState {
  if (owner === "external") return "external";
  if (owner === "none") return "stopped";
  if (hasPendingInput || processState === "waiting-input") return "needs-you";
  return processState === "in-turn" ? "running" : "idle";
}

interface SessionHeaderModelProps {
  provider: ProviderName;
  model?: string;
  thinking?: { type: string };
  effort?: string;
  isThinking?: boolean;
  state: SessionHeaderState;
  /** Tooltip for the model button (same text the badge button used). */
  title: string;
  onOpen: () => void;
  onOpenInfo: () => void;
}

/**
 * Phone header meta tail: the provider-tinted model and the session state in
 * mono type, after the project link. The model opens the same panel as the
 * wide-header provider badge.
 */
export function SessionHeaderModel({
  provider,
  model,
  thinking,
  effort,
  isThinking,
  state,
  title,
  onOpen,
  onOpenInfo,
}: SessionHeaderModelProps) {
  const { t } = useI18n();
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    onOpenInfo();
  };
  return (
    <>
      <button
        type="button"
        className={`provider-badge-button ${styles.model}`}
        onClick={onOpen}
        onContextMenu={handleContextMenu}
        title={title}
      >
        <ProviderBadge
          flat
          condensed
          provider={provider}
          model={model}
          thinking={thinking}
          effort={effort}
          isThinking={isThinking}
        />
      </button>
      <span
        className={`${styles.state} ${STATE_CLASS[state] ?? ""}`}
        role="status"
      >
        {t(STATE_LABEL_KEY[state])}
      </span>
    </>
  );
}
