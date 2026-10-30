import {
  projectDisplayName,
  PROJECT_CAPTIONS_CAPABILITY,
  PROJECT_CODE_NAMES_CAPABILITY,
  PROJECT_NAMES_CAPABILITY,
  PROJECT_QUEUE_ATTACHMENT_EDITING_CAPABILITY,
  PROJECT_SESSION_DEFAULTS_CAPABILITY,
  type LaunchSource,
  serverHasCapability,
  SERVER_CAPABILITIES,
} from "@vibeallday/shared";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { projectAccessApi } from "../api/projectAccess";
import { useProjectTemplateChoices } from "../hooks/useProjectTemplateChoices";
import { AddProjectSheet } from "../components/AddProjectSheet";
import type { AddProjectRequest } from "../components/AddProjectForm";
import { Button } from "../components/garden/Button";
import { EmptyState } from "../components/garden/EmptyState";
import { ErrorState } from "../components/garden/ErrorState";
import { FolderIcon, PlusIcon } from "../components/garden/icons";
import { LoadingState } from "../components/garden/LoadingState";
import { Notice } from "../components/garden/Notice";
import { PageHeader } from "../components/PageHeader";
import { ProjectCard } from "../components/ProjectCard";
import { ProjectQueueSection } from "../components/ProjectQueueSection";
import { ProjectSessionDefaultsModal } from "../components/ProjectSessionDefaultsModal";
import { PageIntro } from "../components/shell/PageIntro";
import { pageWidthClass } from "../components/shell/pageWidth";
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
import { newProjectBaseFor } from "../lib/newProjectPath";
import {
  projectSourceScope,
  scopeProject,
  sortProjects,
} from "../lib/projectListView";
import { serverSupportsProjectQueue } from "../lib/projectQueueVisibility";
import type { Project } from "../types";
import { ProjectsList } from "./ProjectsList";
import styles from "./ProjectsPage.module.css";
import { ProjectsToolbar } from "./ProjectsToolbar";
import { filterProjectsByQuery } from "./projectSearch";
import { projectsQueueHandlers } from "./projectsQueueHandlers";

const EMPTY_PROJECT_QUEUE_PROJECT_IDS: readonly string[] = [];
/** Cards rendered per page; the rest render as the list scrolls. */
const PROJECTS_PAGE_SIZE = 30;

const EMPTY_ICON_SIZE = 18;

/** Router state the sidebar's project switcher sends to open Add project. */
function wantsAddProject(state: unknown): boolean {
  return (
    typeof state === "object" &&
    state !== null &&
    (state as { addProject?: unknown }).addProject === true
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
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // The sidebar's project switcher asks for Add project through router
  // state; clearing it keeps a refresh or Back from reopening the sheet.
  const addProjectRequested = wantsAddProject(location.state);
  useEffect(() => {
    if (!addProjectRequested) return;
    setShowAddForm(true);
    navigate(location.pathname + location.search, {
      replace: true,
      state: null,
    });
  }, [addProjectRequested, location.pathname, location.search, navigate]);
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
  // The field echoes `query` at once; filtering follows the deferred copy.
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const filteredProjects = useMemo(
    () => filterProjectsByQuery(sortedProjects, deferredQuery),
    [sortedProjects, deferredQuery],
  );
  const reveal = useIncrementalReveal(
    filteredProjects.length,
    PROJECTS_PAGE_SIZE,
    `${sort}|${[...(sourceScope ?? [])].join(",")}|${deferredQuery}`,
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

  const isEmpty = projects.length === 0;
  const closeAddForm = () => {
    setShowAddForm(false);
    setAddError(null);
  };
  const openAddForm = () => setShowAddForm(true);
  const appEnabled = serverHasCapability(
    version,
    SERVER_CAPABILITIES.projectService.name,
  );

  const renderProject = (project: Project) => (
    <ProjectCard
      appEnabled={appEnabled}
      key={project.id}
      project={project}
      needsAttentionCount={
        inboxCountsByProject.get(project.id)?.needsAttention ?? 0
      }
      thinkingCount={inboxCountsByProject.get(project.id)?.active ?? 0}
      queueCount={queueStateByProject.get(project.id)?.count ?? 0}
      hasQueueWarning={queueStateByProject.get(project.id)?.hasFailed ?? false}
      basePath={basePath}
      onDeleteProject={handleDeleteProject}
      deleteLabel={
        personalRemoval ? t("projectsRemoveFromMyProjects") : undefined
      }
      onOpenSettings={
        supportsProjectSessionDefaults ? setSettingsProject : undefined
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
        supportsProjectCaptions ? handleUpdateProjectCaption : undefined
      }
      isDeleting={deletingProjectId === project.id}
    />
  );

  return (
    <MainContent isWideScreen={isWideScreen}>
      <PageHeader
        title={t("pageTitleProjects")}
        intro="content"
        onOpenSidebar={openSidebar}
        isWideScreen={isWideScreen}
      />

      <main className="page-scroll-container">
        <div className={`page-content-inner ${pageWidthClass("wide")}`}>
          <PageIntro
            title={t("pageTitleProjects")}
            lede={t("consoleProjectsDescription")}
            actions={
              <Button
                variant="primary"
                icon={<PlusIcon />}
                onClick={openAddForm}
              >
                {t("projectsAdd")}
              </Button>
            }
          />
          {error && (
            <ErrorState
              inline
              className={styles.notice}
              tag={t("errorTag")}
              message={`${t("projectsErrorPrefix")} ${error.message}`}
              onRetry={() => void refetch()}
              retryLabel={t("retry")}
            />
          )}
          {deleteError && (
            <Notice tone="danger" role="alert" className={styles.notice}>
              {deleteError}
            </Notice>
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
              collapsible
              {...projectsQueueHandlers(projectQueues)}
            />
          )}

          {!isEmpty && (
            <ProjectsToolbar
              query={query}
              onQueryChange={setQuery}
              sources={sources}
              onSourcesChange={setSources}
              projectCountsBySource={projectCountsBySource}
              hideAutomationSessions={hideAutomationSessions}
              sort={sort}
              onSortChange={setSort}
              shown={filteredProjects.length}
              total={projects.length}
            />
          )}

          {loading && isEmpty && (
            <LoadingState label={t("projectsLoading")} variant="list" />
          )}

          {isEmpty ? (
            !loading &&
            !error && (
              <EmptyState
                icon={<FolderIcon size={EMPTY_ICON_SIZE} />}
                title={t("projectsEmptyTitle")}
                hint={t("projectsEmptyDescription")}
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<PlusIcon />}
                    onClick={openAddForm}
                  >
                    {t("projectsEmptyAdd")}
                  </Button>
                }
              />
            )
          ) : (
            <ProjectsList
              noMatch={filteredProjects.length === 0}
              remaining={filteredProjects.length - reveal.visible}
              onShowMore={reveal.showMore}
              onAddProject={openAddForm}
              sentinelRef={reveal.sentinelRef}
            >
              {filteredProjects.slice(0, reveal.visible).map(renderProject)}
            </ProjectsList>
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
