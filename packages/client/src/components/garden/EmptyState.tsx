import type { ReactNode } from "react";
import { VibeAllDayGlyph } from "../VibeAllDayLogo";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  title: ReactNode;
  hint?: ReactNode;
  /** One next step, usually a Button. */
  action?: ReactNode;
  /** Replaces the logo glyph. */
  icon?: ReactNode;
}

/** An empty screen is an invitation to act: glyph, title, hint, one action. */
export function EmptyState({ title, hint, action, icon }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <div className={styles.mark} aria-hidden="true">
        {icon ?? <VibeAllDayGlyph size={44} />}
      </div>
      <h2 className={styles.title}>{title}</h2>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
