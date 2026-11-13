import type { GitStatusInfo } from "@vibeallday/shared";
import { useCallback, useRef, useState } from "react";
import { Button } from "../components/garden/Button";
import { MoreHorizontalIcon } from "../components/garden/icons";
import { ActionSheet, type ActionSheetItem } from "../components/garden/Sheet";
import type { ModalAnchorRect } from "../components/ui/Modal";
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
import {
  ActionIndicator,
  PauseToggleButton,
  type SourceActionButtonProps,
  sourceActionButtons,
  useRecentOutcome,
} from "./SourceActionControls";
import styles from "./SourceActionControls.module.css";

const MENU_ICON_SIZE = 16;

type SyncAheadBehind = Pick<GitStatusInfo, "ahead" | "behind">;

/**
 * The operation Sync runs: pull when the upstream is ahead, push when only
 * local commits wait, otherwise a remote check. Falls back to whatever the
 * server supports.
 */
function pickSyncAction(
  buttons: readonly SourceActionButtonProps[],
  status: SyncAheadBehind,
): SourceActionButtonProps | undefined {
  const byAction = (action: SourceActionButtonProps["action"]) =>
    buttons.find((button) => button.action === action);
  const preferred =
    status.behind > 0
      ? byAction("pull")
      : status.ahead > 0
        ? byAction("push")
        : byAction("check");
  return preferred ?? buttons[0];
}

function syncTitle(
  action: SourceActionButtonProps,
  status: SyncAheadBehind,
  t: TranslationFn,
): string {
  const base =
    action.action === "pull"
      ? t("sourceSyncPullTitle", { count: status.behind })
      : action.action === "push"
        ? t("sourceSyncPushTitle", { count: status.ahead })
        : t("sourceSyncCheckTitle");
  return action.feedback ? `${base} · ${action.feedback}` : base;
}

function syncCountLabel(status: SyncAheadBehind): string {
  return [
    status.ahead > 0 ? `↑${status.ahead}` : "",
    status.behind > 0 ? `↓${status.behind}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function menuItems(
  buttons: readonly SourceActionButtonProps[],
): ActionSheetItem[] {
  return buttons.map((button) => ({
    key: button.action,
    label: button.label,
    hint: button.title ?? (button.feedback || undefined),
    icon: (
      <ActionIndicator
        action={button.action}
        running={button.running}
        outcome={null}
      />
    ),
    disabled: button.disabled,
    onSelect: button.onClick,
  }));
}

/**
 * Repository operations in the identity bar (design Git boards): one Sync
 * action that runs the operation the branch needs, and an overflow menu with
 * pull, push, and remote check under their existing labels.
 */
export function SourceSyncControls({
  gitActions,
  status,
  worktreePaused,
  onToggleWorktreePaused,
  t,
}: {
  gitActions: GitActionState;
  status: SyncAheadBehind;
  worktreePaused?: boolean;
  onToggleWorktreePaused?: () => void;
  t: TranslationFn;
}) {
  const nowMs = useRelativeNow();
  const remoteTitle = t("gitStatusLastCheckedRemote", {
    time: formatRemoteCheckTime(gitActions.checkedRemoteAt, nowMs, t),
  });
  const buttons = sourceActionButtons(gitActions, remoteTitle, t);
  const primary = pickSyncAction(buttons, status);
  return (
    <div className={styles.actionGroup} data-source-action-group>
      {primary ? (
        <SyncSplit primary={primary} buttons={buttons} status={status} t={t} />
      ) : null}
      {onToggleWorktreePaused && (
        <PauseToggleButton
          paused={worktreePaused === true}
          onToggle={onToggleWorktreePaused}
          iconOnly
          t={t}
        />
      )}
    </div>
  );
}

function anchorFor(element: HTMLElement | null): ModalAnchorRect | null {
  if (!element) return null;
  const { top, right, bottom, left, width, height } =
    element.getBoundingClientRect();
  return { top, right, bottom, left, width, height };
}

function SyncSplit({
  primary,
  buttons,
  status,
  t,
}: {
  primary: SourceActionButtonProps;
  buttons: readonly SourceActionButtonProps[];
  status: SyncAheadBehind;
  t: TranslationFn;
}) {
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<ModalAnchorRect | null>(null);
  const closeMenu = useCallback(() => {
    setAnchor(null);
    toggleRef.current?.focus();
  }, []);
  const showOutcome = useRecentOutcome(primary.tone, primary.feedback);
  const outcome = showOutcome ? primary.tone : null;
  const label = t("sourceSyncAction");
  const counts = syncCountLabel(status);
  const menuLabel = t("sourceSyncMenuLabel");
  return (
    <span className={styles.split}>
      <Button
        size="sm"
        className={`${sourceActionClassName("", outcome, primary.running)} ${styles.splitMain}`}
        title={syncTitle(primary, status, t)}
        aria-label={sourceActionAriaLabel(
          label,
          primary.runningLabel,
          primary.running,
          primary.feedback,
        )}
        aria-busy={primary.running || undefined}
        disabled={primary.disabled}
        onClick={primary.onClick}
        icon={
          <ActionIndicator
            action={primary.action}
            running={primary.running}
            outcome={outcome}
          />
        }
      >
        <span className={styles.actionLabel}>{label}</span>
        {counts ? <span className={styles.syncCounts}>{counts}</span> : null}
      </Button>
      <Button
        ref={toggleRef}
        size="sm"
        className={`${styles.action} ${styles.splitToggle}`}
        aria-label={menuLabel}
        title={menuLabel}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={() => setAnchor(anchor ? null : anchorFor(toggleRef.current))}
      >
        <MoreHorizontalIcon size={MENU_ICON_SIZE} />
      </Button>
      {anchor ? (
        <ActionSheet
          title={menuLabel}
          items={menuItems(buttons)}
          anchorRect={anchor}
          onClose={closeMenu}
        />
      ) : null}
    </span>
  );
}
