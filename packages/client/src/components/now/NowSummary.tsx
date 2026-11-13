import type { ReactNode } from "react";
import { type MessageKey, useI18n } from "../../i18n";
import { Status } from "../garden/StatusDot";
import type { InboxFilter } from "./inboxSections";
import styles from "./NowSummary.module.css";

export interface NowCounts {
  needsYou: number;
  running: number;
  unread: number;
  /** Project Queue items; omitted where the server has no queue. */
  queued?: number;
}

interface NowSummaryProps {
  counts: NowCounts;
  /** Approval and question split of the needs-you rows. */
  needs: { approvals: number; questions: number };
  /** The catalog is still loading or incomplete, so counts are lower bounds. */
  partial: boolean;
  filter: InboxFilter | null;
  onFilterChange: (filter: InboxFilter | null) => void;
}

interface TileSpec {
  filter: InboxFilter;
  value: number;
  label: ReactNode;
  hint: string;
  announcement: MessageKey;
}

function tileSpecs(
  props: NowSummaryProps,
  t: ReturnType<typeof useI18n>["t"],
): readonly TileSpec[] {
  const { counts, needs } = props;
  const tiles: TileSpec[] = [
    {
      filter: "needs",
      value: counts.needsYou,
      label: <Status state="attn">{t("consoleNeedsYou")}</Status>,
      hint: t("inboxTileNeedsHint", needs),
      announcement: "sessionOverviewNeedsYou",
    },
    {
      filter: "running",
      value: counts.running,
      label: <Status state="run">{t("consoleRunning")}</Status>,
      hint: t("inboxTileRunningHint"),
      announcement: "nowGlanceRunning",
    },
    {
      filter: "unread",
      value: counts.unread,
      label: (
        <span className={styles.plain}>
          <span className={styles.unreadMark} aria-hidden="true" />
          {t("consoleUnread")}
        </span>
      ),
      hint: t("inboxTileUnreadHint"),
      announcement: "nowGlanceUnread",
    },
  ];
  if (counts.queued !== undefined) {
    tiles.push({
      filter: "queued",
      value: counts.queued,
      label: <Status state="queued">{t("consoleQueued")}</Status>,
      hint: t("inboxTileQueuedHint"),
      announcement: "nowGlanceQueued",
    });
  }
  return tiles;
}

/**
 * The top of the Inbox: one block per state that can wait on the user. Each
 * block filters the page to its rows; pressing it again shows everything.
 * Phone draws the same buttons as a scrolling chip row.
 */
export function NowSummary(props: NowSummaryProps) {
  const { t } = useI18n();
  const { partial, filter, onFilterChange } = props;
  return (
    <div
      className={styles.grid}
      role="group"
      aria-label={t("inboxFilterGroupLabel")}
    >
      {tileSpecs(props, t).map((tile) => {
        const pressed = filter === tile.filter;
        const count = partial
          ? t("sessionOverviewPartialCount", { count: tile.value })
          : tile.value;
        return (
          <button
            key={tile.filter}
            type="button"
            className={styles.tile}
            aria-pressed={pressed}
            aria-label={t(tile.announcement, { count })}
            data-summary-tile={tile.filter}
            disabled={!pressed && tile.value === 0}
            onClick={() => onFilterChange(pressed ? null : tile.filter)}
          >
            <span className={styles.label}>{tile.label}</span>
            <span className={styles.num}>{count}</span>
            <span className={styles.hint}>{tile.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
