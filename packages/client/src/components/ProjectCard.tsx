import { projectDisplayName } from "@vibeallday/shared";
import { type MouseEvent, useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { shortenPath } from "../lib/text";
import type { Project } from "../types";
import { Badge } from "./garden/Badge";
import { Button, IconButton } from "./garden/Button";
import { DataListCell, dataListRowClassName } from "./garden/DataList";
import { MoreHorizontalIcon, PlusIcon } from "./garden/icons";
import { ActionSheet, type ActionSheetItem } from "./garden/Sheet";
import styles from "./ProjectCard.module.css";
import { ProjectCaptionEditor } from "./ProjectCaptionEditor";
import { ProjectCodeNameEditor } from "./ProjectCodeNameEditor";
import { formatProjectAge } from "./projectRelativeTime";
import type { ModalAnchorRect } from "./ui/Modal";

interface ProjectCardProps {
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

const ACTION_ICON_SIZE = 14;

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

/** Name, code-name chip, caption and mono path tail: the row's first cell. */
function ProjectIdentity({
  project,
  onUpdateCodeName,
  onUpdateCaption,
}: Pick<ProjectCardProps, "project" | "onUpdateCodeName" | "onUpdateCaption">) {
  const [codeNameError, setCodeNameError] = useState<string | null>(null);
  const codeNameErrorId = useId();
  return (
    <DataListCell primary className={styles.identity}>
      <strong className={styles.name}>
        <span className={styles.nameText}>{projectDisplayName(project)}</span>
        {onUpdateCodeName && (
          <ProjectCodeNameEditor
            project={project}
            onUpdateCodeName={onUpdateCodeName}
            error={codeNameError}
            onErrorChange={setCodeNameError}
            errorId={codeNameErrorId}
          />
        )}
      </strong>
      {onUpdateCodeName && codeNameError && (
        <span
          id={codeNameErrorId}
          className={styles.codeNameError}
          role="alert"
        >
          {codeNameError}
        </span>
      )}
      <ProjectCaptionEditor
        project={project}
        onUpdateCaption={onUpdateCaption}
      />
      <span className={styles.path} title={project.path}>
        <bdi>{shortenPath(project.path)}</bdi>
      </span>
    </DataListCell>
  );
}

/** Session count plus the needs-you and running badges. */
function SessionCell({
  project,
  needsAttentionCount,
  thinkingCount,
}: Pick<
  ProjectCardProps,
  "project" | "needsAttentionCount" | "thinkingCount"
>) {
  const { t } = useI18n();
  return (
    <DataListCell className={styles.stack}>
      <span className={styles.count}>
        {t(
          project.sessionCount === 1
            ? "projectCardSessionOne"
            : "projectCardSessions",
          { count: project.sessionCount },
        )}
      </span>
      {needsAttentionCount > 0 && (
        <Badge tone="rose" dot>
          {t("projectCardNeedsYou", { count: needsAttentionCount })}
        </Badge>
      )}
      {thinkingCount > 0 && (
        <Badge tone="mint" dot="pulse">
          {t("projectCardRunning", { count: thinkingCount })}
        </Badge>
      )}
    </DataListCell>
  );
}

function QueueCell({
  queueCount = 0,
  hasQueueWarning = false,
}: Pick<ProjectCardProps, "queueCount" | "hasQueueWarning">) {
  const { t } = useI18n();
  const empty = queueCount === 0 && !hasQueueWarning;
  return (
    <DataListCell className={styles.stack} hideOnPhone={empty}>
      {queueCount > 0 && (
        <Badge
          tone="sand"
          title={t("projectCardQueueCount", { count: queueCount })}
        >
          {t("projectCardQueued", { count: queueCount })}
        </Badge>
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
      {empty && (
        <span className={styles.none} aria-hidden="true">
          —
        </span>
      )}
    </DataListCell>
  );
}

/**
 * One row of the projects list: identity, sessions, queue, last activity and
 * the row actions (New session plus an overflow sheet for App, Copy,
 * Settings and Remove). The row itself links to the project's sessions.
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
    <li className={styles.card}>
      <Link
        to={`${basePath}/sessions?project=${project.id}&source=projects`}
        className={dataListRowClassName({ interactive: true }, styles.link)}
        data-project-card-link=""
      >
        <ProjectIdentity {...props} />
        <SessionCell {...props} />
        <QueueCell {...props} />
        <DataListCell mono muted num className={styles.activity}>
          {project.lastActivity
            ? formatProjectAge(project.lastActivity, t)
            : null}
        </DataListCell>
        <DataListCell right className={styles.actions}>
          <Button
            variant="secondary"
            size="sm"
            className={styles.newSession}
            icon={<PlusIcon size={ACTION_ICON_SIZE} />}
            title={t("projectCardNewSession")}
            aria-label={t("projectCardNewSession")}
            onClick={(event) => {
              stop(event);
              navigate(`${basePath}/new-session?projectId=${project.id}`);
            }}
          >
            <span className={styles.newSessionLabel}>
              {t("projectCardNewSession")}
            </span>
          </Button>
          {menuItems.length > 0 && (
            <IconButton
              label={t("projectCardActions")}
              className={styles.more}
              aria-haspopup="menu"
              onClick={openMenu}
            >
              <MoreHorizontalIcon />
            </IconButton>
          )}
        </DataListCell>
      </Link>
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
