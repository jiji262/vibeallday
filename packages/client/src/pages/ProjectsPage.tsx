import {
  projectDisplayName,
  PROJECT_CAPTIONS_CAPABILITY,
  PROJECT_CODE_NAMES_CAPABILITY,
  PROJECT_NAMES_CAPABILITY,
  PROJECT_QUEUE_ATTACHMENT_EDITING_CAPABILITY,
  PROJECT_SESSION_DEFAULTS_CAPABILITY,
  type LaunchSource,
  type ProjectQueueMessage,
  serverHasCapability,
  SERVER_CAPABILITIES,
} from "@vibeallday/shared";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { projectAccessApi } from "../api/projectAccess";
import { useProjectTemplateChoices } from "../hooks/useProjectTemplateChoices";
import { AddProjectSheet } from "../components/AddProjectSheet";
import type { AddProjectRequest } from "../components/AddProjectForm";
import formStyles from "../components/AddProjectForm.module.css";
import { FilterDropdown } from "../components/FilterDropdown";
import { Button } from "../components/garden/Button";
import { EmptyState } from "../components/garden/EmptyState";
import { LoadingState } from "../components/garden/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { ProjectCard } from "../components/ProjectCard";
import { ProjectQueueSection } from "../components/ProjectQueueSection";
import { ProjectSessionDefaultsModal } from "../components/ProjectSessionDefaultsModal";
import { useActingPrincipal } from "../hooks/useActingPrincipal";
import { useHideAutomationSessions } from "../hooks/useHideAutomationSessions";
import { useIncrementalReveal } from "../hooks/useIncrementalReveal";
import { useProjectListPreferences } from "../hooks/useProjectListPreferences";
import { useProjectCodeNamePreferences } from "../hooks/useProjectCodeNamePreferences";
import { useProjectQueues } from "../hooks/useProjectQueues";
import { useProjects } from "../hooks/useProjects";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useVersion } from "../hooks/useVersion";
import { useI18n } from "../i18n";
import { MainContent, useNavigationLayout } from "../layouts";
import { useInboxCountsByProject } from "../lib/clientSummaryStore";
import {
  LAUNCH_SOURCE_LABEL_KEYS,
  sortLaunchSources,
} from "../lib/launchSource";
import { newProjectBaseFor } from "../lib/newProjectPath";
import {
  PROJECT_SORTS,
  projectSourceScope,
  scopeProject,
  sortProjects,
} from "../lib/projectListView";
import { serverSupportsProjectQueue } from "../lib/projectQueueVisibility";
import type { Project } from "../types";
import styles from "./ProjectsPage.module.css";

const EMPTY_PROJECT_QUEUE_PROJECT_IDS: readonly string[] = [];
/** Cards rendered per page; the rest render as the list scrolls. */
const PROJECTS_PAGE_SIZE = 30;

function AddIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function ProjectsPage() {
  const { t } = useI18n();
  const { projects, loading, error, refetch } = useProjects();
  const { version } = useVersion();
  const supportsProjectQueue = serverSupportsProjectQueue(version);
  const supportsProjectQueueAttachmentEditing = serverHasCapability(
    version,
    PROJECT_QUEUE_ATTACHMENT_EDITING_CAPABILITY,
  );
  const supportsProjectSessionDefaults = serverHasCapability(
    version,
    PROJECT_SESSION_DEFAULTS_CAPABILITY,
  );
  const supportsProjectCodeNames = serverHasCapability(
    version,
    PROJECT_CODE_NAMES_CAPABILITY,
  );
  const supportsProjectCaptions = serverHasCapability(
    version,
    PROJECT_CAPTIONS_CAPABILITY,
  );
  const supportsProjectNames = serverHasCapability(
    version,
    PROJECT_NAMES_CAPABILITY,
  );
  const { projectCodeNamesEnabled } = useProjectCodeNamePreferences();
  const { principal } = useActingPrincipal();
  const personalRemoval =
    principal.username !== null &&
    serverHasCapability(
      version,
      SERVER_CAPABILITIES.personalProjectHiding.name,
    );
  const newProjectBase = newProjectBaseFor(principal);
  const inboxCountsByProject = useInboxCountsByProject();
  const [showAddForm, setShowAddForm] = useState(false);
  const {
    choices: templateChoices,
    error: templateError,
    emptyMessageKey,
  } = useProjectTemplateChoices(showAddForm);
  const limitedTemplateOnly =
    !!templateChoices?.enabled && principal.username !== null;
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [settingsProject, setSettingsProject] = useState<Project | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null,
  );
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const basePath = useRemoteBasePath();
  const highlightedQueueItemId = searchParams.get("queueItem");

  const { openSidebar, isWideScreen } = useNavigationLayout();

  const projectIds = useMemo(
    () => projects.map((project) => project.id),
    [projects],
  );
  const projectQueueProjectIds = supportsProjectQueue
    ? projectIds
    : EMPTY_PROJECT_QUEUE_PROJECT_IDS;
  const projectQueues = useProjectQueues(projectQueueProjectIds);
  const queueStateByProject = useMemo(() => {
    if (!supportsProjectQueue) {
      return new Map<string, { count: number; hasFailed: boolean }>();
    }
    const queueState = new Map<string, { count: number; hasFailed: boolean }>();
    for (const [projectId, items] of Object.entries(
      projectQueues.queuesByProject,
    )) {
      const visibleCount = items.filter(
        (item) => item.status === "queued" || item.status === "failed",
      ).length;
      if (visibleCount > 0) {
        queueState.set(projectId, {
          count: visibleCount,
          hasFailed: items.some((item) => item.status === "failed"),
        });
      }
    }
    return queueState;
  }, [projectQueues.queuesByProject, supportsProjectQueue]);

  const { hideAutomationSessions } = useHideAutomationSessions();
  const { sort, setSort, sources, setSources } = useProjectListPreferences();
  const sourceScope = useMemo(
    () => projectSourceScope(sources, hideAutomationSessions),
    [sources, hideAutomationSessions],
  );
  // Projects holding each source, for the picker.
  const projectCountsBySource = useMemo(() => {
    const counts = new Map<LaunchSource, number>();
    for (const project of projects) {
      for (const [source, count] of Object.entries(
        project.sessionCountsBySource ?? {},
      )) {
        if (count)
          counts.set(
            source as LaunchSource,
            (counts.get(source as LaunchSource) ?? 0) + 1,
          );
      }
    }
    return counts;
  }, [projects]);
  // Counted and ordered by the in-scope sources. A project that needs
  // attention always shows: hiding it would hide the ask.
  const sortedProjects = useMemo(() => {
    const needsAttention = (projectId: string) =>
      inboxCountsByProject.get(projectId)?.needsAttention ?? 0;
    const scoped = projects.flatMap((project) => {
      const shown =
        scopeProject(project, sourceScope) ??
        (needsAttention(project.id) > 0 ? project : null);
      return shown ? [shown] : [];
    });
    return sortProjects(scoped, sort, needsAttention);
  }, [projects, inboxCountsByProject, sourceScope, sort]);
  const reveal = useIncrementalReveal(
    sortedProjects.length,
    PROJECTS_PAGE_SIZE,
    `${sort}|${[...(sourceScope ?? [])].join(",")}`,
  );

  const handleAddProject = async ({
    path,
    name,
    codeName,
  }: AddProjectRequest) => {
    setAdding(true);
    setAddError(null);

    const finish = (project: Project) => {
      void refetch();
      setShowAddForm(false);
      // A just-added project has no sessions to list, so confirming the
      // form goes straight to starting its first session.
      navigate(
        `${basePath}/new-session?projectId=${encodeURIComponent(project.id)}`,
      );
    };

    try {
      const { project } = await api.addProject(path, { name, codeName });
      finish(project);
    } catch (err) {
      // A path that does not exist yet is offered rather than refused: VIBEALLDAY
      // creates the directory as a Git repository with one empty commit,
      // but only after the user says so.
      if ((err as { status?: number }).status === 404) {
        if (confirm(t("projectsCreateConfirm", { path }))) {
          try {
            const { project } = await api.addProject(path, {
              create: true,
              name,
              codeName,
            });
            finish(project);
            return;
          } catch (createErr) {
            setAddError(
              createErr instanceof Error
                ? createErr.message
                : t("projectsAddFailed"),
            );
            return;
          } finally {
            setAdding(false);
          }
        }
      }
      setAddError(err instanceof Error ? err.message : t("projectsAddFailed"));
    } finally {
      setAdding(false);
    }
  };

  // A limited user copies into their own project directory, so only
  // projects not already theirs; the superuser copies a limited user's.
  const supportsProjectCopy = serverHasCapability(
    version,
    SERVER_CAPABILITIES.projectCopy.name,
  );
  const mayCopy = (project: Project) =>
    supportsProjectCopy &&
    (principal.username === null
      ? !!project.ownerUsername
      : !!principal.grants?.projectRoot &&
        project.ownerUsername !== principal.username);

  const handleCopyProject = async (project: Project) => {
    const name = prompt(t("projectCopyPrompt"), `${project.name}-copy`);
    if (!name?.trim()) return;
    setDeleteError(null);
    try {
      const { path } = await projectAccessApi.copy(project.id, name.trim());
      const { project: copy } = await api.addProject(path);
      await refetch();
      navigate(
        `${basePath}/new-session?projectId=${encodeURIComponent(copy.id)}`,
      );
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : t("projectCopyFailed"),
      );
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (
      !confirm(
        t(
          personalRemoval
            ? "projectsRemoveFromMyProjectsConfirm"
            : "projectsDeleteConfirm",
          { name: projectDisplayName(project) },
        ),
      )
    ) {
      return;
    }

    setDeletingProjectId(project.id);
    setDeleteError(null);

    try {
      await api.deleteProject(project.id);
      await refetch();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : t("projectsDeleteFailed"),
      );
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleUpdateProjectCodeName = async (
    project: Project,
    codeName: string,
  ) => {
    await api.updateProjectCodeName(project.id, codeName);
    await refetch();
  };

  const handleUpdateProjectCaption = async (
    project: Project,
    caption: string | null,
  ) => {
    await api.updateProjectCaption(project.id, caption);
    await refetch();
  };

  const handleDeleteQueueItem = async (projectId: string, itemId: string) => {
    try {
      await projectQueues.deleteItem(projectId, itemId);
    } catch {
      // The hook exposes the error in the queue section.
    }
  };

  const handleResumeRecoveredQueueItem = async (
    sessionId: string,
    queueId: string,
  ) => {
    try {
      await projectQueues.resumeRecoveredItem(sessionId, queueId);
    } catch {
      // The hook exposes the error in the queue section.
    }
  };

  const handleDeleteRecoveredQueueItem = async (
    sessionId: string,
    queueId: string,
  ) => {
    try {
      await projectQueues.deleteRecoveredItem(sessionId, queueId);
    } catch {
      // The hook exposes the error in the queue section.
    }
  };

  const handlePauseProjectQueue = async () => {
    try {
      await projectQueues.pauseDispatch();
    } catch {
      // The hook exposes the error in the queue section.
    }
  };

  const handleResumeProjectQueue = async () => {
    try {
      await projectQueues.resumeDispatch();
    } catch {
      // The hook exposes the error in the queue section.
    }
  };

  const handlePromoteProjectQueueItem = async (
    projectId: string,
    itemId: string,
    options?: { force?: boolean },
  ) => {
    try {
      await projectQueues.promoteNow(projectId, itemId, options);
    } catch {
      // The hook exposes the error in the queue section.
    }
  };

  const handleRetryQueueItem = async (projectId: string, itemId: string) => {
    try {
      await projectQueues.retryItem(projectId, itemId);
    } catch {
      // The hook exposes the error in the queue section.
    }
  };

  const handleMoveQueueItemToTop = async (
    projectId: string,
    itemId: string,
  ) => {
    try {
      await projectQueues.moveItemToTop(projectId, itemId);
    } catch {
      // The hook exposes the error in the queue section.
    }
  };

  const handleUpdateQueueItem = async (
    projectId: string,
    itemId: string,
    message: ProjectQueueMessage,
  ) => {
    await projectQueues.updateItem(projectId, itemId, { message });
  };

  const isEmpty = projects.length === 0;
  const closeAddForm = () => {
    setShowAddForm(false);
    setAddError(null);
  };

  return (
    <MainContent isWideScreen={isWideScreen}>
      <PageHeader
        title={t("pageTitleProjects")}
        description={t("consoleProjectsDescription")}
        onOpenSidebar={openSidebar}
        isWideScreen={isWideScreen}
      />

      <main className="page-scroll-container">
        <div className={`page-content-inner ${styles.page}`}>
          {error && (
            <div className={styles.loadError} role="status">
              <span>
                {t("projectsErrorPrefix")} {error.message}
              </span>
              <Button variant="secondary" onClick={() => void refetch()}>
                {t("hostOfflineRetry")}
              </Button>
            </div>
          )}
          <div className={styles.toolbar}>
            <span className={styles.count}>
              {!isEmpty &&
                t("projectsShownCount", {
                  shown: sortedProjects.length,
                  total: projects.length,
                })}
            </span>
            <Button
              variant="primary"
              icon={<AddIcon />}
              onClick={() => setShowAddForm(true)}
            >
              {t("projectsAdd")}
            </Button>
          </div>
          {deleteError && <div className={formStyles.error}>{deleteError}</div>}

          {!isEmpty && (
            <div className={styles.filters}>
              <FilterDropdown
                label={t("sessionSearchSources")}
                className={styles.pill}
                placeholder={
                  hideAutomationSessions
                    ? t("sessionSearchSourcesNoAutomation")
                    : t("sessionSearchSources")
                }
                options={[
                  {
                    value: "",
                    label: t("sessionSearchSourcesAll"),
                    clearSelection: true,
                  },
                  ...sortLaunchSources(projectCountsBySource.keys()).map(
                    (source) => ({
                      value: source,
                      label: t(LAUNCH_SOURCE_LABEL_KEYS[source]),
                      count: projectCountsBySource.get(source),
                    }),
                  ),
                ]}
                selected={sources}
                onChange={setSources}
              />
              <FilterDropdown
                label={t("projectsSort")}
                className={styles.pill}
                options={PROJECT_SORTS.map((value) => ({
                  value,
                  label: t(`projectsSort_${value}`),
                }))}
                selected={[sort]}
                onChange={(value) => {
                  if (value[0]) setSort(value[0]);
                }}
                multiSelect={false}
              />
            </div>
          )}

          {loading && projects.length === 0 && (
            <LoadingState label={t("projectsLoading")} />
          )}

          {supportsProjectQueue && (
            <ProjectQueueSection
              projects={projects}
              items={projectQueues.items}
              recoveredSessionQueues={projectQueues.recoveredSessionQueues}
              loading={projectQueues.loading}
              error={projectQueues.error}
              mutatingItemId={projectQueues.mutatingItemId}
              mutatingRecoveredQueueId={projectQueues.mutatingRecoveredQueueId}
              mutatingDispatchState={projectQueues.mutatingDispatchState}
              mutatingPromoteItemId={projectQueues.mutatingPromoteItemId}
              dispatchState={projectQueues.dispatchState}
              projectStatusesByProject={projectQueues.projectStatusesByProject}
              highlightedItemId={highlightedQueueItemId}
              basePath={basePath}
              attachmentEditingEnabled={supportsProjectQueueAttachmentEditing}
              onPauseDispatch={handlePauseProjectQueue}
              onResumeDispatch={handleResumeProjectQueue}
              onPromoteNow={handlePromoteProjectQueueItem}
              onDeleteItem={handleDeleteQueueItem}
              onResumeRecoveredItem={handleResumeRecoveredQueueItem}
              onDeleteRecoveredItem={handleDeleteRecoveredQueueItem}
              onRetryItem={handleRetryQueueItem}
              onMoveItemToTop={handleMoveQueueItemToTop}
              onUpdateItem={handleUpdateQueueItem}
            />
          )}

          {!isEmpty && sortedProjects.length === 0 && (
            <p className={styles.note}>{t("projectsNoMatch")}</p>
          )}

          {isEmpty ? (
            !loading &&
            !error && (
              <EmptyState
                icon={<FolderIcon />}
                title={t("projectsEmptyTitle")}
                hint={t("projectsEmptyDescription")}
              />
            )
          ) : (
            <ul className={`project-list-cards ${styles.cards}`}>
              {sortedProjects.slice(0, reveal.visible).map((project) => (
                <ProjectCard
                  appEnabled={serverHasCapability(
                    version,
                    SERVER_CAPABILITIES.projectService.name,
                  )}
                  key={project.id}
                  project={project}
                  needsAttentionCount={
                    inboxCountsByProject.get(project.id)?.needsAttention ?? 0
                  }
                  thinkingCount={
                    inboxCountsByProject.get(project.id)?.active ?? 0
                  }
                  queueCount={queueStateByProject.get(project.id)?.count ?? 0}
                  hasQueueWarning={
                    queueStateByProject.get(project.id)?.hasFailed ?? false
                  }
                  basePath={basePath}
                  onDeleteProject={handleDeleteProject}
                  deleteLabel={
                    personalRemoval
                      ? t("projectsRemoveFromMyProjects")
                      : undefined
                  }
                  onOpenSettings={
                    supportsProjectSessionDefaults
                      ? setSettingsProject
                      : undefined
                  }
                  onCopy={
                    mayCopy(project)
                      ? (copied) => void handleCopyProject(copied)
                      : undefined
                  }
                  onUpdateCodeName={
                    supportsProjectCodeNames && projectCodeNamesEnabled
                      ? handleUpdateProjectCodeName
                      : undefined
                  }
                  onUpdateCaption={
                    supportsProjectCaptions
                      ? handleUpdateProjectCaption
                      : undefined
                  }
                  isDeleting={deletingProjectId === project.id}
                />
              ))}
            </ul>
          )}
          {!isEmpty && reveal.hasMore && (
            <div ref={reveal.sentinelRef} className={styles.showMore}>
              <Button variant="secondary" onClick={reveal.showMore}>
                {t("projectsShowMore", {
                  count: sortedProjects.length - reveal.visible,
                })}
              </Button>
            </div>
          )}
        </div>
      </main>
      {showAddForm && (
        <AddProjectSheet
          projects={projects}
          pathBase={newProjectBase}
          chooseName={supportsProjectNames}
          chooseCodeName={
            supportsProjectNames &&
            supportsProjectCodeNames &&
            projectCodeNamesEnabled
          }
          adding={adding}
          error={addError}
          templateChoices={templateChoices}
          templateError={templateError}
          emptyMessageKey={emptyMessageKey}
          limitedTemplateOnly={limitedTemplateOnly}
          onSubmit={(request) => void handleAddProject(request)}
          onClose={closeAddForm}
          onTemplateStarted={(projectId, sessionId) => {
            void refetch();
            navigate(`${basePath}/projects/${projectId}/sessions/${sessionId}`);
          }}
        />
      )}
      {settingsProject && (
        <ProjectSessionDefaultsModal
          projectId={settingsProject.id}
          projectName={settingsProject.name}
          ownerUsername={settingsProject.ownerUsername}
          onClose={() => setSettingsProject(null)}
        />
      )}
    </MainContent>
  );
}
