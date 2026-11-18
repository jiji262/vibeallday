import { projectDisplayName } from "@vibeallday/shared";
import { type MouseEvent, useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { shortenPath } from "../lib/text";
import type { Project } from "../types";
import { IconButton } from "./garden/Button";
import { FolderIcon, MoreHorizontalIcon, PlusIcon } from "./garden/icons";
import { ActionSheet, type ActionSheetItem } from "./garden/Sheet";
import { StatusDot } from "./garden/StatusDot";
import styles from "./ProjectCard.module.css";
import { ProjectCaptionEditor } from "./ProjectCaptionEditor";
import { ProjectCodeNameEditor } from "./ProjectCodeNameEditor";
import { formatProjectAge } from "./projectRelativeTime";
import type { ModalAnchorRect } from "./ui/Modal";

export interface ProjectCardProps {
  appEnabled?: boolean;
  project: Project;
  /** Number of sessions needing approval/input in this project */
  needsAttentionCount: number;
  /** Number of sessions actively thinking (running, no pending input) */
  thinkingCount: number;
  /** Number of queued/failed Project Queue items in this project */
  queueCount?: number;
  /** Whether a Project Queue item is paused for explicit retry */
  hasQueueWarning?: boolean;
  /** Base path prefix for relay mode (e.g., "/remote/my-server") */
  basePath?: string;
  /** Called when the user asks to remove the project from VIBEALLDAY lists */
  onDeleteProject?: (project: Project) => void;
  deleteLabel?: string;
  /** Called when the user opens this project's defaults */
  onOpenSettings?: (project: Project) => void;
  /** Present when this user may make their own copy of the project. */
  onCopy?: (project: Project) => void;
  /** Persists an inline edit to this project's short code name. */
  onUpdateCodeName?: (project: Project, codeName: string) => Promise<void>;
  /** Persists an inline caption override; `null` restores the derived caption. */
  onUpdateCaption?: (project: Project, caption: string | null) => Promise<void>;
  /** Whether this project is currently being removed */
  isDeleting?: boolean;
}

const REPO_ICON_SIZE = 15;
const ACTION_ICON_SIZE = 15;

function stop(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

type Translate = ReturnType<typeof useI18n>["t"];

/** App, Copy and Settings under one label; Remove gets its own group. */
function projectMenuItems(
  props: ProjectCardProps,
  t: Translate,
  openApp: () => void,
): ActionSheetItem[] {
  const { project, onCopy, onOpenSettings, onDeleteProject } = props;
  const manage = t("projectCardSectionManage");
  const candidates: (ActionSheetItem | false | undefined)[] = [
    props.appEnabled && {
      key: "app",
      label: t("projectAppOpen"),
      section: manage,
      onSelect: openApp,
    },
    onCopy && {
      key: "copy",
      label: t("projectCopyLabel"),
      hint: t("projectCopyTitle"),
      section: manage,
      onSelect: () => onCopy(project),
    },
    onOpenSettings && {
      key: "settings",
      label: t("projectCardOpenSettings"),
      section: manage,
      onSelect: () => onOpenSettings(project),
    },
    onDeleteProject && {
      key: "remove",
      label: props.deleteLabel ?? t("projectsDelete"),
      tone: "danger",
      disabled: props.isDeleting,
      onSelect: () => onDeleteProject(project),
    },
  ];
  return candidates.filter((item): item is ActionSheetItem => Boolean(item));
}

/** Folder badge, bold title linking to project home, and quiet mono codeName tag. */
function ProjectIdentity({
  project,
  basePath = "",
  onUpdateCodeName,
}: Pick<ProjectCardProps, "project" | "basePath" | "onUpdateCodeName">) {
  const [codeNameError, setCodeNameError] = useState<string | null>(null);
  const codeNameErrorId = useId();
  return (
    <div className={styles.identity}>
      <span className={styles.nameLine}>
        <Link
          to={`${basePath}/projects/${project.id}`}
          className={styles.name}
          data-project-card-link=""
        >
          {projectDisplayName(project)}
        </Link>
        {onUpdateCodeName && (
          <ProjectCodeNameEditor
            project={project}
            onUpdateCodeName={onUpdateCodeName}
            error={codeNameError}
            onErrorChange={setCodeNameError}
            errorId={codeNameErrorId}
          />
        )}
      </span>
      {onUpdateCodeName && codeNameError && (
        <span
          id={codeNameErrorId}
          className={styles.codeNameError}
          role="alert"
        >
          {codeNameError}
        </span>
      )}
    </div>
  );
}

/**
 * Structured Studio footer separating live status pills (Needs You, Running,
 * Queued) and session count on the left from relative timestamp + Open link.
 */
function ProjectFooter({
  project,
  basePath = "",
  needsAttentionCount,
  thinkingCount,
  queueCount = 0,
  hasQueueWarning = false,
}: Pick<
  ProjectCardProps,
  | "project"
  | "basePath"
  | "needsAttentionCount"
  | "thinkingCount"
  | "queueCount"
  | "hasQueueWarning"
>) {
  const { t } = useI18n();
  return (
    <div className={styles.footer}>
      <div className={styles.stats}>
        {needsAttentionCount > 0 && (
          <span className={`${styles.statPill} ${styles.statAttn}`}>
            <StatusDot state="attn" />
            {t("projectCardNeedsYou", { count: needsAttentionCount })}
          </span>
        )}
        {thinkingCount > 0 && (
          <span className={`${styles.statPill} ${styles.statRun}`}>
            <StatusDot state="run" />
            {t("projectCardRunning", { count: thinkingCount })}
          </span>
        )}
        {queueCount > 0 && (
          <span
            className={`${styles.statPill} ${styles.statQueued}`}
            title={t("projectCardQueueCount", { count: queueCount })}
          >
            <StatusDot state="queued" />
            {t("projectCardQueued", { count: queueCount })}
          </span>
        )}
        {hasQueueWarning && (
          <span
            className={styles.queueWarning}
            role="img"
            title={t("projectCardQueueWarning")}
            aria-label={t("projectCardQueueWarning")}
          >
            !
          </span>
        )}
        <span className={styles.sessionCount}>
          {t(
            project.sessionCount === 1
              ? "projectCardSessionOne"
              : "projectCardSessions",
            { count: project.sessionCount },
          )}
        </span>
      </div>
      <div className={styles.footerRight}>
        {project.lastActivity && (
          <span className={styles.timestamp}>
            {formatProjectAge(project.lastActivity, t)}
          </span>
        )}
        <Link to={`${basePath}/projects/${project.id}`} className={styles.open}>
          {t("projectCardOpen")}
        </Link>
      </div>
    </div>
  );
}

/**
 * Elevated Studio repository card: repo badge + bold title + codeName +
 * new-session & overflow icon triggers, one-line caption slot, truncated mono
 * path pill on `--surface-2`, and structured status/timestamp footer.
 */
export function ProjectCard(props: ProjectCardProps) {
  const { project, basePath = "" } = props;
  const { t } = useI18n();
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState<ModalAnchorRect | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Replaces the open sheet's back-gesture history entry, so Back from the
  // app returns to Projects in one step.
  const openApp = () =>
    navigate(`${basePath}/projects/${project.id}/app`, { replace: true });
  const menuItems = projectMenuItems(props, t, openApp);

  const openMenu = (event: MouseEvent<HTMLButtonElement>) => {
    stop(event);
    setMenuAnchor(event.currentTarget.getBoundingClientRect());
    setMenuOpen(true);
  };

  return (
    <li
      className={`${styles.card}${
        props.needsAttentionCount > 0 ? ` ${styles.cardAttn}` : ""
      }`}
    >
      <div className={styles.head}>
        <span className={styles.repoBadge} aria-hidden="true">
          <FolderIcon size={REPO_ICON_SIZE} />
        </span>
        <ProjectIdentity {...props} />
        <div className={styles.headActions}>
          <IconButton
            label={t("projectCardNewSession")}
            className={styles.iconAction}
            onClick={() =>
              navigate(`${basePath}/new-session?projectId=${project.id}`)
            }
          >
            <PlusIcon size={ACTION_ICON_SIZE} />
          </IconButton>
          {menuItems.length > 0 && (
            <IconButton
              label={t("projectCardActions")}
              className={styles.iconAction}
              aria-haspopup="menu"
              onClick={openMenu}
            >
              <MoreHorizontalIcon />
            </IconButton>
          )}
        </div>
      </div>

      <div className={styles.captionSlot}>
        <ProjectCaptionEditor
          project={project}
          onUpdateCaption={props.onUpdateCaption}
        />
      </div>

      <div className={styles.pathPill}>
        <span className={styles.path} title={project.path}>
          <bdi>{shortenPath(project.path)}</bdi>
        </span>
      </div>

      <ProjectFooter {...props} />

      {menuOpen && (
        <ActionSheet
          title={projectDisplayName(project)}
          items={menuItems}
          anchorRect={menuAnchor}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </li>
  );
}
