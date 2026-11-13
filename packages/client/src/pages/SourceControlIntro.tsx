import type { GitStatusInfo } from "@vibeallday/shared";
import { ProjectSelector } from "../components/ProjectSelector";
import { PageIntro } from "../components/shell/PageIntro";
import type { GitActionState } from "../hooks/useGitActions";
import type { TranslationFn } from "../i18n";
import { useSourceControlCleanLanding } from "../hooks/useSourceControlCleanLanding";
import { countChangedPaths, RepoStatusBar } from "./RepoStatusBar";
import { SourceSyncControls } from "./SourceActionControls.sync";
import styles from "./SourceControlIntro.module.css";
import { SourceModeTabs } from "./SourceModeTabs";
import { SOURCE_VIEW_TABS, useSourceTab } from "./useSourceTab";

export interface SourceControlIntroProps {
  projectId?: string;
  projectName?: string;
  /** Server-owned shorthand shown in the eyebrow when supported. */
  codeName?: string;
  status: GitStatusInfo | null;
  onProjectChange: (projectId: string) => void;
  supportsIncomingCommits: boolean;
  headCommitHref?: string;
  onOpenHeadCommit?: () => void;
  onSelectChanges?: () => void;
  /** Mode tabs and repository operations; off for legacy servers. */
  workbench?: SourceWorkbenchProps;
  t: TranslationFn;
}

export interface SourceWorkbenchProps {
  pendingCount: number;
  reviewsEnabled: boolean;
  supportsWorkingTreeFiles: boolean;
  gitActions: GitActionState;
  worktreePaused?: boolean;
  onToggleWorktreePaused?: () => void;
}

/**
 * The Source Control page head (design Git boards): the project as the title
 * (a switcher when there are several), the repository identity bar and the
 * Sync split as page actions, and the mode tabs as a full-width strip under
 * them. It scrolls with the page instead of riding the fixed top bar.
 */
export function SourceControlIntro(props: SourceControlIntroProps) {
  const { status, workbench, codeName, t } = props;
  const gitStatus = status?.isGitRepo ? status : null;
  const activeWorkbench = gitStatus ? workbench : undefined;
  const repoStatus = <IntroRepoStatus {...props} />;
  const sync =
    activeWorkbench && gitStatus ? (
      <SourceSyncControls
        gitActions={activeWorkbench.gitActions}
        status={gitStatus}
        worktreePaused={activeWorkbench.worktreePaused}
        onToggleWorktreePaused={activeWorkbench.onToggleWorktreePaused}
        t={t}
      />
    ) : null;
  const identity =
    gitStatus && props.projectId ? (
      <div className={styles.identity}>
        {repoStatus}
        {sync}
      </div>
    ) : undefined;
  return (
    <PageIntro
      className={styles.intro}
      eyebrow={
        codeName
          ? [t("gitStatusTitle"), t("sourceIntroCodeName", { codeName })]
          : [t("gitStatusTitle")]
      }
      title={<IntroTitle {...props} />}
      actions={identity}
      filters={
        activeWorkbench && gitStatus ? (
          <SourceIntroTabs
            status={gitStatus}
            workbench={activeWorkbench}
            t={t}
          />
        ) : undefined
      }
    />
  );
}

/** The project as the title: a switcher when there are several projects. */
function IntroTitle({
  projectId,
  projectName,
  onProjectChange,
  t,
}: SourceControlIntroProps) {
  if (!projectId) return t("gitStatusTitle");
  return (
    <span className={styles.title}>
      <ProjectSelector
        currentProjectId={projectId}
        currentProjectName={projectName}
        onProjectChange={(project) => onProjectChange(project.id)}
      />
    </span>
  );
}

function IntroRepoStatus({
  projectId,
  status,
  supportsIncomingCommits,
  onSelectChanges,
  headCommitHref,
  onOpenHeadCommit,
  t,
}: SourceControlIntroProps) {
  if (!projectId || !status?.isGitRepo) return null;
  return (
    <RepoStatusBar
      status={status}
      projectId={projectId}
      supportsIncomingCommits={supportsIncomingCommits}
      className={`source-header-repo-status ${styles.repoStatus}`}
      onSelectChanges={onSelectChanges}
      headCommitHref={headCommitHref}
      onOpenHeadCommit={onOpenHeadCommit}
      t={t}
    />
  );
}

function SourceIntroTabs({
  status,
  workbench,
  t,
}: {
  status: GitStatusInfo;
  workbench: SourceWorkbenchProps;
  t: TranslationFn;
}) {
  const { sourceControlCleanLanding } = useSourceControlCleanLanding();
  const { view, setView } = useSourceTab({
    reviewsEnabled: workbench.reviewsEnabled,
    cleanLatestLanding:
      status.isClean && sourceControlCleanLanding === "latest-commit",
  });
  return (
    <SourceModeTabs
      tab={view}
      tabs={SOURCE_VIEW_TABS}
      variant="stacked"
      counts={{
        changes: countChangedPaths(status),
        review: workbench.pendingCount,
      }}
      fileTabLabelKey={
        workbench.supportsWorkingTreeFiles ? "sourceTabWorkingTree" : undefined
      }
      onSelect={setView}
      t={t}
    />
  );
}
