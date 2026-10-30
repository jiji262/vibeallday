/**
 * Top-level cross-session `!!` bang-command history: every locally run
 * command with exit status and on-demand rendered output, linking back to
 * the owning session. Contract: topics/bang-commands.md.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import {
  type BangCommandOutput,
  BangCommandDisplayObject,
} from "../components/BangCommandDisplayObject";
import { IconButton } from "../components/garden/Button";
import { Card } from "../components/garden/Card";
import { StatusDot } from "../components/garden/StatusDot";
import { EmptyState } from "../components/garden/EmptyState";
import { PlusIcon, TerminalIcon } from "../components/garden/icons";
import { LoadingState } from "../components/garden/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { PageIntro } from "../components/shell/PageIntro";
import { pageWidthClass } from "../components/shell/pageWidth";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useI18n } from "../i18n";
import { MainContent, useNavigationLayout } from "../layouts";
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

export function BangCommandsPage() {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  const { openSidebar, isWideScreen } = useNavigationLayout();
  const [entries, setEntries] = useState<BangHistoryEntry[] | null>(null);
  const [expandedEntryKey, setExpandedEntryKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.fetchBangCommandHistory().then(
      (result) => {
        if (cancelled) return;
        setEntries(
          result.entries.filter(
            (entry): entry is BangHistoryEntry =>
              entry.object.kind === "bang-command",
          ),
        );
      },
      () => {
        if (!cancelled) setEntries([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MainContent isWideScreen={isWideScreen}>
      <PageHeader
        title={t("bangHistoryTitle")}
        intro="content"
        onOpenSidebar={openSidebar}
        isWideScreen={isWideScreen}
      />
      <main className="page-scroll-container">
        <div className={`page-content-inner ${pageWidthClass("wide")}`}>
          <PageIntro
            eyebrow={[t("sidebarGroupTools")]}
            title={t("bangHistoryTitle")}
            lede={t("bangHistoryLede")}
            meta={
              entries && entries.length > 0
                ? t("bangHistoryCount", { count: entries.length })
                : undefined
            }
          />
          {entries === null && <LoadingState label={t("bangHistoryLoading")} />}
          {entries !== null && entries.length === 0 && (
            <EmptyState title={t("bangHistoryEmpty")} icon={<TerminalIcon />} />
          )}
          {entries !== null && entries.length > 0 && (
            <BangHistoryTimeline
              entries={entries}
              basePath={basePath}
              expandedEntryKey={expandedEntryKey}
              onExpandedEntryKeyChange={setExpandedEntryKey}
            />
          )}
        </div>
      </main>
    </MainContent>
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

/** Day sections, each a vertical timeline of time, status node and card. */
function BangHistoryTimeline({
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
                    expanded={expandedEntryKey === entryKey}
                    onExpandedChange={(expanded) =>
                      onExpandedEntryKeyChange(expanded ? entryKey : null)
                    }
                  />
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

/** Time and status node beside a card: cwd, session link, actions, block. */
function BangHistoryRow({
  entry,
  basePath,
  expanded,
  onExpandedChange,
}: {
  entry: BangHistoryEntry;
  basePath: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
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
}
