import { Link, useParams, useSearchParams } from "react-router-dom";
import { BackArrowIcon } from "../components/BackArrowIcon";
import { FileViewer } from "../components/FileViewer";
import { EmptyState } from "../components/garden/EmptyState";
import { AlertIcon } from "../components/garden/icons";
import { SidebarLauncher } from "../components/SidebarLauncher";
import { GlossaryProjectBoundary } from "../contexts/GlossaryContext";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useI18n } from "../i18n";
import { useNavigationLayout } from "../layouts";
import styles from "./FilePage.module.css";

/**
 * FilePage - Standalone Studio code-viewer page for project files.
 * Route: /projects/:projectId/file?path=<path>
 */
export function FilePage() {
  const { t } = useI18n();
  const { openSidebar } = useNavigationLayout();
  const basePath = useRemoteBasePath();
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const filePath = searchParams.get("path");
  const lineNumber = parsePositiveInteger(searchParams.get("line"));
  const lineEnd = parsePositiveInteger(searchParams.get("lineEnd"));
  const diffMode = parseFileDiffMode(searchParams.get("diff"));
  const viewMode =
    searchParams.get("view") === "range" ? ("range" as const) : "full";

  if (!projectId) {
    return (
      <div
        className={`file-page file-page-error ${styles.viewport} ${styles.errorViewport}`}
      >
        <div className={styles.errorCard}>
          <EmptyState
            title={t("fileInvalidUrl" as never)}
            hint={t("fileMissingProjectId" as never)}
            icon={<AlertIcon />}
            action={
              <Link
                to={`${basePath}/projects`}
                className={`file-page-back-link ${styles.backLink}`}
              >
                {t("fileGoToProjects" as never)}
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  if (!filePath) {
    return (
      <div
        className={`file-page file-page-error ${styles.viewport} ${styles.errorViewport}`}
      >
        <div className={styles.errorCard}>
          <EmptyState
            title={t("fileInvalidUrl" as never)}
            hint={t("fileMissingPath" as never)}
            icon={<AlertIcon />}
            action={
              <Link
                to={`${basePath}/projects/${projectId}`}
                className={`file-page-back-link ${styles.backLink}`}
              >
                {t("fileGoToProject" as never)}
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <GlossaryProjectBoundary projectId={projectId}>
      <div className={`file-page ${styles.viewport}`}>
        <div className={`file-page-content ${styles.frame}`}>
          <FileViewer
            projectId={projectId}
            filePath={filePath}
            lineNumber={lineNumber}
            lineEnd={lineEnd}
            viewMode={viewMode}
            diffMode={diffMode}
            standalone
            headerLeading={
              <span className={styles.headerNav}>
                <SidebarLauncher
                  label={t("actionOpenSidebar")}
                  newSessionLabel={t("sidebarNewSession")}
                  onActivate={openSidebar}
                />
                <Link
                  to={`${basePath}/projects/${projectId}`}
                  className={`file-viewer-action ${styles.backAction}`}
                  title={t("fileBackToProject" as never)}
                  aria-label={t("fileBackToProject" as never)}
                >
                  <BackArrowIcon />
                </Link>
              </span>
            }
          />
        </div>
      </div>
    </GlossaryProjectBoundary>
  );
}

function parseFileDiffMode(value: string | null) {
  return value === "worktree" || value === "cumulative" ? value : undefined;
}

function parsePositiveInteger(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return undefined;
  }
  return parsed;
}
