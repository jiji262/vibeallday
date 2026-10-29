import type { ReactNode } from "react";
import styles from "./ListToolbar.module.css";

interface ListToolbarProps {
  /** Usually a `SearchField`. */
  search?: ReactNode;
  /** Selects, chips or a SegmentedControl after the search. */
  filters?: ReactNode;
  /** Mono summary, e.g. "133 / 237 个项目 · 已应用 1 筛选". */
  count?: ReactNode;
  /** Right-aligned controls: view options or the primary action. */
  actions?: ReactNode;
  /** Accessible name for the control group. */
  label?: string;
  className?: string;
}

/**
 * The list-page filter bar: search, filters, then the count and actions
 * pushed right. Below 768px the search takes a full row and the count and
 * actions share the last one.
 */
export function ListToolbar({
  search,
  filters,
  count,
  actions,
  label,
  className,
}: ListToolbarProps) {
  const classes = className ? `${styles.toolbar} ${className}` : styles.toolbar;
  return (
    <div className={classes} role="group" aria-label={label}>
      {search ? <div className={styles.search}>{search}</div> : null}
      {filters ? <div className={styles.filters}>{filters}</div> : null}
      {count || actions ? (
        <div className={styles.end}>
          {count ? <p className={styles.count}>{count}</p> : null}
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
