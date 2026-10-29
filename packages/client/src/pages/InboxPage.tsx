import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { Crumb } from "../components/garden/Breadcrumb";
import { InboxContent } from "../components/InboxContent";
import { PageHeader } from "../components/PageHeader";
import { SessionViews } from "../components/SessionViews";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useSessionOverview } from "../hooks/useSessionOverview";
import { useProjects } from "../hooks/useProjects";
import { useI18n } from "../i18n";
import { MainContent, useNavigationLayout } from "../layouts";

/**
 * Overview: what waits on the user, what runs, and recent conversations,
 * across projects or scoped to one with `?project=`.
 *
 * On the phone tab-bar layout the page sits under the Sessions tab, so the
 * top bar names that tab while the heading names the active Overview view;
 * elsewhere the top bar and heading both say "Overview".
 */
export function InboxPage() {
  const { t } = useI18n();
  const { openSidebar, isWideScreen, tabBarNavigation } = useNavigationLayout();
  const basePath = useRemoteBasePath();
  const { projects } = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();

  const projectId = searchParams.get("project") ?? undefined;
  const overview = useSessionOverview(projectId);

  const handleProjectChange = useCallback(
    (newProjectId: string | undefined) => {
      if (newProjectId) {
        setSearchParams({ project: newProjectId });
      } else {
        setSearchParams({});
      }
    },
    [setSearchParams],
  );

  const projectName = useMemo(() => {
    if (!projectId) return undefined;
    return projects.find((p) => p.id === projectId)?.name;
  }, [projectId, projects]);

  const title = t("sessionOverview");
  const headerTitle = tabBarNavigation ? t("tabSessions") : title;
  const breadcrumbs: Crumb[] | undefined = projectName
    ? [{ label: headerTitle, to: `${basePath}/inbox` }, { label: projectName }]
    : undefined;

  return (
    <MainContent isWideScreen={isWideScreen}>
      <PageHeader
        title={headerTitle}
        intro="content"
        breadcrumbs={breadcrumbs}
        onOpenSidebar={openSidebar}
        isWideScreen={isWideScreen}
      />
      <SessionViews />

      <InboxContent
        projectId={projectId}
        projects={projects}
        onProjectChange={handleProjectChange}
        overview={overview}
        title={title}
        eyebrow={projectName ? [projectName] : undefined}
        lede={t("consoleOverviewDescription")}
      />
    </MainContent>
  );
}
