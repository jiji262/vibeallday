import { useEffect, useState } from "react";
import { Button } from "../components/garden/Button";
import { Spinner } from "../components/garden/Spinner";
import {
  formatRemoteCheckTime,
  type GitActionState,
} from "../hooks/useGitActions";
import { useRelativeNow } from "../hooks/useRelativeNow";
import type { TranslationFn } from "../i18n";
import {
  sourceActionAriaLabel,
  sourceActionClassName,
} from "./SourceActionButtonParts";
import styles from "./SourceActionControls.module.css";

/** How long a finished action shows its outcome mark on the button. */
const OUTCOME_VISIBLE_MS = 6000;
/** Matches the 0.75rem indicator slot, so the button width never moves. */
const RUNNING_SPINNER_SIZE = 12;

type SourceAction = "pull" | "push" | "check";
type SourceOutcome = "success" | "warning";
type SourceGlyph = SourceAction | "pause" | "play";

/**
 * Repository operations for the Source Control intro: pull, push, remote
 * check, and the live-update pause toggle. Each is a small secondary garden
 * button whose leading slot swaps glyph, spinner, and outcome mark in place.
 */
export function SourceHeaderControls({
  gitActions,
  worktreePaused,
  onToggleWorktreePaused,
  t,
}: {
  gitActions: GitActionState;
  worktreePaused?: boolean;
  onToggleWorktreePaused?: () => void;
  t: TranslationFn;
}) {
  const nowMs = useRelativeNow();
  const remoteTitle = t("gitStatusLastCheckedRemote", {
    time: formatRemoteCheckTime(gitActions.checkedRemoteAt, nowMs, t),
  });
  return (
    <div className={styles.actionGroup} data-source-action-group>
      {sourceActionButtons(gitActions, remoteTitle, t).map((props) => (
        <SourceActionButton key={props.action} {...props} />
      ))}
      {onToggleWorktreePaused && (
        <PauseToggleButton
          paused={worktreePaused === true}
          onToggle={onToggleWorktreePaused}
          t={t}
        />
      )}
    </div>
  );
}

/** The supported repository operations, in display order. */
function sourceActionButtons(
  gitActions: GitActionState,
  remoteTitle: string,
  t: TranslationFn,
): SourceActionButtonProps[] {
  const disabled = gitActions.isRunning;
  const buttons: SourceActionButtonProps[] = [];
  if (gitActions.supportsPull) {
    buttons.push({
      action: "pull",
      label: t("gitStatusPull"),
      runningLabel: t("gitStatusPulling"),
      running: gitActions.isPulling,
      feedback: gitActions.pullFeedback,
      tone: gitActions.pullFeedbackTone,
      onClick: gitActions.handlePull,
      disabled,
    });
  }
  if (gitActions.supportsPush) {
    buttons.push({
      action: "push",
      label: t("gitStatusPush"),
      runningLabel: t("gitStatusPushing"),
      running: gitActions.isPushing,
      feedback: gitActions.pushFeedback,
      tone: gitActions.pushFeedbackTone,
      onClick: gitActions.handlePush,
      disabled,
    });
  }
  if (gitActions.supportsRemoteCheck) {
    const feedback = gitActions.checkFeedback;
    buttons.push({
      action: "check",
      label: t("gitStatusCheckRemote"),
      runningLabel: t("gitStatusCheckingRemote"),
      running: gitActions.isCheckingRemote,
      feedback,
      tone: gitActions.checkFeedbackTone,
      title: feedback ? `${feedback} · ${remoteTitle}` : remoteTitle,
      className: styles.checkRemote,
      onClick: gitActions.handleCheckRemote,
      disabled,
    });
  }
  return buttons;
}

function PauseToggleButton({
  paused,
  onToggle,
  t,
}: {
  paused: boolean;
  onToggle: () => void;
  t: TranslationFn;
}) {
  const label = paused
    ? t("sourceResumeLiveUpdates")
    : t("sourcePauseLiveUpdates");
  return (
    <Button
      size="sm"
      className={styles.action}
      aria-pressed={paused}
      title={label}
      onClick={onToggle}
      icon={
        <span className={styles.indicator}>
          <SourceActionGlyph action={paused ? "play" : "pause"} />
        </span>
      }
    >
      <span className={styles.actionLabel}>{label}</span>
    </Button>
  );
}

/** Keeps a finished action's outcome visible briefly after it changes. */
function useRecentOutcome(
  tone: SourceOutcome | null,
  feedback: string,
): boolean {
  // Handlers reset results to null before each run, so feedback passes
  // through "" and retriggers this even when the outcome text repeats.
  const [recent, setRecent] = useState(false);
  useEffect(() => {
    if (!tone || !feedback) {
      setRecent(false);
      return;
    }
    setRecent(true);
    const timer = setTimeout(() => setRecent(false), OUTCOME_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [tone, feedback]);
  return recent && tone !== null && feedback !== "";
}

interface SourceActionButtonProps {
  action: SourceAction;
  label: string;
  runningLabel: string;
  running: boolean;
  feedback: string;
  tone: SourceOutcome | null;
  title?: string;
  className?: string;
  onClick: () => void;
  disabled: boolean;
}

function SourceActionButton({
  action,
  label,
  runningLabel,
  running,
  feedback,
  tone,
  title,
  className = "",
  onClick,
  disabled,
}: SourceActionButtonProps) {
  // The outcome shows on the button itself only briefly after an action
  // completes; the tooltip keeps the detail as long as the result stands.
  const showOutcome = useRecentOutcome(tone, feedback);
  const outcome = showOutcome ? tone : null;
  const classes = sourceActionClassName(className, outcome, running);
  const ariaLabel = sourceActionAriaLabel(
    label,
    runningLabel,
    running,
    feedback,
  );
  return (
    <Button
      size="sm"
      className={classes}
      title={title ?? feedback}
      aria-label={ariaLabel}
      aria-busy={running || undefined}
      onClick={onClick}
      disabled={disabled}
      icon={
        <ActionIndicator action={action} running={running} outcome={outcome} />
      }
    >
      <span className={styles.actionLabel}>{label}</span>
    </Button>
  );
}

const OUTCOME_MARK: Record<SourceOutcome, string> = {
  success: "✓",
  warning: "!",
};

/** The fixed leading slot: spinner while running, then outcome, else glyph. */
function ActionIndicator({
  action,
  running,
  outcome,
}: {
  action: SourceAction;
  running: boolean;
  outcome: SourceOutcome | null;
}) {
  return (
    <span className={styles.indicator}>
      {running ? (
        <Spinner size={RUNNING_SPINNER_SIZE} tone="current" />
      ) : outcome ? (
        OUTCOME_MARK[outcome]
      ) : (
        <SourceActionGlyph action={action} />
      )}
    </span>
  );
}

const GLYPH_PATHS: Record<Exclude<SourceGlyph, "pause" | "play">, string> = {
  check: "M13 5V2.5L11.4 4A5.5 5.5 0 1 0 13.1 10",
  pull: "M8 2v10M4.5 8.5 8 12l3.5-3.5",
  push: "M8 14V4M4.5 7.5 8 4l3.5 3.5",
};

function SourceActionGlyph({ action }: { action: SourceGlyph }) {
  const className = `git-status-action-glyph ${styles.glyph}`;
  if (action === "pause") {
    return (
      <svg
        className={className}
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="currentColor"
      >
        <rect x="4" y="3" width="2.75" height="10" rx="0.6" />
        <rect x="9.25" y="3" width="2.75" height="10" rx="0.6" />
      </svg>
    );
  }
  if (action === "play") {
    return (
      <svg
        className={className}
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="currentColor"
      >
        <path d="M5 3.15 13 8 5 12.85Z" />
      </svg>
    );
  }
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={GLYPH_PATHS[action]} />
    </svg>
  );
}
