import type { GitStatusInfo } from "@vibeallday/shared";
import { type MouseEvent, useState } from "react";
import { CopyButton } from "../components/CopyButton";
import { Tag } from "../components/garden/Badge";
import { GitBranchIcon } from "../components/garden/icons";
import type { TranslationFn } from "../i18n";
import styles from "./RepoStatusBar.module.css";
import { IncomingCommitsDialog } from "./RepoStatusBar.incoming";

const BRANCH_ICON_SIZE = 13;

/** Activation the browser owns (new tab, download, …), not in-page routing. */
function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

interface RepoStatusBarProps {
  status: GitStatusInfo;
  projectId?: string;
  supportsIncomingCommits?: boolean;
  /** Make a dirty badge open the working-tree Changes mode. */
  onSelectChanges?: () => void;
  /** Standalone URL of the branch tip's commit view, for new-tab opening. */
  headCommitHref?: string;
  /** In-page navigation to that same commit, for plain left-click. */
  onOpenHeadCommit?: () => void;
  /** Caller-supplied placement class for the header region that holds the bar. */
  className?: string;
  t: TranslationFn;
}

/**
 * Persistent repository identity (design Git boards): branch with its copy
 * control, upstream, ahead/behind, and the clean/changed tag in one inset
 * group. Mode navigation and repository actions sit beside it.
 */
export function RepoStatusBar(props: RepoStatusBarProps) {
  const { status, projectId, supportsIncomingCommits = false, t } = props;
  const [incomingOpen, setIncomingOpen] = useState(false);
  const outOfSync = status.ahead > 0 || status.behind > 0;
  const warn = !status.isClean || outOfSync;
  const previewsIncoming =
    supportsIncomingCommits &&
    projectId !== undefined &&
    status.upstream !== null;
  return (
    <>
      <div
        data-testid="repo-status-bar"
        role="group"
        aria-label={t("sourceRepoStatusLabel")}
        className={[
          styles.bar,
          styles.inline,
          warn ? styles.warn : "",
          props.className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <RepoBranch {...props} />
        {status.upstream && (
          <RepoUpstream
            upstream={status.upstream}
            previewsIncoming={previewsIncoming}
            onOpenIncoming={() => setIncomingOpen(true)}
            t={t}
          />
        )}
        {status.upstream && (
          <>
            <span className={styles.sep} aria-hidden="true" />
            <span className={outOfSync ? styles.syncWarn : styles.sync}>
              {t("sourceAheadBehind", {
                ahead: status.ahead,
                behind: status.behind,
              })}
            </span>
          </>
        )}
        <span className={styles.sep} aria-hidden="true" />
        <RepoStateTag
          status={status}
          onSelectChanges={props.onSelectChanges}
          t={t}
        />
      </div>
      {incomingOpen && projectId && (
        <IncomingCommitsDialog
          projectId={projectId}
          onClose={() => setIncomingOpen(false)}
          t={t}
        />
      )}
    </>
  );
}

function RepoBranch({
  status,
  headCommitHref,
  onOpenHeadCommit,
  t,
}: RepoStatusBarProps) {
  // Detached HEAD has no branch name but still has a tip, so the copy control
  // and the commit link both fall back to that SHA.
  const headCommit = status.recentCommits?.[0];
  const branchLabel = status.branch ?? t("gitStatusDetachedHead");
  const copyValue = status.branch ?? headCommit?.hash;
  return (
    <span className={styles.branch}>
      <GitBranchIcon size={BRANCH_ICON_SIZE} />
      {headCommit && headCommitHref && onOpenHeadCommit ? (
        <a
          className={`${styles.branchName} ${styles.branchLink}`}
          href={headCommitHref}
          title={t("sourceOpenHeadCommit", { commit: headCommit.shortHash })}
          onClick={(event) => {
            if (isModifiedClick(event)) return;
            event.preventDefault();
            onOpenHeadCommit();
          }}
        >
          {branchLabel}
        </a>
      ) : (
        <span className={styles.branchName}>{branchLabel}</span>
      )}
      {copyValue && (
        <CopyButton
          value={copyValue}
          title={
            status.branch ? t("sourceCopyBranch") : t("sourceCopyCommitHash")
          }
          className={styles.copyButton}
        />
      )}
    </span>
  );
}

function RepoUpstream({
  upstream,
  previewsIncoming,
  onOpenIncoming,
  t,
}: {
  upstream: string;
  previewsIncoming: boolean;
  onOpenIncoming: () => void;
  t: TranslationFn;
}) {
  if (!previewsIncoming) {
    return (
      <span className={styles.upstream} title={upstream}>
        → {upstream}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`${styles.upstream} ${styles.upstreamButton}`}
      title={t("sourceOpenIncomingCommits", { upstream })}
      onClick={onOpenIncoming}
    >
      → {upstream}
    </button>
  );
}

/** "N changes" opens Changes when it can; a clean tree reads ok. */
function RepoStateTag({
  status,
  onSelectChanges,
  t,
}: {
  status: GitStatusInfo;
  onSelectChanges?: () => void;
  t: TranslationFn;
}) {
  if (status.isClean) {
    return (
      <Tag tone="ok" className={styles.stateTag}>
        {t("gitStatusClean")}
      </Tag>
    );
  }
  const count = countChangedPaths(status);
  const label =
    count > 0 ? t("sourceChangeCountTag", { count }) : t("gitStatusDirty");
  if (!onSelectChanges) {
    return <Tag className={styles.stateTag}>{label}</Tag>;
  }
  return (
    <button
      type="button"
      className={`${styles.stateTag} ${styles.stateAction}`}
      title={t("sourceOpenChanges")}
      onClick={onSelectChanges}
    >
      {label}
    </button>
  );
}

/** Distinct changed paths; staged and unstaged halves of one file count once. */
export function countChangedPaths(status: GitStatusInfo): number {
  return new Set(status.files.map((file) => file.path)).size;
}
