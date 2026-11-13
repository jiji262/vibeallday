import { projectDisplayName } from "@vibeallday/shared";
import { Link } from "react-router-dom";
import type { InboxItem } from "../api/client";
import { Card } from "../components/garden/Card";
import { Count, type CountTone } from "../components/garden/Count";
import { EmptyState } from "../components/garden/EmptyState";
import { LoadingState } from "../components/garden/LoadingState";
import { type StatusState, StatusDot } from "../components/garden/StatusDot";
import { formatProjectAge } from "../components/projectRelativeTime";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useSessionOverview } from "../hooks/useSessionOverview";
import { type MessageKey, useI18n } from "../i18n";
import type { Project } from "../types";
import { getSessionDisplayTitle } from "../utils";
import styles from "./ProjectHomePage.module.css";

interface SectionProps {
  titleKey: MessageKey;
  items: readonly InboxItem[];
  state: StatusState;
  tone?: CountTone;
  basePath: string;
}

/** One status group of the project's sessions: heading, count, link rows. */
function SessionSection({
  titleKey,
  items,
  state,
  tone,
  basePath,
}: SectionProps) {
  const { t } = useI18n();
  if (items.length === 0) return null;
  const headingId = `project-home-${titleKey}`;
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.sectionHead}>
        <h2 id={headingId}>{t(titleKey)}</h2>
        <Count tone={tone}>{items.length}</Count>
      </div>
      <Card flush>
        <ul className={styles.rows}>
          {items.map((item) => (
            <li key={item.sessionId}>
              <Link
                className={styles.row}
                to={`${basePath}/projects/${item.projectId}/sessions/${item.sessionId}`}
              >
                <StatusDot state={state} />
                <span className={styles.rowTitle}>
                  {getSessionDisplayTitle({
                    customTitle: item.customTitle,
                    title: item.sessionTitle,
                  })}
                </span>
                <span className={styles.rowTime}>
                  {formatProjectAge(item.updatedAt, t)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

/**
 * The project's sessions from the shared overview feed, grouped by
 * needs-you, running and recent, with a link to the full filtered list.
 */
export function ProjectHomeSessions({
  project,
  allSessionsHref,
}: {
  project: Project;
  allSessionsHref: string;
}) {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  const overview = useSessionOverview(project.id);
  const empty =
    overview.needsAttention.length === 0 &&
    overview.active.length === 0 &&
    overview.recentActivity.length === 0;
  if (overview.loading && empty) {
    return <LoadingState label={t("projectHomeLoading")} variant="list" />;
  }
  return (
    <div className={styles.sessions}>
      {empty && <EmptyState compact title={t("projectHomeEmpty")} />}
      <SessionSection
        titleKey="inboxTierNeedsAttention"
        items={overview.needsAttention}
        state="attn"
        tone="attn"
        basePath={basePath}
      />
      <SessionSection
        titleKey="inboxTierActive"
        items={overview.active}
        state="run"
        basePath={basePath}
      />
      <SessionSection
        titleKey="inboxTierRecentActivity"
        items={overview.recentActivity}
        state="idle"
        basePath={basePath}
      />
      <Link to={allSessionsHref} className={styles.viewAll}>
        {t("projectHomeViewAll", { name: projectDisplayName(project) })}
      </Link>
    </div>
  );
}
