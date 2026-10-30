import type { LocalSourceRoot } from "@vibeallday/shared";
import { useCallback, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Tag } from "../components/garden/Badge";
import { Button } from "../components/garden/Button";
import { CopyChip } from "../components/garden/CopyChip";
import { EmptyState } from "../components/garden/EmptyState";
import { FolderIcon, RefreshIcon } from "../components/garden/icons";
import { Notice } from "../components/garden/Notice";
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
  // Local time the current snapshot arrived; a refresh remounts the browser.
  const [snapshotAt, setSnapshotAt] = useState<Date | null>(null);
  const [snapshotGeneration, setSnapshotGeneration] = useState(0);
  const handleRoot = useCallback((next: LocalSourceRoot) => {
    setRoot(next);
    setSnapshotAt(new Date());
  }, []);
  const title = root?.path ?? requestedPath;
  const snapshotTime = snapshotAt ? formatSnapshotTime(snapshotAt) : null;
  const canBrowse = Boolean(projectId && requestedPath);
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
            title={name}
            lede={
              title ? (
                <span className={styles.lede}>
                  {snapshotTime ? (
                    <Tag>
                      {t("localSourceSnapshotTag", { time: snapshotTime })}
                    </Tag>
                  ) : null}
                  <span className={styles.path} title={title}>
                    {title}
                  </span>
                  <CopyChip
                    value={title}
                    label={t("sourceCopyPath")}
                    copiedLabel={t("copied")}
                  />
                </span>
              ) : undefined
            }
            actions={
              canBrowse ? (
                <Button
                  size="sm"
                  icon={<RefreshIcon />}
                  onClick={() => setSnapshotGeneration((value) => value + 1)}
                >
                  {t("localSourceRefresh")}
                </Button>
              ) : undefined
            }
          />
          {canBrowse && snapshotTime ? (
            <Notice className={styles.notice}>
              {t("localSourceSnapshotNotice", { time: snapshotTime })}
            </Notice>
          ) : null}
          {!projectId || !requestedPath ? (
            <MissingPathState projectId={projectId} />
          ) : (
            <GlossaryProjectBoundary projectId={projectId}>
              <div className="git-status">
                <BlameBrowser
                  key={`${requestedPath}\0${snapshotGeneration}`}
                  projectId={projectId}
                  isWideScreen={isWideScreen}
                  supportsWorkingTreeFiles
                  localSourcePath={requestedPath}
                  onLocalSourceRoot={handleRoot}
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

const SNAPSHOT_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
};

/** Local wall-clock time of the snapshot fetch. */
function formatSnapshotTime(at: Date): string {
  return at.toLocaleTimeString(undefined, SNAPSHOT_TIME_FORMAT);
}
