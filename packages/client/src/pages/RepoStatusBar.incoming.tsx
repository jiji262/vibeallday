import type { GitIncomingCommitListResult } from "@vibeallday/shared";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { EmptyState } from "../components/garden/EmptyState";
import { ErrorState } from "../components/garden/ErrorState";
import { LoadingState } from "../components/garden/LoadingState";
import { Modal } from "../components/ui/Modal";
import type { TranslationFn } from "../i18n";
import { formatCommitDateTime } from "./CommitFilesPane";
import styles from "./RepoStatusBar.module.css";

/** Commits from the last remote check that the local branch lacks. */
export function IncomingCommitsDialog({
  projectId,
  onClose,
  t,
}: {
  projectId: string;
  onClose: () => void;
  t: TranslationFn;
}) {
  const [result, setResult] = useState<GitIncomingCommitListResult | null>(
    null,
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getGitIncomingCommits(projectId)
      .then((nextResult) => {
        if (active) setResult(nextResult);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  return (
    <Modal
      variant="dialog"
      title={t("sourceIncomingCommitsTitle")}
      onClose={onClose}
    >
      <div className={styles.incomingDialog}>
        <p className={styles.incomingIntro}>
          {t("sourceIncomingCommitsDescription")}
        </p>
        {error ? (
          <ErrorState inline message={t("sourceIncomingCommitsError")} />
        ) : result === null ? (
          <LoadingState
            variant="compact"
            label={t("sourceIncomingCommitsLoading")}
          />
        ) : result.commits.length === 0 ? (
          <EmptyState
            compact
            title={t("sourceIncomingCommitsEmpty", {
              upstream: result.upstream,
            })}
          />
        ) : (
          <>
            <ul className={styles.incomingList}>
              {result.commits.map((commit) => (
                <li key={commit.hash} className={styles.incomingCommit}>
                  <span className={styles.incomingCommitHeader}>
                    <code title={commit.hash}>{commit.shortHash}</code>
                    <strong className={styles.incomingSubject}>
                      {commit.subject}
                    </strong>
                  </span>
                  <span className={styles.incomingMeta}>
                    {commit.authorName} ·{" "}
                    {formatCommitDateTime(commit.authorDate)}
                  </span>
                </li>
              ))}
            </ul>
            {result.truncated && (
              <p className={styles.incomingTruncated}>
                {t("sourceIncomingCommitsTruncated", { count: result.limit })}
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
