import { useI18n } from "../../i18n";
import styles from "./TriageProgress.module.css";
import type { TriageCounts } from "./triageQueue";

const PERCENT = 100;

/** "Item N of M", a meter and the handled count (design Triage top bar). */
export function TriageProgress({ counts }: { counts: TriageCounts }) {
  const { t } = useI18n();
  const { total, handled, current } = counts;
  if (total === 0 || current === 0) return null;
  const width = `${Math.round((current / total) * PERCENT)}%`;
  return (
    <div className={styles.progress}>
      <span className={styles.position}>
        {t("inboxTriageProgress", { current, total })}
      </span>
      <div
        className={styles.meter}
        role="img"
        aria-label={t("inboxTriageProgressLabel", { handled, total, current })}
      >
        <span className={styles.fill} style={{ width }} />
      </div>
      <span className={styles.handled}>
        {t("inboxTriageHandled", { count: handled })}
      </span>
    </div>
  );
}
