import { memo, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import {
  type BangCommandOutput,
  BangCommandDisplayObject,
} from "../components/BangCommandDisplayObject";
import { IconButton } from "../components/garden/Button";
import { Card } from "../components/garden/Card";
import { StatusDot } from "../components/garden/StatusDot";
import { PlusIcon } from "../components/garden/icons";
import { useI18n } from "../i18n";
import { createSessionNavigationState } from "../lib/sessionNavigationState";
import {
  type BangHistoryDay,
  type BangHistoryEntry,
  daysAgo,
  groupByDay,
  isFailedRun,
  runStatus,
} from "./BangCommandsPage.days";
import styles from "./BangCommandsPage.module.css";

/** Garden icon recipe for the two glyphs the shared set lacks. */
const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
};
const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  weekday: "short",
};

/**
 * Per-entry actions, all scoped to the entry's source session (which carries
 * its project cwd). See topics/bang-commands.md § Top-level history view.
 * Each navigates to the source session with navigation state consumed once by
 * SessionPage: edit prefills `!!<command>`, new focuses an empty composer,
 * jump scrolls to the bang block's render row (its `data-render-id` is the
 * transcript display object id).
 */
function BangHistoryEntryActions({
  projectId,
  sessionId,
  command,
  objectId,
  basePath,
}: {
  projectId: string;
  sessionId: string;
  command: string;
  objectId: string;
  basePath: string;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const sessionPath = `${basePath}/projects/${projectId}/sessions/${sessionId}`;
  const go = (state: Parameters<typeof createSessionNavigationState>[0]) =>
    navigate(sessionPath, { state: createSessionNavigationState(state) });
  return (
    <span className={styles.entryActions}>
      <IconButton
        label={t("bangHistoryActionEdit")}
        onClick={() => go({ composerPrefill: `!!${command}` })}
      >
        <svg {...ICON_PROPS} aria-hidden="true">
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </IconButton>
      <IconButton
        label={t("bangHistoryActionNew")}
        onClick={() => go({ focusComposer: true })}
      >
        <PlusIcon />
      </IconButton>
      <IconButton
        label={t("bangHistoryActionJump")}
        onClick={() => go({ scrollToRenderId: objectId })}
      >
        <svg {...ICON_PROPS} aria-hidden="true">
          <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
        </svg>
      </IconButton>
    </span>
  );
}

function DayHeading({ day, id }: { day: BangHistoryDay; id: string }) {
  const { t } = useI18n();
  const ago = daysAgo(day.start);
  const label =
    ago === 0
      ? t("bangHistoryDayToday")
      : ago === 1
        ? t("bangHistoryDayYesterday")
        : day.start.toLocaleDateString(undefined, DATE_FORMAT);
  const meta = [t("bangHistoryDayCount", { count: day.entries.length })];
  if (day.failed > 0) {
    meta.push(t("bangHistoryDayFailed", { count: day.failed }));
  }
  return (
    <div className={styles.dayHead}>
      <h2 className={styles.dayTitle} id={id}>
        {label}
      </h2>
      <span className={styles.dayMeta}>{meta.join(" · ")}</span>
    </div>
  );
}

/**
 * Day sections, each a vertical timeline of time, status node and card.
 * Memoized: the search field's state lives in the page, so every keystroke
 * re-renders the page with the same `entries` until the deferred filter
 * catches up; re-rendering 400 rows on that urgent pass is what delayed keys.
 */
export const BangHistoryTimeline = memo(function BangHistoryTimeline({
  entries,
  basePath,
  expandedEntryKey,
  onExpandedEntryKeyChange,
}: {
  entries: BangHistoryEntry[];
  basePath: string;
  expandedEntryKey: string | null;
  onExpandedEntryKeyChange: (key: string | null) => void;
}) {
  const days = useMemo(() => groupByDay(entries), [entries]);
  return (
    <div className={styles.days}>
      {days.map((day) => {
        const headingId = `bang-history-day-${day.key}`;
        return (
          <section
            key={day.key}
            className={styles.day}
            aria-labelledby={headingId}
          >
            <DayHeading day={day} id={headingId} />
            <ol className={styles.entries}>
              {day.entries.map((entry) => {
                const entryKey = `${entry.sessionId}-${entry.object.id}`;
                return (
                  <BangHistoryRow
                    key={entryKey}
                    entry={entry}
                    basePath={basePath}
                    entryKey={entryKey}
                    expanded={expandedEntryKey === entryKey}
                    onExpandedEntryKeyChange={onExpandedEntryKeyChange}
                  />
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
});

/**
 * Time and status node beside a card: cwd, session link, actions, block.
 * Memoized with stable props so a filter that keeps a row skips it.
 */
const BangHistoryRow = memo(function BangHistoryRow({
  entry,
  basePath,
  entryKey,
  expanded,
  onExpandedEntryKeyChange,
}: {
  entry: BangHistoryEntry;
  basePath: string;
  entryKey: string;
  expanded: boolean;
  onExpandedEntryKeyChange: (key: string | null) => void;
}) {
  const onExpandedChange = useCallback(
    (next: boolean) => onExpandedEntryKeyChange(next ? entryKey : null),
    [entryKey, onExpandedEntryKeyChange],
  );
  const { t } = useI18n();
  const { projectId, sessionId, object } = entry;
  const created = new Date(object.createdAt);
  const failed = isFailedRun(object);
  return (
    <li className={styles.entry}>
      <time
        className={`bang-history-entry-time ${styles.time}`}
        dateTime={object.createdAt}
        title={created.toLocaleString()}
      >
        {created.toLocaleTimeString([], TIME_FORMAT)}
      </time>
      <span className={styles.node}>
        <StatusDot state={runStatus(object)} />
      </span>
      <Card
        as="article"
        className={failed ? `${styles.card} ${styles.failed}` : styles.card}
      >
        <div className={styles.entryMeta}>
          <div className={styles.entryWhen}>
            <span
              className={`bang-history-entry-cwd ${styles.cwd}`}
              title={object.cwd}
            >
              {object.cwd.split("/").pop()}
            </span>
            {projectId && (
              <Link
                to={`${basePath}/projects/${projectId}/sessions/${sessionId}`}
                className={styles.entrySession}
              >
                {t("bangHistoryOpenSession")}
              </Link>
            )}
          </div>
          {projectId && (
            <BangHistoryEntryActions
              projectId={projectId}
              sessionId={sessionId}
              command={object.command}
              objectId={object.id}
              basePath={basePath}
            />
          )}
        </div>
        <BangCommandDisplayObject
          object={object}
          outputExpanded={expanded}
          onOutputExpandedChange={onExpandedChange}
          handlers={
            projectId
              ? {
                  fetchOutput: (objectId: string) =>
                    api.fetchBangCommandOutput(
                      projectId,
                      sessionId,
                      objectId,
                    ) as Promise<BangCommandOutput>,
                }
              : undefined
          }
        />
      </Card>
    </li>
  );
});
