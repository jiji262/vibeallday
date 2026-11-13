import {
  GIT_STATUS_ENHANCED_CAPABILITY,
  serverHasCapability,
} from "@vibeallday/shared";
import { Link } from "react-router-dom";
import { GitBranchIcon } from "../components/garden/icons";
import { useGitStatus } from "../hooks/useGitStatus";
import { useVersion } from "../hooks/useVersion";
import { useI18n } from "../i18n";
import styles from "./ProjectHomePage.module.css";

const BRANCH_ICON_SIZE = 13;

/** Branch chip linking to Source Control, when the server reports status. */
export function ProjectBranchChip({
  projectId,
  sourceHref,
}: {
  projectId: string;
  /** Source Control for the project. */
  sourceHref: string;
}) {
  const { t } = useI18n();
  const { version } = useVersion();
  const enabled = serverHasCapability(version, GIT_STATUS_ENHANCED_CAPABILITY);
  const { gitStatus } = useGitStatus(enabled ? projectId : undefined, {
    omitUntracked: true,
    poll: false,
  });
  if (!enabled || !gitStatus?.isGitRepo) return null;
  const branch = gitStatus.branch ?? t("gitStatusDetachedHead");
  return (
    <Link
      to={sourceHref}
      className={styles.branch}
      aria-label={t("projectHomeBranchLabel", { branch })}
    >
      <GitBranchIcon size={BRANCH_ICON_SIZE} />
      <span className={styles.branchName}>{branch}</span>
      {gitStatus.ahead > 0 && (
        <span className={styles.branchMeta}>
          {t("projectHomeBranchAhead", { count: gitStatus.ahead })}
        </span>
      )}
      {gitStatus.behind > 0 && (
        <span className={styles.branchMeta}>
          {t("projectHomeBranchBehind", { count: gitStatus.behind })}
        </span>
      )}
    </Link>
  );
}
