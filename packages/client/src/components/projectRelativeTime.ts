import type { useI18n } from "../i18n";

type Translate = ReturnType<typeof useI18n>["t"];

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const HOUR_MS = MINUTES_PER_HOUR * MINUTE_MS;
const DAY_MS = HOURS_PER_DAY * HOUR_MS;

/**
 * Short relative age ("5m ago" / "5 分钟前") for project rows and queue
 * items; older than a week falls back to the locale's date.
 */
export function formatProjectAge(timestamp: string, t: Translate): string {
  const then = new Date(timestamp).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diffMs / MINUTE_MS);
  const hours = Math.floor(diffMs / HOUR_MS);
  const days = Math.floor(diffMs / DAY_MS);

  if (minutes < 1) return t("projectQueueAgeJustNow");
  if (minutes < MINUTES_PER_HOUR)
    return t("projectQueueAgeMinutes", { count: minutes });
  if (hours < HOURS_PER_DAY) return t("projectQueueAgeHours", { count: hours });
  if (days < DAYS_PER_WEEK) return t("projectQueueAgeDays", { count: days });
  return new Date(timestamp).toLocaleDateString();
}
