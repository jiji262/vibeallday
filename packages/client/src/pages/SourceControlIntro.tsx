import type { GitStatusInfo } from "@vibeallday/shared";
import { ProjectSelector } from "../components/ProjectSelector";
import { PageIntro } from "../components/shell/PageIntro";
import type { GitActionState } from "../hooks/useGitActions";
import type { TranslationFn } from "../i18n";
import { RepoStatusBar } from "./RepoStatusBar";
import { SourceHeaderControls } from "./SourceActionControls";
import styles from "./SourceControlIntro.module.css";
import { SourceModeTabs } from "./SourceModeTabs";
import {
  SOURCE_TABS,
  SOURCE_TABS_WITH_REVIEWS,
  useSourceTab,
} from "./useSourceTab";

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
 * The Source Control page head (license-hub page intro): the project as the
 * title (a project switcher when there are several), repository state under
 * it, repository operations as the page actions, and the mode tabs as the
 * filter row. It scrolls with the page instead of riding the fixed top bar.
 */
export function SourceControlIntro(props: SourceControlIntroProps) {
  const { status, workbench, codeName, t } = props;
  const gitStatus = status?.isGitRepo ? status : null;
  const activeWorkbench = gitStatus ? workbench : undefined;
  const repoStatus = <IntroRepoStatus {...props} />;
  return (
    <PageIntro
      className={styles.intro}
      eyebrow={
        codeName
          ? [t("gitStatusTitle"), t("sourceIntroCodeName", { codeName })]
          : [t("gitStatusTitle")]
      }
      title={<IntroTitle {...props} />}
      actions={
        activeWorkbench ? (
          <SourceHeaderControls
            gitActions={activeWorkbench.gitActions}
            worktreePaused={activeWorkbench.worktreePaused}
            onToggleWorktreePaused={activeWorkbench.onToggleWorktreePaused}
            t={t}
          />
        ) : undefined
      }
      filters={
        gitStatus && props.projectId ? (
          <div className={styles.rows}>
            {repoStatus}
            {activeWorkbench ? (
              <SourceIntroTabs
                status={gitStatus}
                workbench={activeWorkbench}
                t={t}
              />
            ) : null}
          </div>
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
  const { tab, setTab } = useSourceTab(workbench.reviewsEnabled);
  return (
    <SourceModeTabs
      tab={tab}
      tabs={workbench.reviewsEnabled ? SOURCE_TABS_WITH_REVIEWS : SOURCE_TABS}
      variant="stacked"
      counts={{
        changes: countChangedPaths(status),
        comments: workbench.pendingCount,
      }}
      fileTabLabelKey={
        workbench.supportsWorkingTreeFiles ? "sourceTabWorkingTree" : undefined
      }
      onSelect={setTab}
      t={t}
    />
  );
}

export function countChangedPaths(status: GitStatusInfo): number {
  return new Set(status.files.map((file) => file.path)).size;
}
