import type { ReactNode } from "react";
import styles from "./Count.module.css";

export type CountTone = "default" | "attn" | "accent";

const TONE_CLASS: Record<CountTone, string | undefined> = {
  default: undefined,
  attn: styles.attn,
  accent: styles.accent,
};

interface CountProps {
  children: ReactNode;
  /** `attn` for needs-you totals, `accent` for selection totals. */
  tone?: CountTone;
  className?: string;
  /** Accessible name when the number alone is ambiguous. */
  label?: string;
}

/** Mono count capsule (design .count), e.g. a nav or tab badge. */
export function Count({
  children,
  tone = "default",
  className,
  label,
}: CountProps) {
  const classes = [styles.count, TONE_CLASS[tone], className]
    .filter(Boolean)
    .join(" ");
  if (label) {
    return (
      <span className={classes} role="img" aria-label={label}>
        {children}
      </span>
    );
  }
  return <span className={classes}>{children}</span>;
}
