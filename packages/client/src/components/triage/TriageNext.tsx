import { Link } from "react-router-dom";
import type { InboxItem } from "../../contexts/InboxContext";
import { useI18n } from "../../i18n";
import { Count } from "../garden/Count";
import { Status } from "../garden/StatusDot";
import { inboxRowModel } from "../now/inboxSections";
import { SessionListTime } from "../SessionListTime";
import { openOnPlainClick } from "./TriageCard";
import styles from "./TriageNext.module.css";
import { triageStatusKey, triageTitle } from "./triageItem";

interface TriageNextProps {
  items: readonly InboxItem[];
  /** 1-based position of the first listed item in the whole queue. */
  firstStep: number;
  hrefFor: (item: InboxItem) => string;
  onOpen: (item: InboxItem) => void;
}

/** The items after the current one, in handling order. */
export function TriageNext({
  items,
  firstStep,
  hrefFor,
  onOpen,
}: TriageNextProps) {
  const { t } = useI18n();
  if (items.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="triage-next-title">
      <div className={styles.head}>
        <h2 id="triage-next-title" className={styles.title}>
          {t("inboxTriageNext")}
        </h2>
        <Count>{items.length}</Count>
      </div>
      <ol className={styles.list} aria-label={t("inboxTriageQueueLabel")}>
        {items.map((item, index) => (
          <li key={item.sessionId}>
            <Link
              className={styles.item}
              to={hrefFor(item)}
              onClick={(event) => openOnPlainClick(event, () => onOpen(item))}
            >
              <span className={styles.top}>
                <span className={styles.step} aria-hidden="true">
                  {firstStep + index}
                </span>
                <Status state="attn">{t(triageStatusKey(item))}</Status>
                {item.updatedAt && (
                  <span className={styles.age}>
                    <SessionListTime timestamp={item.updatedAt} />
                  </span>
                )}
              </span>
              <span className={styles.name}>{triageTitle(item)}</span>
              <span className={styles.meta}>
                {[item.projectName, inboxRowModel(item)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
