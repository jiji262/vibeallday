import { Children, type ReactNode, useId } from "react";
import styles from "./SessionMenu.module.css";

/**
 * One labelled section of the session menu. Sections whose entries are all
 * unavailable render nothing, so no empty label or stray separator shows.
 */
export function SessionMenuGroup({
  label,
  tone = "default",
  children,
}: {
  /** Mono group label; the danger zone has none, only its separator. */
  label?: string;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  const labelId = useId();
  if (Children.toArray(children).length === 0) return null;
  return (
    <div
      className={`${styles.group}${tone === "danger" ? ` ${styles.dangerGroup}` : ""}`}
      role="group"
      aria-labelledby={label ? labelId : undefined}
    >
      {label && (
        <div id={labelId} className={styles.groupLabel}>
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * The folded "More" section: rarely used entries stay out of the way until
 * the reader opens it, keeping the menu short.
 */
export function SessionMenuMoreGroup({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  if (Children.toArray(children).length === 0) return null;
  return (
    <div className={styles.group}>
      <button
        type="button"
        className={styles.moreToggle}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className={styles.groupLabelText}>{label}</span>
        <svg
          className={styles.moreChevron}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && children}
    </div>
  );
}
