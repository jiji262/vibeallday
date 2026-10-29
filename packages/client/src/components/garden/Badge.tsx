import type { ReactNode } from "react";
import styles from "./Badge.module.css";

/** Semantic map: mint running/ok, rose needs you/error, peach attention,
 *  sand pending/unread, indigo selected/info, grey idle/stopped, outline
 *  archived/inert. */
export type BadgeTone =
  | "mint"
  | "rose"
  | "peach"
  | "sand"
  | "indigo"
  | "grey"
  | "outline";

const TONE_CLASS: Record<BadgeTone, string | undefined> = {
  mint: styles.mint,
  rose: styles.rose,
  peach: styles.peach,
  sand: styles.sand,
  indigo: styles.indigo,
  grey: styles.grey,
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

/** State pill: mono 12px on a soft tone fill. Text keeps its case. */
export function Badge({
  tone = "grey",
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

/** Event chip: 6px radius, mono 11px UPPERCASE, same tones as Badge. */
export function Tag({ tone = "grey", children, className, title }: TagProps) {
  return (
    <span
      className={join(styles.tag, TONE_CLASS[tone], className)}
      title={title}
    >
      {children}
    </span>
  );
}
