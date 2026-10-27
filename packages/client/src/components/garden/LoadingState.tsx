import styles from "./LoadingState.module.css";

const PLACEHOLDER_ROWS = [0, 1, 2, 3];

/** Initial acquisition only: refreshing views retain their existing content. */
export function LoadingState({
  label,
  compact = false,
}: {
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className={compact ? `${styles.state} ${styles.compact}` : styles.state}
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <div className={styles.caption} aria-hidden="true">
        <span className={styles.spinner} />
        <span>{label}</span>
      </div>
      {!compact && (
        <div className={styles.rows} aria-hidden="true">
          {PLACEHOLDER_ROWS.map((row) => (
            <div className={styles.row} key={row}>
              <span className={styles.marker} />
              <span className={styles.lines}>
                <span className={styles.title} />
                <span className={styles.detail} />
              </span>
              <span className={styles.badge} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
