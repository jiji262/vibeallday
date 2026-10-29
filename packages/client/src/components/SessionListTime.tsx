import { formatBriefAge } from "../lib/sessionAge";
import styles from "./SessionListItem.module.css";

const MS_PER_DAY = 86_400_000;
/** Ages up to a week read as "5m" / "3h" / "6d"; older rows show the date. */
const BRIEF_AGE_MAX_DAYS = 7;

function listTimeLabel(timestamp: string): string | null {
  const then = new Date(timestamp).getTime();
  if (!Number.isFinite(then)) return null;
  if (Date.now() - then >= BRIEF_AGE_MAX_DAYS * MS_PER_DAY) {
    return new Date(timestamp).toLocaleDateString();
  }
  return formatBriefAge(timestamp);
}

/** Mono last-activity cell of a session card row. */
export function SessionListTime({ timestamp }: { timestamp: string }) {
  const label = listTimeLabel(timestamp);
  if (!label) return null;
  return (
    <time className={styles.time} data-session-cell="time" dateTime={timestamp}>
      {label}
    </time>
  );
}
