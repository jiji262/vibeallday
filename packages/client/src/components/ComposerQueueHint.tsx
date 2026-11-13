import { useI18n } from "../i18n";
import styles from "./ComposerQueueHint.module.css";

/**
 * One quiet line above a busy composer saying what sending does now: steer
 * the running turn, or queue for after it. Static per busy state, so it never
 * changes height while the user types.
 */
export function ComposerQueueHint({ kind }: { kind: "steer" | "queue" }) {
  const { t } = useI18n();
  return (
    <p className={styles.hint} data-composer-queue-hint={kind}>
      <svg
        className={styles.icon}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      <span className={styles.text}>
        {kind === "steer" ? t("composerSteerHint") : t("composerQueueHint")}
      </span>
    </p>
  );
}
