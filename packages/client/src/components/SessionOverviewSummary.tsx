import { LAUNCH_SOURCES } from "@vibeallday/shared";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { SessionOverviewData } from "../hooks/useSessionOverview";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { type MessageKey, useI18n } from "../i18n";
import styles from "./SessionOverviewSummary.module.css";

interface SummaryProps {
  overview: SessionOverviewData;
  projectId?: string;
  action: ReactNode;
  filters: ReactNode;
  onJump: (target: "needsAttention" | "active") => void;
}

interface MetricProps {
  value: number;
  partial: boolean;
  label: MessageKey;
  announcement: MessageKey;
  tone: "rose" | "mint" | "sand";
  onSelect?: () => void;
  href?: string;
}

function OverviewMetric({
  value,
  partial,
  label,
  announcement,
  tone,
  onSelect,
  href,
}: MetricProps) {
  const { t } = useI18n();
  const count = partial
    ? t("sessionOverviewPartialCount", { count: value })
    : value;
  const control = {
    className: styles.control,
    "data-tone": tone,
    "aria-label": t(announcement, { count }),
  };
  const content = (
    <>
      <span className={styles.value} aria-hidden="true">
        {count}
      </span>
      <span className={styles.label} aria-hidden="true">
        {t(label)}
      </span>
    </>
  );
  return href ? (
    <Link {...control} to={href}>
      {content}
    </Link>
  ) : (
    <button {...control} type="button" onClick={onSelect} disabled={!value}>
      {content}
    </button>
  );
}

function OverviewCounts({
  overview,
  projectId,
  onJump,
}: Pick<SummaryProps, "overview" | "projectId" | "onJump">) {
  const basePath = useRemoteBasePath();
  const params = new URLSearchParams({
    status: "unarchived,unread",
    source: LAUNCH_SOURCES.join(","),
  });
  if (projectId) params.set("project", projectId);
  return (
    <div className={styles.counts}>
      <OverviewMetric
        value={overview.counts.needsYou}
        partial={overview.partial}
        label="consoleNeedsYou"
        announcement="sessionOverviewNeedsYou"
        tone="rose"
        onSelect={() => onJump("needsAttention")}
      />
      <OverviewMetric
        value={overview.counts.running}
        partial={overview.partial}
        label="consoleRunning"
        announcement="nowGlanceRunning"
        tone="mint"
        onSelect={() => onJump("active")}
      />
      <OverviewMetric
        value={overview.counts.unread}
        partial={overview.partial}
        label="consoleUnread"
        announcement="nowGlanceUnread"
        tone="sand"
        href={`${basePath}/sessions?${params}`}
      />
    </div>
  );
}

export function SessionOverviewSummary({
  overview,
  projectId,
  action,
  filters,
  onJump,
}: SummaryProps) {
  const { t } = useI18n();
  return (
    <header className={styles.summary}>
      <div className={styles.controls}>
        <OverviewCounts
          overview={overview}
          projectId={projectId}
          onJump={onJump}
        />
        {action}
      </div>
      <div className={styles.filters}>{filters}</div>
      {overview.partial && (
        <p className={styles.note} role="status">
          {t(
            overview.error
              ? "sessionOverviewIncomplete"
              : "sessionOverviewLoading",
          )}
        </p>
      )}
    </header>
  );
}
