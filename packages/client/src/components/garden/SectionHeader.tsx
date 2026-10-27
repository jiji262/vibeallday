import type { ReactNode } from "react";
import styles from "./SectionHeader.module.css";

export type SectionTone = "default" | "rose" | "mint" | "sand";

const TONE_CLASS: Record<SectionTone, string | undefined> = {
  default: styles.default,
  rose: styles.rose,
  mint: styles.mint,
  sand: styles.sand,
};

interface SectionHeaderProps {
  title: ReactNode;
  count?: number;
  /** Trailing control, e.g. a "See all" ghost button. */
  action?: ReactNode;
  /** Colors the count as a state (e.g. rose for "Needs you"). */
  tone?: SectionTone;
  id?: string;
}

export function SectionHeader({
  title,
  count,
  action,
  tone = "default",
  id,
}: SectionHeaderProps) {
  return (
    <div className={styles.header}>
      <h2 className={styles.title} id={id}>
        {title}
        {count !== undefined ? (
          <span className={`${styles.count} ${TONE_CLASS[tone]}`}>{count}</span>
        ) : null}
      </h2>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
