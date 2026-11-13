import type { CacheMissBillingRecord } from "@vibeallday/shared";
import { useI18n } from "../../i18n";
import styles from "./CacheMissSummary.module.css";

const DAYS_SHOWN = 7;
const PERCENT = 100;
const MISS_RATE_DECIMALS = 1;

const compactNumber = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Same miss rule as the inactivity charts. */
function isMiss(event: CacheMissBillingRecord): boolean {
  return event.outcome !== "expected-cache-hit";
}

interface DayBucket {
  /** Local midnight of the day, as epoch ms. */
  startMs: number;
  total: number;
  misses: number;
}

function localDayStart(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** The last seven local days, oldest first, counted from event timestamps. */
export function bucketByDay(
  events: readonly CacheMissBillingRecord[],
  nowMs: number,
): DayBucket[] {
  const todayStart = localDayStart(nowMs);
  const buckets: DayBucket[] = [];
  for (let back = DAYS_SHOWN - 1; back >= 0; back -= 1) {
    const day = new Date(todayStart);
    day.setDate(day.getDate() - back);
    buckets.push({ startMs: day.getTime(), total: 0, misses: 0 });
  }
  const index = new Map(buckets.map((bucket, i) => [bucket.startMs, i]));
  for (const event of events) {
    const timestampMs = Date.parse(event.timestamp);
    if (!Number.isFinite(timestampMs)) continue;
    const slot = index.get(localDayStart(timestampMs));
    const bucket = slot === undefined ? undefined : buckets[slot];
    if (!bucket) continue;
    bucket.total += 1;
    if (isMiss(event)) bucket.misses += 1;
  }
  return buckets;
}

interface CacheMissSummaryProps {
  /** Events already filtered by the shared recency window and cutoff. */
  events: readonly CacheMissBillingRecord[];
  totalStored: number;
  nowMs: number;
}

/** Metric strip: event count, miss rate, wasted tokens. */
export function CacheMissMetricStrip({
  events,
  totalStored,
}: Omit<CacheMissSummaryProps, "nowMs">) {
  const { t } = useI18n();
  const misses = events.filter(isMiss).length;
  const wasted = events.reduce(
    (sum, event) => sum + event.wastedInputTokens,
    0,
  );
  const rate = events.length > 0 ? (misses / events.length) * PERCENT : 0;
  return (
    <div
      className={styles.strip}
      role="group"
      aria-label={t("settingsCacheMetricsLabel")}
    >
      <div className={styles.tile}>
        <span className={styles.eyebrow}>{t("settingsCacheMetricEvents")}</span>
        <span className={styles.value}>{events.length.toLocaleString()}</span>
        <span className={styles.foot}>
          {t("cacheMissRecencySummary", {
            shown: events.length,
            total: totalStored,
          })}
        </span>
      </div>
      <div className={`${styles.tile} ${misses > 0 ? styles.attn : ""}`}>
        <span className={styles.eyebrow}>
          {t("settingsCacheMetricMissRate")}
        </span>
        <span className={styles.value}>
          {rate.toFixed(MISS_RATE_DECIMALS)}
          <small>%</small>
        </span>
        <span className={styles.foot}>
          {t("settingsCacheMetricMissFoot", { misses, total: events.length })}
        </span>
      </div>
      <div className={styles.tile}>
        <span className={styles.eyebrow}>{t("settingsCacheMetricWasted")}</span>
        <span className={styles.value}>{compactNumber.format(wasted)}</span>
        <span className={styles.foot}>
          {t("settingsCacheMetricWastedFoot")}
        </span>
      </div>
    </div>
  );
}

const dayLabel = new Intl.DateTimeFormat(undefined, {
  month: "numeric",
  day: "numeric",
});

/** Seven-day stacked bars of hits and misses. */
export function CacheMissDailyBars({ events, nowMs }: CacheMissSummaryProps) {
  const { t } = useI18n();
  const buckets = bucketByDay(events, nowMs);
  const max = Math.max(0, ...buckets.map((bucket) => bucket.total));
  const todayStart = localDayStart(nowMs);
  return (
    <section className={styles.card} aria-labelledby="cache-miss-daily-title">
      <div className={styles.cardHead}>
        <h3 id="cache-miss-daily-title">{t("settingsCacheDailyTitle")}</h3>
        <span className={styles.legend}>
          <span className={`${styles.key} ${styles.hit}`} aria-hidden="true" />
          {t("cacheMissEventResultHit")}
          <span className={`${styles.key} ${styles.miss}`} aria-hidden="true" />
          {t("cacheMissEventResultMiss")}
        </span>
      </div>
      {max === 0 ? (
        <p className={styles.foot}>{t("settingsCacheDailyEmpty")}</p>
      ) : (
        <div className={styles.plot}>
          {buckets.map((bucket) => (
            <DayColumn
              key={bucket.startMs}
              bucket={bucket}
              max={max}
              label={
                bucket.startMs === todayStart
                  ? t("settingsCacheDailyToday")
                  : dayLabel.format(bucket.startMs)
              }
            />
          ))}
        </div>
      )}
      <p className={styles.foot}>{t("settingsCacheDailyAxis")}</p>
    </section>
  );
}

function DayColumn({
  bucket,
  max,
  label,
}: {
  bucket: DayBucket;
  max: number;
  label: string;
}) {
  const { t } = useI18n();
  const height = (bucket.total / max) * PERCENT;
  const missShare =
    bucket.total > 0 ? (bucket.misses / bucket.total) * PERCENT : 0;
  return (
    <div className={styles.column}>
      <div className={styles.barTrack}>
        <div
          className={styles.bar}
          role="img"
          aria-label={t("settingsCacheDailyBar", {
            day: label,
            total: bucket.total,
            misses: bucket.misses,
          })}
          style={{ height: `${height}%` }}
        >
          {bucket.misses > 0 && (
            <span className={styles.miss} style={{ height: `${missShare}%` }} />
          )}
          <span className={styles.hit} />
        </div>
      </div>
      <span className={styles.xLabel} aria-hidden="true">
        {label}
      </span>
    </div>
  );
}
