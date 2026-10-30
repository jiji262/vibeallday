import type { AriaRole, ReactNode } from "react";
import styles from "./Notice.module.css";

/** `neutral` is the plain design notice; the others use a semantic family. */
export type NoticeTone = "neutral" | "info" | "warning" | "danger" | "success";

const TONE_CLASS: Record<NoticeTone, string | undefined> = {
  neutral: undefined,
  info: styles.info,
  warning: styles.warning,
  danger: styles.danger,
  success: styles.success,
};

interface NoticeProps {
  tone?: NoticeTone;
  /** Short mono UPPERCASE lead, e.g. "Beta" or "Offline". */
  tag?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  /** `alert` or `status` when the notice appears in response to work. */
  role?: AriaRole;
  className?: string;
}

/** Inline banner for state the user should know about. */
export function Notice({
  tone = "info",
  tag,
  children,
  actions,
  role,
  className,
}: NoticeProps) {
  const classes = [styles.notice, TONE_CLASS[tone], className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} role={role}>
      <div className={styles.body}>
        {tag ? <span className={styles.tag}>{tag}</span> : null}
        <div className={styles.message}>{children}</div>
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
