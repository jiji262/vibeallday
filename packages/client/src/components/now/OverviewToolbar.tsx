import { useI18n } from "../../i18n";
import type { Project } from "../../types";
import { IconButton } from "../garden/Button";
import { selectClassName } from "../garden/Field";
import { RefreshIcon } from "../garden/icons";
import { Spinner } from "../garden/Spinner";
import { SessionAsyncQuestionsButton } from "../SessionAsyncQuestionsButton";
import styles from "./OverviewToolbar.module.css";

const REFRESH_ICON_SIZE = 18;
const REFRESH_SPINNER_SIZE = 16;

interface OverviewToolbarProps {
  projects?: Project[];
  projectId?: string;
  onProjectChange?: (projectId: string | undefined) => void;
  basePath: string;
  refreshing: boolean;
  refreshDisabled: boolean;
  onRefresh: () => void;
}

/**
 * One compact row on every width: project scope, the pending questions chip,
 * then refresh at the far end. The select shrinks before anything wraps.
 */
export function OverviewToolbar({
  projects,
  projectId,
  onProjectChange,
  basePath,
  refreshing,
  refreshDisabled,
  onRefresh,
}: OverviewToolbarProps) {
  const { t } = useI18n();
  return (
    <div
      className={styles.toolbar}
      role="group"
      aria-label={t("overviewToolbarLabel")}
    >
      {projects && projects.length > 0 && (
        <select
          className={selectClassName(styles.project)}
          aria-label={t("inboxFilterProject")}
          value={projectId ?? ""}
          onChange={(event) =>
            onProjectChange?.(event.target.value || undefined)
          }
        >
          <option value="">{t("inboxAllProjects")}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      )}
      <SessionAsyncQuestionsButton projectId={projectId} basePath={basePath} />
      <IconButton
        className={styles.refresh}
        label={refreshing ? t("inboxRefreshing") : t("inboxRefresh")}
        onClick={onRefresh}
        disabled={refreshDisabled}
      >
        {refreshing ? (
          <Spinner size={REFRESH_SPINNER_SIZE} tone="current" />
        ) : (
          <RefreshIcon size={REFRESH_ICON_SIZE} />
        )}
      </IconButton>
    </div>
  );
}
