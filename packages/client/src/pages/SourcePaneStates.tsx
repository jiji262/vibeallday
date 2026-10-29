import type { ReactNode } from "react";
import { EmptyState } from "../components/garden/EmptyState";
import { ErrorState } from "../components/garden/ErrorState";
import { LoadingState } from "../components/garden/LoadingState";
import { SkeletonText } from "../components/garden/Skeleton";
import styles from "./SourcePaneStates.module.css";

/** Placeholder code lines under the diff caption while a diff loads. */
const DIFF_SKELETON_LINES = 8;

/**
 * Loading, empty, and error states inside Source Control panes (file lists,
 * revision lists, blame, diffs). They sit inside a pane that already has its
 * own frame, so they use the compact garden variants.
 */
export function SourcePaneLoading({ label }: { label: string }) {
  return (
    <div className={styles.pane}>
      <LoadingState label={label} variant="compact" />
    </div>
  );
}

/** Diff-shaped wait: caption plus code-line skeletons. */
export function SourceDiffLoading({ label }: { label: string }) {
  return (
    <div className={styles.diff}>
      <LoadingState label={label} variant="compact" />
      <SkeletonText lines={DIFF_SKELETON_LINES} className={styles.lines} />
    </div>
  );
}

export function SourcePaneEmpty({
  title,
  hint,
}: {
  title: ReactNode;
  hint?: ReactNode;
}) {
  return <EmptyState compact title={title} hint={hint} />;
}

export function SourcePaneError({
  message,
  className,
}: {
  message: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `${styles.pane} ${className}` : styles.pane}>
      <ErrorState inline message={message} />
    </div>
  );
}
