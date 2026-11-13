import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";
import { InboxIcon } from "./icons";

interface EmptyStateProps {
  title: ReactNode;
  hint?: ReactNode;
  /** One next step, usually a secondary sm or primary Button. */
  action?: ReactNode;
  /** Replaces the default inbox glyph inside the dashed tile. */
  icon?: ReactNode;
  /** Inside a card or table: no border or tile, quiet 14px copy. */
  compact?: boolean;
}

/** An empty view is an invitation to act: tile, title, hint, one action. */
export function EmptyState({
  title,
  hint,
  action,
  icon,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={compact ? `${styles.empty} ${styles.compact}` : styles.empty}
    >
      {compact ? null : (
        <div className={styles.mark} aria-hidden="true">
          {icon ?? <InboxIcon />}
        </div>
      )}
      <h2 className={styles.title}>{title}</h2>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
