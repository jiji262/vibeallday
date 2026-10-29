import styles from "./LoadingState.module.css";
import { Skeleton } from "./Skeleton";
import { Spinner } from "./Spinner";
import { StatGrid } from "./StatCard";

export type LoadingVariant = "list" | "table" | "cards" | "compact" | "page";

const DEFAULT_ROWS = 4;
const DEFAULT_COLUMNS = 4;
const DEFAULT_CARDS = 4;
const CAPTION_SPINNER = 14;
const MARKER_SIZE = 28;
const BADGE_WIDTH = 52;
const BADGE_HEIGHT = 22;
const TITLE_WIDTHS = ["62%", "46%"] as const;
const STAT_VALUE = { width: "40%", height: 28 } as const;

interface LoadingStateProps {
  /** Announced and shown in the caption, e.g. t("loading"). */
  label: string;
  /** Shape of the content that is coming; defaults to `list`. */
  variant?: LoadingVariant;
  /** Placeholder rows (list, table) or cards (cards). */
  rows?: number;
  /** Table columns. */
  columns?: number;
  /** Legacy alias for `variant="compact"`. */
  compact?: boolean;
}

function indexes(count: number): number[] {
  return Array.from({ length: Math.max(1, count) }, (_, i) => i);
}

function Caption({ label }: { label: string }) {
  return (
    <div className={styles.caption} aria-hidden="true">
      <Spinner size={CAPTION_SPINNER} />
      <span>{label}</span>
    </div>
  );
}

function ListRows({ rows }: { rows: number }) {
  return indexes(rows).map((row) => (
    <div className={styles.row} key={row} aria-hidden="true">
      <Skeleton
        width={MARKER_SIZE}
        height={MARKER_SIZE}
        radius="var(--radius-md)"
      />
      <span className={styles.lines}>
        <Skeleton width={TITLE_WIDTHS[row % TITLE_WIDTHS.length]} height={12} />
        <Skeleton width="38%" height={8} />
      </span>
      <Skeleton
        width={BADGE_WIDTH}
        height={BADGE_HEIGHT}
        radius="var(--radius-pill)"
      />
    </div>
  ));
}

function TableRows({ rows, columns }: { rows: number; columns: number }) {
  const cells = indexes(columns);
  return (
    <div aria-hidden="true">
      <div className={styles.tableHead}>
        {cells.map((cell) => (
          <span className={styles.cell} key={cell}>
            <Skeleton width="50%" height={8} />
          </span>
        ))}
      </div>
      {indexes(rows).map((row) => (
        <div className={styles.tableRow} key={row}>
          {cells.map((cell) => (
            <span className={styles.cell} key={cell}>
              <Skeleton width={cell === 0 ? "80%" : "60%"} height={12} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function StatCards({ count }: { count: number }) {
  return indexes(count).map((card) => (
    <div className={styles.statCard} key={card} aria-hidden="true">
      <Skeleton width="55%" height={8} />
      <Skeleton width={STAT_VALUE.width} height={STAT_VALUE.height} />
    </div>
  ));
}

/** Initial acquisition only: refreshing views retain their existing content. */
export function LoadingState({
  label,
  variant: requested,
  rows,
  columns = DEFAULT_COLUMNS,
  compact = false,
}: LoadingStateProps) {
  const variant = requested ?? (compact ? "compact" : "list");
  const status = {
    role: "status",
    "aria-label": label,
    "aria-busy": true,
  } as const;
  if (variant === "compact" || variant === "page") {
    const shape = variant === "page" ? styles.page : styles.compact;
    return (
      <div className={`${styles.state} ${shape}`} {...status}>
        <Caption label={label} />
      </div>
    );
  }
  if (variant === "cards") {
    return (
      <div className={styles.state} {...status}>
        <Caption label={label} />
        <StatGrid>
          <StatCards count={rows ?? DEFAULT_CARDS} />
        </StatGrid>
      </div>
    );
  }
  return (
    <div className={`${styles.state} ${styles.surface}`} {...status}>
      <Caption label={label} />
      {variant === "table" ? (
        <TableRows rows={rows ?? DEFAULT_ROWS} columns={columns} />
      ) : (
        <ListRows rows={rows ?? DEFAULT_ROWS} />
      )}
    </div>
  );
}
