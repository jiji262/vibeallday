import { LAUNCH_SOURCES } from "@vibeallday/shared";
import { Link } from "react-router-dom";
import { useRemoteBasePath } from "../../hooks/useRemoteBasePath";
import { type MessageKey, useI18n } from "../../i18n";
import {
  StatCardContent,
  StatGrid,
  type StatTone,
  statCardClassName,
} from "../garden/StatCard";
import styles from "./NowSummary.module.css";

/** Tiers the summary can jump to; each renders a heading with a known id. */
export type NowJumpTarget = "needsAttention" | "active" | "unread";

export interface NowCounts {
  needsYou: number;
  running: number;
  unread: number;
  /** Project Queue items; omitted where the server has no queue. */
  queued?: number;
}

interface NowSummaryProps {
  counts: NowCounts;
  /** The catalog is still loading or incomplete, so counts are lower bounds. */
  partial: boolean;
  projectId?: string;
  /** The page lists unread rows itself, so Unread jumps instead of linking. */
  unreadOnPage: boolean;
  onJump: (target: NowJumpTarget) => void;
}

interface TileSpec {
  key: string;
  tone: StatTone;
  value: number;
  label: MessageKey;
  announcement: MessageKey;
  jump?: NowJumpTarget;
  href?: string;
}

function unreadHref(basePath: string, projectId?: string): string {
  const params = new URLSearchParams({
    status: "unarchived,unread",
    source: LAUNCH_SOURCES.join(","),
  });
  if (projectId) params.set("project", projectId);
  return `${basePath}/sessions?${params}`;
}

function tileSpecs(
  props: NowSummaryProps,
  basePath: string,
): readonly TileSpec[] {
  const { counts, unreadOnPage, projectId } = props;
  const tiles: TileSpec[] = [
    {
      key: "needs-you",
      tone: "rose",
      value: counts.needsYou,
      label: "consoleNeedsYou",
      announcement: "sessionOverviewNeedsYou",
      jump: "needsAttention",
    },
    {
      key: "running",
      tone: "mint",
      value: counts.running,
      label: "consoleRunning",
      announcement: "nowGlanceRunning",
      jump: "active",
    },
    {
      key: "unread",
      tone: "sand",
      value: counts.unread,
      label: "consoleUnread",
      announcement: "nowGlanceUnread",
      ...(unreadOnPage
        ? { jump: "unread" as const }
        : { href: unreadHref(basePath, projectId) }),
    },
  ];
  if (counts.queued !== undefined) {
    tiles.push({
      key: "queued",
      tone: "indigo",
      value: counts.queued,
      label: "consoleQueued",
      announcement: "nowGlanceQueued",
      href: `${basePath}/projects`,
    });
  }
  return tiles;
}

function SummaryTile({
  tile,
  partial,
  onJump,
}: {
  tile: TileSpec;
  partial: boolean;
  onJump: NowSummaryProps["onJump"];
}) {
  const { t } = useI18n();
  const count = partial
    ? t("sessionOverviewPartialCount", { count: tile.value })
    : tile.value;
  const content = <StatCardContent label={t(tile.label)} value={count} />;
  const shared = {
    className: statCardClassName(tile.tone, styles.tile),
    "aria-label": t(tile.announcement, { count }),
    "data-summary-tile": tile.key,
  };
  if (tile.href) {
    return (
      <Link {...shared} to={tile.href}>
        {content}
      </Link>
    );
  }
  const target = tile.jump;
  return (
    <button
      {...shared}
      type="button"
      disabled={!tile.value || !target}
      onClick={() => target && onJump(target)}
    >
      {content}
    </button>
  );
}

/**
 * The top of the Overview: one tile per state that can wait on the user.
 * Tiles jump to their section on this page, or open the list that holds
 * them elsewhere (unread sessions, the Project Queue).
 */
export function NowSummary(props: NowSummaryProps) {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  return (
    <StatGrid label={t("nowSummaryLabel")} className={styles.grid}>
      {tileSpecs(props, basePath).map((tile) => (
        <SummaryTile
          key={tile.key}
          tile={tile}
          partial={props.partial}
          onJump={props.onJump}
        />
      ))}
    </StatGrid>
  );
}
