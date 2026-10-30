import type { ReactNode } from "react";
import { StatusDot } from "./garden";
import styles from "./NeedsYouHead.module.css";

/**
 * Amber head strip of the needs-you card pinned above the composer (tool
 * approval, plan approval, question): attention marker, what is asked, and an
 * optional quiet meta on the right.
 */
export function NeedsYouHead({
  title,
  meta,
}: {
  title: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className={styles.head}>
      <StatusDot state="attn" />
      <span className={styles.title}>{title}</span>
      {meta ? <span className={styles.meta}>{meta}</span> : null}
    </div>
  );
}
