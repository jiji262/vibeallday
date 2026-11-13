import type { CSSProperties, ReactNode, Ref } from "react";
import { type MessageKey, useI18n } from "../../i18n";
import { Button } from "../garden/Button";
import { Card, CardFooter } from "../garden/Card";
import type { DateGroup, DateGroupHeader } from "./dateGroups";
import styles from "./SessionResults.module.css";

/** Column tracks shared by every row from 768px. */
const COLUMNS_WITH_PROJECT =
  "minmax(0, 1fr) minmax(0, 160px) 136px minmax(0, 128px) 72px";
const COLUMNS_WITHOUT_PROJECT = "minmax(0, 1fr) 136px minmax(0, 128px) 72px";
/**
 * Reserved on every row for the question flag beside the row link, so the
 * column tracks of every row line up whether or not it has one.
 */
const ACCESSORY_TRACK = "56px";
const AREAS_WITH_PROJECT = '"title project provider state time"';
const AREAS_WITHOUT_PROJECT = '"title provider state time"';

interface SessionResultsProps {
  listRef: Ref<HTMLUListElement>;
  /** Rows show their select boxes. */
  selecting: boolean;
  /** Turn search draws rows with match previews, which do not use columns. */
  searchRows: boolean;
  /** All projects are listed, so rows carry a project column. */
  showProject: boolean;
  /** Bulk action band, drawn at the top of the card. */
  band?: ReactNode;
  shown: number;
  total: number;
  /** Observed to render the next page as it scrolls into view. */
  moreRef: Ref<HTMLSpanElement>;
  onMore: () => void;
  children: ReactNode;
}

const GROUP_LABELS: Record<DateGroup, MessageKey> = {
  today: "sessionsGroupToday",
  yesterday: "sessionsGroupYesterday",
  week: "sessionsGroupThisWeek",
  earlier: "sessionsGroupEarlier",
};

/** 今天 · 8: heads a run of rows by last activity. */
export function SessionGroupHeader({ header }: { header: DateGroupHeader }) {
  const { t } = useI18n();
  return (
    <li className={styles.group}>
      <h2 className={styles.groupTitle}>{t(GROUP_LABELS[header.group])}</h2>
      <span className={styles.groupCount}>{header.count}</span>
    </li>
  );
}

/**
 * The Sessions result list as one card: optional bulk band, rows (headed by
 * date-group rows outside turn search), and a "load more" footer band.
 */
export function SessionResults({
  listRef,
  selecting,
  searchRows,
  showProject,
  band,
  shown,
  total,
  moreRef,
  onMore,
  children,
}: SessionResultsProps) {
  const { t } = useI18n();
  const columns = showProject ? COLUMNS_WITH_PROJECT : COLUMNS_WITHOUT_PROJECT;
  const areas = showProject ? AREAS_WITH_PROJECT : AREAS_WITHOUT_PROJECT;
  const listStyle = {
    "--session-columns": columns,
    "--session-areas": areas,
    "--session-accessory": ACCESSORY_TRACK,
  } as CSSProperties;
  const listClass = [
    styles.results,
    searchRows ? "" : styles.columns,
    selecting ? styles.selecting : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (total === 0 && !band) return null;
  return (
    <Card className={styles.card}>
      {band}
      <ul ref={listRef} className={listClass} style={listStyle}>
        {children}
      </ul>
      {total > shown && (
        <CardFooter band>
          <span>{t("sessionSearchShown", { shown, total })}</span>
          <span ref={moreRef} className={styles.sentinel} aria-hidden="true" />
          <Button size="sm" onClick={onMore}>
            {t("sessionSearchMore")}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
