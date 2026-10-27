import type { ReactNode } from "react";
import styles from "./Pill.module.css";

/** Semantic map: mint running/ok, rose needs you/error, peach attention,
 *  sand pending/unread, indigo selected/info, grey idle/stopped. */
export type PillTone = "mint" | "rose" | "peach" | "sand" | "indigo" | "grey";

const TONE_CLASS: Record<PillTone, string | undefined> = {
  mint: styles.mint,
  rose: styles.rose,
  peach: styles.peach,
  sand: styles.sand,
  indigo: styles.indigo,
  grey: styles.grey,
};

interface PillProps {
  tone?: PillTone;
  /** Leading status dot; `pulse` animates it for live work. */
  dot?: boolean | "pulse";
  children: ReactNode;
  className?: string;
  title?: string;
}

export function Pill({
  tone = "grey",
  dot = false,
  children,
  className,
  title,
}: PillProps) {
  return (
    <span
      className={`${styles.pill} ${TONE_CLASS[tone]}${className ? ` ${className}` : ""}`}
      title={title}
    >
      {dot ? (
        <span
          className={`${styles.dot}${dot === "pulse" ? ` ${styles.pulse}` : ""}`}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}
