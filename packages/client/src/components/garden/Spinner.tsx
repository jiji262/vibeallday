import type { CSSProperties } from "react";
import styles from "./Spinner.module.css";

export type SpinnerSize = 12 | 14 | 16 | 24 | 32;
export type SpinnerTone = "indigo" | "current" | "muted";

const TONE_CLASS: Record<SpinnerTone, string | undefined> = {
  indigo: undefined,
  current: styles.current,
  muted: styles.muted,
};

interface SpinnerProps {
  size?: SpinnerSize;
  /** `current` follows the text color, e.g. inside a filled button. */
  tone?: SpinnerTone;
  /** Announces the wait; without it the spinner is decorative. */
  label?: string;
  className?: string;
}

/** The app's single spinner. Prefer `LoadingState` for whole regions. */
export function Spinner({
  size = 16,
  tone = "indigo",
  label,
  className,
}: SpinnerProps) {
  const classes = [styles.spinner, TONE_CLASS[tone], className]
    .filter(Boolean)
    .join(" ");
  const style = { "--spinner-size": `${size}px` } as CSSProperties;
  if (!label) {
    return <span className={classes} style={style} aria-hidden="true" />;
  }
  return (
    <span className={classes} style={style} role="status" aria-label={label} />
  );
}
