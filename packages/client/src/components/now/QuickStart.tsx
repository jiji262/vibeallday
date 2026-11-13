import { Link } from "react-router-dom";
import { useI18n } from "../../i18n";
import type { Project } from "../../types";
import { Card } from "../garden/Card";
import { FolderIcon, PlusIcon } from "../garden/icons";
import styles from "./QuickStart.module.css";

/** Projects offered as one-tap new-session starts. */
const QUICK_START_LIMIT = 3;
const ICON_SIZE = 16;

function activityTime(project: Project): number {
  const time = project.lastActivity ? Date.parse(project.lastActivity) : 0;
  return Number.isFinite(time) ? time : 0;
}

/** The most recently active projects, newest first. */
export function quickStartProjects(projects: readonly Project[]): Project[] {
  return [...projects]
    .sort((a, b) => activityTime(b) - activityTime(a))
    .slice(0, QUICK_START_LIMIT);
}

/**
 * Inbox aside: start a session in a recently active project. The design's
 * branch line is not in the project summary, so the row shows the path.
 */
export function QuickStart({
  projects,
  basePath,
}: {
  projects: readonly Project[];
  basePath: string;
}) {
  const { t } = useI18n();
  const shown = quickStartProjects(projects);
  if (shown.length === 0) return null;
  return (
    <Card as="section" flush aria-labelledby="inbox-quick-start">
      <h2 id="inbox-quick-start" className={styles.title}>
        {t("inboxQuickStart")}
      </h2>
      <ul className={styles.list}>
        {shown.map((project) => (
          <li key={project.id}>
            <Link
              className={styles.row}
              to={`${basePath}/new-session?${new URLSearchParams({
                projectId: project.id,
              })}`}
              aria-label={t("inboxQuickStartLabel", { project: project.name })}
            >
              <FolderIcon size={ICON_SIZE} className={styles.icon} />
              <span className={styles.text}>
                <span className={styles.name}>{project.name}</span>
                <span className={styles.meta}>{project.path}</span>
              </span>
              <PlusIcon size={ICON_SIZE} className={styles.icon} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
