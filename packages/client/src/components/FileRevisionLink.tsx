import {
  GIT_FILE_REVISION_CAPABILITY,
  type GitFileRevision,
  type GitFileRevisionCommit,
  serverHasCapability,
} from "@vibeallday/shared";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useRetainedVersionInfo } from "../hooks/useVersion";
import { useI18n } from "../i18n";
import { toBrowserAppHref } from "../lib/appHref";
import { useClientSummarySourceKey } from "../lib/clientSummaryStore";
import styles from "./FileRevisionLink.module.css";
import { ResourceContextMenu } from "./FileResourceActions";
import { formatProjectAge } from "./projectRelativeTime";

export interface FileRevisionLinkProps {
  projectId: string;
  path: string;
  /** Immutable content revision; omission describes the live filesystem. */
  rev?: string;
  /** Historical path for a live, not-yet-committed rename. */
  origPath?: string;
  dirtyLabel: string;
  uncommittedLabel: string;
  className?: string;
}

/** Compact last-revision provenance shared by every file-viewing surface. */
export function FileRevisionLink({
  projectId,
  path,
  rev,
  origPath,
  dirtyLabel,
  uncommittedLabel,
  className,
}: FileRevisionLinkProps) {
  const sourceKey = useClientSummarySourceKey();
  const version = useRetainedVersionInfo(sourceKey);
  const basePath = useRemoteBasePath();
  const supported = serverHasCapability(version, GIT_FILE_REVISION_CAPABILITY);
  const identity = `${sourceKey}\0${projectId}\0${path}\0${rev ?? ""}\0${origPath ?? ""}`;
  const [loaded, setLoaded] = useState<{
    identity: string;
    value: GitFileRevision | null;
  }>({ identity, value: null });
  const revision = loaded.identity === identity ? loaded.value : null;
  const [contextMenu, setContextMenu] = useState<{
    identity: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!supported || !projectId || !path) return;
    let cancelled = false;
    void api
      .getGitFileRevision(projectId, { path, rev, origPath })
      .then((value) => {
        if (!cancelled) setLoaded({ identity, value });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ identity, value: null });
      });
    return () => {
      cancelled = true;
    };
  }, [identity, origPath, path, projectId, rev, supported]);

  if (!supported || !revision?.isGitRepo) return null;
  if (!revision.commit) {
    return (
      <span
        className={`${styles.root} ${styles.uncommitted} ${className ?? ""}`}
      >
        {uncommittedLabel}
      </span>
    );
  }

  const params = new URLSearchParams({
    projectId,
    rev: revision.commit.hash,
    commitFile: rev ? path : (origPath ?? path),
  });
  const href = toBrowserAppHref(`${basePath}/git-status?${params.toString()}`);
  const tooltip = formatRevisionTooltip(revision.commit);

  return (
    <span className={`${styles.root} ${className ?? ""}`}>
      <a
        className={styles.commit}
        href={href}
        title={tooltip}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setContextMenu({ identity, x: event.clientX, y: event.clientY });
        }}
      >
        {revision.commit.shortHash}
      </a>
      <RevisionAge authorDate={revision.commit.authorDate} />
      {revision.dirty && <span className={styles.dirty}>{dirtyLabel}</span>}
      {contextMenu?.identity === identity && (
        <ResourceContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onOpen={() => window.open(href, "_blank", "noopener,noreferrer")}
          fileTarget={{
            projectId,
            path: rev ? path : (origPath ?? path),
            rev: revision.commit.hash,
          }}
        />
      )}
    </span>
  );
}

/** Localized commit age; a child so only a rendered commit needs i18n. */
function RevisionAge({ authorDate }: { authorDate: string }) {
  const { t } = useI18n();
  const age = formatProjectAge(authorDate, t);
  return age ? <span className={styles.age}>({age})</span> : null;
}

export function formatRevisionTooltip(commit: GitFileRevisionCommit): string {
  const absoluteTime = new Date(commit.authorDate).toLocaleString();
  const message = `${commit.message}${commit.messageTruncated ? "\n..." : ""}`;
  return `${commit.authorName}\n${absoluteTime}\n\n${message}`;
}
