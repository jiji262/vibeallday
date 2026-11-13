import type { ReactNode } from "react";
import { Eyebrow } from "../garden/Eyebrow";
import styles from "./PageIntro.module.css";

interface PageIntroProps {
  title: ReactNode;
  /** Mono context segments, e.g. [t("sidebarGroupTools"), count]. */
  eyebrow?: ReactNode[];
  /** One or two sentences under the title. */
  lede?: ReactNode;
  /** Primary page actions, right of the title on wide screens. */
  actions?: ReactNode;
  /** Filter row (search field, chips, segmented control) under the title. */
  filters?: ReactNode;
  /** Trailing meta line, e.g. counts or last refresh. */
  meta?: ReactNode;
  className?: string;
}

/** The page's own title block, first child of `.page-content-inner`. */
export function PageIntro({
  title,
  eyebrow,
  lede,
  actions,
  filters,
  meta,
  className,
}: PageIntroProps) {
  return (
    <section
      className={className ? `${styles.intro} ${className}` : styles.intro}
    >
      <div className={styles.head}>
        <div className={styles.text}>
          {eyebrow && eyebrow.length > 0 ? <Eyebrow parts={eyebrow} /> : null}
          <h1 className={`session-title ${styles.title}`}>{title}</h1>
          {lede ? <p className={styles.lede}>{lede}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {filters ? <div className={styles.filters}>{filters}</div> : null}
      {meta ? <div className={styles.meta}>{meta}</div> : null}
    </section>
  );
}
