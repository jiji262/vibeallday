import { projectDisplayName } from "@vibeallday/shared";
import { type MouseEvent, useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { shortenPath } from "../lib/text";
import type { Project } from "../types";
import { Button, IconButton } from "./garden/Button";
import { Pill } from "./garden/Pill";
import { ActionSheet, type ActionSheetItem } from "./garden/Sheet";
import styles from "./ProjectCard.module.css";
import { ProjectCaptionEditor } from "./ProjectCaptionEditor";
import { ProjectCodeNameEditor } from "./ProjectCodeNameEditor";
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

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_DAYS = 7;

/**
 * Format relative time for display
 */
function formatRelativeTime(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMins = Math.floor(diffMs / MINUTE_MS);
  const diffHours = Math.floor(diffMs / HOUR_MS);
  const diffDays = Math.floor(diffMs / DAY_MS);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < WEEK_DAYS) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function stop(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function MoreIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/**
 * Card component for displaying a project in the projects list: Fraunces
 * name with its quiet code-name chip, a one-line caption, the mono path, and
 * a footer of status pills with the last-activity time. App, Copy, Settings
 * and Remove live in one overflow sheet; New session stays a 44px button.
 */
export function ProjectCard({
  appEnabled = false,
  project,
  needsAttentionCount,
  thinkingCount,
  queueCount = 0,
  hasQueueWarning = false,
  basePath = "",
  onDeleteProject,
  deleteLabel,
  onOpenSettings,
  onCopy,
  onUpdateCodeName,
  onUpdateCaption,
  isDeleting = false,
}: ProjectCardProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [codeNameError, setCodeNameError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<ModalAnchorRect | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const codeNameErrorId = useId();

  const candidates: (ActionSheetItem | false | undefined)[] = [
    appEnabled && {
      key: "app",
      label: t("projectAppOpen"),
      // Replaces the open sheet's back-gesture history entry, so Back from
      // the app returns to Projects in one step.
      onSelect: () =>
        navigate(`${basePath}/projects/${project.id}/app`, { replace: true }),
    },
    onCopy && {
      key: "copy",
      label: t("projectCopyLabel"),
      hint: t("projectCopyTitle"),
      onSelect: () => onCopy(project),
    },
    onOpenSettings && {
      key: "settings",
      label: t("projectCardOpenSettings"),
      onSelect: () => onOpenSettings(project),
    },
    onDeleteProject && {
      key: "remove",
      label: deleteLabel ?? t("projectsDelete"),
      tone: "danger",
      disabled: isDeleting,
      onSelect: () => onDeleteProject(project),
    },
  ];
  const menuItems = candidates.filter((item): item is ActionSheetItem =>
    Boolean(item),
  );

  const openMenu = (event: MouseEvent<HTMLButtonElement>) => {
    stop(event);
    setMenuAnchor(event.currentTarget.getBoundingClientRect());
    setMenuOpen(true);
  };

  return (
    <li className={styles.card}>
      <Link
        to={`${basePath}/sessions?project=${project.id}&source=projects`}
        className={styles.link}
        data-project-card-link=""
      >
        <div className={styles.header}>
          <div className={styles.identity}>
            <strong className={styles.name}>
              <span className={styles.nameText}>
                {projectDisplayName(project)}
              </span>
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
          </div>
          {menuItems.length > 0 && (
            <IconButton
              label={t("projectCardActions")}
              className={styles.more}
              aria-haspopup="menu"
              onClick={openMenu}
            >
              <MoreIcon />
            </IconButton>
          )}
        </div>
        <span className={styles.path} title={project.path}>
          <bdi>{shortenPath(project.path)}</bdi>
        </span>
        <div className={styles.footer}>
          <div className={styles.status}>
            {needsAttentionCount > 0 && (
              <Pill tone="rose">
                {t("projectCardNeedsYou", { count: needsAttentionCount })}
              </Pill>
            )}
            {thinkingCount > 0 && (
              <Pill tone="mint" dot="pulse">
                {t("projectCardRunning", { count: thinkingCount })}
              </Pill>
            )}
            {queueCount > 0 && (
              <Pill
                tone="sand"
                title={t("projectCardQueueCount", { count: queueCount })}
              >
                {t("projectCardQueued", { count: queueCount })}
              </Pill>
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
            <span className={styles.meta}>
              {t(
                project.sessionCount === 1
                  ? "projectCardSessionOne"
                  : "projectCardSessions",
                { count: project.sessionCount },
              )}
              {project.lastActivity &&
                ` · ${formatRelativeTime(project.lastActivity)}`}
            </span>
          </div>
          <Button
            variant="secondary"
            className={styles.newSession}
            icon={<PlusIcon />}
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
        </div>
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
