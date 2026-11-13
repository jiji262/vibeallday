import type { ReactNode } from "react";
import styles from "./StatusDot.module.css";

/**
 * The six design states. Each pairs a colour with a shape, so state never
 * depends on colour alone: attn filled circle, run circle with a halo, idle
 * hollow ring, err square/diamond (per skin), queued dashed ring, ok check.
 */
export type StatusState = "attn" | "run" | "idle" | "err" | "queued" | "ok";

const STATE_CLASS: Record<StatusState, string | undefined> = {
  attn: styles.attn,
  run: styles.run,
  idle: styles.idle,
  err: styles.err,
  queued: styles.queued,
  ok: styles.ok,
};

function join(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

interface StatusDotProps {
  state: StatusState;
  /** Accessible name when the dot stands alone; decorative otherwise. */
  label?: string;
  className?: string;
}

/**
 * Bare status marker. The run halo pulses only while an ancestor registered
 * with `observeViewportActivityAnimation` sets `--activity-play: running`;
 * it never starts an observer or timer of its own.
 */
export function StatusDot({ state, label, className }: StatusDotProps) {
  const classes = join(styles.marker, STATE_CLASS[state], className);
  if (label) {
    return (
      <span
        className={classes}
        data-status={state}
        role="img"
        aria-label={label}
      />
    );
  }
  return <span className={classes} data-status={state} aria-hidden="true" />;
}

interface StatusProps {
  state: StatusState;
  children: ReactNode;
  /** Drops the soft fill and padding, leaving marker plus text. */
  plain?: boolean;
  className?: string;
  title?: string;
}

/** Status pill: the marker plus a short label on the state's soft fill. */
export function Status({
  state,
  children,
  plain = false,
  className,
  title,
}: StatusProps) {
  return (
    <span
      className={join(
        styles.status,
        STATE_CLASS[state],
        plain && styles.plain,
        className,
      )}
      data-status={state}
      title={title}
    >
      <span className={join(styles.marker, STATE_CLASS[state])} />
      {children}
    </span>
  );
}
