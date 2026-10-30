import type { ReactNode } from "react";
import styles from "./Badge.module.css";

/**
 * Design families: attn (needs you), run (working), err, ok (done), accent
 * (selected/info), idle. The older names stay valid and map onto them:
 * mint = ok, rose = err, peach and sand = attn, indigo = accent, grey = idle;
 * outline is the dashed archived/inert look.
 */
export type BadgeTone =
  | "attn"
  | "run"
  | "err"
  | "ok"
  | "accent"
  | "idle"
  | "mint"
  | "rose"
  | "peach"
  | "sand"
  | "indigo"
  | "grey"
  | "outline";

const TONE_CLASS: Record<BadgeTone, string | undefined> = {
  attn: styles.attn,
  run: styles.run,
  err: styles.err,
  ok: styles.ok,
  accent: styles.accent,
  idle: styles.idle,
  mint: styles.ok,
  rose: styles.err,
  peach: styles.attn,
  sand: styles.attn,
  indigo: styles.accent,
  grey: styles.idle,
  outline: styles.outline,
};

interface BadgeProps {
  tone?: BadgeTone;
  /** `sm` 22px (default), `md` 24px for detail headers. */
  size?: "sm" | "md";
  /** Leading status dot; `pulse` animates it for live work. */
  dot?: boolean | "pulse";
  children: ReactNode;
  className?: string;
  title?: string;
}

function join(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

/** State pill: 12px semibold on a soft tone fill. Prefer `Status` for the six session states. */
export function Badge({
  tone = "idle",
  size = "sm",
  dot = false,
  children,
  className,
  title,
}: BadgeProps) {
  return (
    <span
      className={join(
        styles.badge,
        size === "md" && styles.md,
        TONE_CLASS[tone],
        className,
      )}
      title={title}
    >
      {dot ? (
        <span
          className={join(styles.dot, dot === "pulse" && styles.pulse)}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}

interface TagProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  title?: string;
}

/** Event tag: mono 11px, hairline outline, same tones as Badge. */
export function Tag({ tone = "idle", children, className, title }: TagProps) {
  return (
    <span
      className={join(styles.tag, TONE_CLASS[tone], className)}
      title={title}
    >
      {children}
    </span>
  );
}
