import styles from "./SourceActionControls.module.css";

type SourceOutcome = "success" | "warning";

const OUTCOME_CLASS: Record<SourceOutcome, string | undefined> = {
  success: styles.success,
  warning: styles.warning,
};

/** Class list for a source action button, in a stable order. */
export function sourceActionClassName(
  className: string,
  outcome: SourceOutcome | null,
  running: boolean,
): string {
  return [
    styles.action,
    className,
    outcome ? OUTCOME_CLASS[outcome] : "",
    running ? "git-status-action-running" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Accessible name: running state wins over the last result. */
export function sourceActionAriaLabel(
  label: string,
  runningLabel: string,
  running: boolean,
  feedback: string,
): string {
  if (running) return `${label}: ${runningLabel}`;
  return feedback ? `${label}: ${feedback}` : label;
}
