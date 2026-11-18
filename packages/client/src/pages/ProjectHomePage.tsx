import {
  PROJECT_SESSION_DEFAULTS_CAPABILITY,
  projectDisplayName,
  SERVER_CAPABILITIES,
  serverHasCapability,
} from "@vibeallday/shared";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Tag } from "../components/garden/Badge";
import { Button } from "../components/garden/Button";
import { Count } from "../components/garden/Count";
import { EmptyState } from "../components/garden/EmptyState";
import { FolderIcon, PlusIcon } from "../components/garden/icons";
import { LoadingState } from "../components/garden/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { ProjectSessionDefaultsModal } from "../components/ProjectSessionDefaultsModal";
import { pageWidthClass } from "../components/shell/pageWidth";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useProjectCodeNamePreferences } from "../hooks/useProjectCodeNamePreferences";
import { useProject } from "../hooks/useProjects";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useVersion } from "../hooks/useVersion";
import { useI18n } from "../i18n";
import { MainContent, useNavigationLayout } from "../layouts";
import { shortenPath } from "../lib/text";
import type { Project } from "../types";
import { ProjectBranchChip } from "./ProjectBranchChip";
import styles from "./ProjectHomePage.module.css";
import { ProjectHomeSessions } from "./ProjectHomeSessions";

const HERO_REPO_ICON_SIZE = 16;

interface ProjectHrefs {
  sessions: string;
  source: string;
  files: string;
  app: string;
  newSession: string;
}

interface HrefOptions {
  basePath: string;
  project: Project;
  /** The server browses working-tree folders (`local-source-browse`). */
  localBrowse: boolean;
}

/**
 * Where each view of the project lives. Files opens the project folder in
 * the working-tree browser, or Source Control's files tab without it.
 */
function projectHrefs({
  basePath,
  project,
  localBrowse,
}: HrefOptions): ProjectHrefs {
  const projectId = project.id;
  const query = `projectId=${encodeURIComponent(projectId)}`;
  const browse = new URLSearchParams({ path: project.path });
  return {
    sessions: `${basePath}/sessions?project=${projectId}&source=projects`,
    source: `${basePath}/git-status?${query}`,
    files: localBrowse
      ? `${basePath}/projects/${projectId}/browse?${browse.toString()}`
      : `${basePath}/git-status?${query}&tab=files`,
    app: `${basePath}/projects/${projectId}/app`,
    newSession: `${basePath}/new-session?${query}`,
  };
}

interface TabsProps {
  project: Project;
  hrefs: ProjectHrefs;
  appEnabled: boolean;
  onOpenSettings?: () => void;
}

/** Workspace navigation tabs: Sessions / Source / Files / App / Settings. */
function ProjectHomeTabs({
  project,
  hrefs,
  appEnabled,
  onOpenSettings,
}: TabsProps) {
  const { t } = useI18n();
  return (
    <nav className={styles.tabBar} aria-label={t("projectHomeTabsLabel")}>
      <span
        className={`${styles.tabItem} ${styles.tabItemActive}`}
        aria-current="page"
      >
        <span>{t("tabSessions")}</span>
        <Count>{project.sessionCount}</Count>
      </span>
      <Link to={hrefs.source} className={styles.tabItem}>
        {t("projectHomeTabSource")}
      </Link>
      <Link to={hrefs.files} className={styles.tabItem}>
        {t("projectHomeTabFiles")}
      </Link>
      {appEnabled && (
        <Link to={hrefs.app} className={styles.tabItem}>
          {t("projectHomeTabApp")}
        </Link>
      )}
      {onOpenSettings && (
        <button
          type="button"
          className={styles.tabItem}
          onClick={onOpenSettings}
        >
          {t("projectHomeTabSettings")}
        </button>
      )}
    </nav>
  );
}

function useProjectCapabilities() {
  const { version } = useVersion();
  return {
    appEnabled: serverHasCapability(
      version,
      SERVER_CAPABILITIES.projectService.name,
    ),
    settingsEnabled: serverHasCapability(
      version,
      PROJECT_SESSION_DEFAULTS_CAPABILITY,
    ),
    localBrowse: serverHasCapability(
      version,
      SERVER_CAPABILITIES.localSourceBrowse.name,
    ),
  };
}

/** Open app (when the server runs project apps) and the one primary action. */
function ProjectHomeActions({
  hrefs,
  appEnabled,
}: {
  hrefs: ProjectHrefs;
  appEnabled: boolean;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <div className={styles.heroActions}>
      {appEnabled && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(hrefs.app)}
        >
          {t("projectAppOpen")}
        </Button>
      )}
      <Button
        variant="primary"
        size="sm"
        icon={<PlusIcon />}
        onClick={() => navigate(hrefs.newSession)}
      >
        {t("projectCardNewSession")}
      </Button>
    </div>
  );
}

/** Structured Repository Hero Surface, workspace tabs, and framed session lists. */
function ProjectHome({ project }: { project: Project }) {
  const basePath = useRemoteBasePath();
  const { appEnabled, settingsEnabled, localBrowse } = useProjectCapabilities();
  const { projectCodeNamesEnabled } = useProjectCodeNamePreferences();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hrefs = projectHrefs({ basePath, project, localBrowse });
  const name = projectDisplayName(project);
  return (
    <>
      <section className={styles.heroSurface}>
        <div className={styles.heroMain}>
          <div className={styles.heroIdentity}>
            <div className={styles.titleRow}>
              <span className={styles.heroRepoBadge} aria-hidden="true">
                <FolderIcon size={HERO_REPO_ICON_SIZE} />
              </span>
              <h1 className={styles.titleText}>{name}</h1>
              {projectCodeNamesEnabled && project.codeName && (
                <Tag>{project.codeName}</Tag>
              )}
            </div>
            {project.caption?.text && (
              <p className={styles.heroLede}>{project.caption.text}</p>
            )}
            <div className={styles.metaRow}>
              <span className={styles.pathChip} title={project.path}>
                <bdi>{shortenPath(project.path)}</bdi>
              </span>
              <ProjectBranchChip
                projectId={project.id}
                sourceHref={hrefs.source}
              />
            </div>
          </div>
          <ProjectHomeActions hrefs={hrefs} appEnabled={appEnabled} />
        </div>
        <div className={styles.heroNavBar}>
          <ProjectHomeTabs
            project={project}
            hrefs={hrefs}
            appEnabled={appEnabled}
            onOpenSettings={
              settingsEnabled ? () => setSettingsOpen(true) : undefined
            }
          />
        </div>
      </section>
      <ProjectHomeSessions project={project} allSessionsHref={hrefs.sessions} />
      {settingsOpen && (
        <ProjectSessionDefaultsModal
          projectId={project.id}
          projectName={project.name}
          ownerUsername={project.ownerUsername}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Project home at /projects/:projectId: structured repository hero surface,
 * mono path & branch badges, workspace navigation tabs, and framed session groups.
 */
export function ProjectHomePage() {
  const { t } = useI18n();
  const { projectId } = useParams<{ projectId: string }>();
  const { project, loading } = useProject(projectId);
  const { openSidebar, isWideScreen } = useNavigationLayout();
  const navigate = useNavigate();
  const basePath = useRemoteBasePath();
  const projectsHref = `${basePath}/projects`;
  const name = project ? projectDisplayName(project) : t("pageTitleProjects");
  useDocumentTitle(project?.name, project?.codeName, t("pageTitleProjects"));
  return (
    <MainContent isWideScreen={isWideScreen}>
      <PageHeader
        title={name}
        intro="content"
        breadcrumbs={[
          { label: t("pageTitleProjects"), to: projectsHref },
          { label: name },
        ]}
        onOpenSidebar={openSidebar}
        isWideScreen={isWideScreen}
        showBack
        onBack={() => navigate(projectsHref)}
      />
      <main className="page-scroll-container">
        <div className={`page-content-inner ${pageWidthClass("wide")}`}>
          {project ? (
            <ProjectHome project={project} />
          ) : loading ? (
            <LoadingState label={t("projectHomeLoading")} variant="list" />
          ) : (
            <EmptyState
              title={t("projectHomeNotFound")}
              action={
                <Link to={projectsHref} className={styles.viewAll}>
                  {t("fileGoToProjects")}
                </Link>
              }
            />
          )}
        </div>
      </main>
    </MainContent>
  );
}
