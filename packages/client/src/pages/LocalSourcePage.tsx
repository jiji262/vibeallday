import type { LocalSourceRoot } from "@vibeallday/shared";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { EmptyState } from "../components/garden/EmptyState";
import { FolderIcon } from "../components/garden/icons";
import { PageHeader } from "../components/PageHeader";
import { PageIntro } from "../components/shell/PageIntro";
import { GlossaryProjectBoundary } from "../contexts/GlossaryContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useI18n } from "../i18n";
import { MainContent, useNavigationLayout } from "../layouts";
import { getPathBasename } from "../lib/text";
import { BlameBrowser } from "./BlameBrowser";
import styles from "./LocalSourcePage.module.css";

/**
 * LocalSourcePage - Source Control's current-files browser for a path outside
 * the project, opened in a new tab from a path link's menu.
 * Route: /projects/:projectId/browse?path=<absolute path>
 *
 * The project only authorizes the reads; the browsed directory is not a
 * project, so the view is a one-shot snapshot with no live updates, review
 * comments, or blame.
 */
export function LocalSourcePage() {
  const { t } = useI18n();
  const { openSidebar, isWideScreen } = useNavigationLayout();
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const requestedPath = searchParams.get("path");
  const [root, setRoot] = useState<LocalSourceRoot | null>(null);
  const title = root?.path ?? requestedPath;
  // Without ?path= there is nothing to browse: the page names itself instead
  // of repeating "Source Control" as its own folder name.
  const name = title ? getPathBasename(title) : t("localSourceTitle");
  useDocumentTitle(name, undefined, t("gitStatusTitle"));

  return (
    <MainContent isWideScreen={isWideScreen}>
      <PageHeader
        title={name}
        intro="content"
        breadcrumbs={[{ label: t("gitStatusTitle") }, { label: name }]}
        onOpenSidebar={openSidebar}
        isWideScreen={isWideScreen}
      />
      <main className="page-scroll-container">
        <div className="page-content-inner">
          <PageIntro
            eyebrow={[t("gitStatusTitle")]}
            title={name}
            lede={
              title ? (
                <span className={styles.path} title={title}>
                  {title}
                </span>
              ) : undefined
            }
          />
          {!projectId || !requestedPath ? (
            <MissingPathState projectId={projectId} />
          ) : (
            <GlossaryProjectBoundary projectId={projectId}>
              <div className="git-status">
                <BlameBrowser
                  key={requestedPath}
                  projectId={projectId}
                  isWideScreen={isWideScreen}
                  supportsWorkingTreeFiles
                  localSourcePath={requestedPath}
                  onLocalSourceRoot={setRoot}
                  t={t}
                />
              </div>
            </GlossaryProjectBoundary>
          )}
        </div>
      </main>
    </MainContent>
  );
}

/** The route needs ?path=; say so and offer the project's Source Control. */
function MissingPathState({ projectId }: { projectId?: string }) {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  const target = projectId
    ? `${basePath}/git-status?projectId=${encodeURIComponent(projectId)}`
    : `${basePath}/projects`;
  return (
    <EmptyState
      title={t("localSourceMissingPathTitle")}
      hint={t("localSourceMissingPathHint")}
      icon={<FolderIcon />}
      action={
        <Link to={target} className={styles.action}>
          {t(projectId ? "localSourceOpenSourceControl" : "fileGoToProjects")}
        </Link>
      }
    />
  );
}
