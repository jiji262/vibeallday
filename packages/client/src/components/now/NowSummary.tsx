import type { ReactNode } from "react";
import type { SessionOverviewData } from "../../hooks/useSessionOverview";
import { useI18n } from "../../i18n";
import { SessionOverviewSummary } from "../SessionOverviewSummary";
import { Pill, type PillTone } from "../garden/Pill";
import styles from "./NowSummary.module.css";

/** Tiers the summary can jump to; each renders a heading with a known id. */
export type NowJumpTarget = "needsAttention" | "active" | "unread";

export interface NowCounts {
  needsYou: number;
  running: number;
  unread: number;
}

interface NowSummaryProps {
  overview?: SessionOverviewData;
  projectId?: string;
  counts: NowCounts;
  /** False while loading, on error, or when the empty state speaks instead;
   *  the controls then sit alone on one row. */
  showGlance: boolean;
  onJump: (target: NowJumpTarget) => void;
  /** Trailing control on the headline row, e.g. refresh. */
  action?: ReactNode;
  /** Filters on the glance row, e.g. project and async questions. */
  filters?: ReactNode;
}

interface GlanceChip {
  target: NowJumpTarget;
  tone: PillTone;
  label: string;
  pulse: boolean;
}

type Translate = ReturnType<typeof useI18n>["t"];

function glanceChips(counts: NowCounts, t: Translate): GlanceChip[] {
  const chips: GlanceChip[] = [];
  if (counts.running > 0) {
    const label = t("nowGlanceRunning", { count: counts.running });
    chips.push({ target: "active", tone: "mint", label, pulse: true });
  }
  if (counts.unread > 0) {
    const label = t("nowGlanceUnread", { count: counts.unread });
    chips.push({ target: "unread", tone: "sand", label, pulse: false });
  }
  return chips;
}

function GlanceChips({
  chips,
  onJump,
}: {
  chips: GlanceChip[];
  onJump: (target: NowJumpTarget) => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className={styles.chips}>
      {chips.map((chip) => (
        <button
          key={chip.target}
          type="button"
          className={styles.chip}
          onClick={() => onJump(chip.target)}
        >
          <Pill
            tone={chip.tone}
            dot={chip.pulse ? "pulse" : true}
            className={styles.chipPill}
          >
            {chip.label}
          </Pill>
        </button>
      ))}
    </div>
  );
}

/**
 * The top of "Now": one sentence saying how many sessions wait on the user,
 * then chips for the running and unread tiers. Each part jumps to its tier.
 */
export function NowSummary({
  counts,
  showGlance,
  onJump,
  action,
  filters,
  overview,
  projectId,
}: NowSummaryProps) {
  const { t } = useI18n();
  if (overview) {
    return (
      <SessionOverviewSummary
        overview={{ ...overview, counts }}
        projectId={projectId}
        action={action}
        filters={filters}
        onJump={onJump}
      />
    );
  }
  if (!showGlance) {
    return (
      <header className={styles.summary}>
        <div className={styles.filters}>
          {filters}
          {action}
        </div>
      </header>
    );
  }

  const waiting = counts.needsYou > 0;
  return (
    <header className={styles.summary}>
      <div className={styles.headlineRow}>
        <button
          type="button"
          className={`${styles.headline} ${waiting ? styles.waiting : styles.clear}`}
          onClick={() => onJump("needsAttention")}
          disabled={!waiting}
        >
          <span className={styles.signal} aria-hidden="true" />
          {waiting
            ? t("nowWaitingOnYou", { count: counts.needsYou })
            : t("nowNothingWaiting")}
        </button>
        {action}
      </div>
      <div className={styles.glanceRow}>
        <GlanceChips chips={glanceChips(counts, t)} onJump={onJump} />
        {filters ? <div className={styles.filters}>{filters}</div> : null}
      </div>
    </header>
  );
}
