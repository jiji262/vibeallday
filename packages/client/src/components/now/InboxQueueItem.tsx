import type {
  ProjectQueueItemStatus,
  ProjectQueueItemSummary,
} from "@vibeallday/shared";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n";
import styles from "./InboxQueueItem.module.css";

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;

type Translate = ReturnType<typeof useI18n>["t"];

export type PendingNewSessionProjectQueueItem = ProjectQueueItemSummary & {
  target: Extract<ProjectQueueItemSummary["target"], { type: "new-session" }>;
};

/**
 * Explicit module classes for the closed Project Queue status union.
 * Only the statuses with a rule get a class; `queued` styles the base
 * item and status badge alone.
 */
const QUEUE_ITEM_STATUS_CLASSES: Record<ProjectQueueItemStatus, string> = {
  queued: "",
  dispatching: "",
  failed: styles.failed ?? "",
};

const QUEUE_STATUS_CLASSES: Record<ProjectQueueItemStatus, string> = {
  queued: "",
  dispatching: styles.statusDispatching ?? "",
  failed: styles.statusFailed ?? "",
};

export function isPendingNewSessionProjectQueueItem(
  item: ProjectQueueItemSummary,
): item is PendingNewSessionProjectQueueItem {
  return (
    item.target.type === "new-session" &&
    (item.status === "queued" ||
      item.status === "dispatching" ||
      item.status === "failed")
  );
}

function statusLabel(status: ProjectQueueItemStatus, t: Translate): string {
  switch (status) {
    case "dispatching":
      return t("projectQueueStatusDispatching");
    case "failed":
      return t("projectQueueStatusFailed");
    case "queued":
      return t("projectQueueStatusQueued");
  }
}

function formatAge(timestamp: string, t: Translate): string {
  const then = new Date(timestamp).getTime();
  if (!Number.isFinite(then)) return "";
  const minutes = Math.floor(Math.max(0, Date.now() - then) / MS_PER_MINUTE);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const days = Math.floor(hours / HOURS_PER_DAY);
  if (minutes < 1) return t("projectQueueAgeJustNow");
  if (minutes < MINUTES_PER_HOUR)
    return t("projectQueueAgeMinutes", { count: minutes });
  if (hours < HOURS_PER_DAY) return t("projectQueueAgeHours", { count: hours });
  if (days < DAYS_PER_WEEK) return t("projectQueueAgeDays", { count: days });
  return new Date(timestamp).toLocaleDateString();
}

interface InboxQueueItemProps {
  item: PendingNewSessionProjectQueueItem;
  projectName: string;
  basePath?: string;
  hideProjectName?: boolean;
}

/** A queued new session in the Running card: it has no session row yet. */
export function InboxQueueItem({
  item,
  projectName,
  basePath = "",
  hideProjectName = false,
}: InboxQueueItemProps) {
  const { t } = useI18n();
  const prompt = item.messagePreview.trim() || t("projectQueueAttachmentOnly");
  const targetTitle = item.target.title?.trim();
  const title = targetTitle || prompt;
  const showPromptPreview = !!targetTitle && targetTitle !== prompt;
  const age = formatAge(item.createdAt, t);
  const href = `${basePath}/projects?queueItem=${encodeURIComponent(item.id)}`;

  return (
    <li
      className={`${styles.item} ${QUEUE_ITEM_STATUS_CLASSES[item.status]}`}
      data-inbox-project-queue-item-id={item.id}
    >
      <Link className={styles.link} to={href}>
        <span className={styles.titleRow}>
          <strong className={styles.title}>{title}</strong>
          <span className={styles.targetBadge}>
            {t("projectQueueTargetNewSession")}
          </span>
          <span
            className="session-project-queue-badge"
            title={t("projectQueueSidebarBadge")}
          >
            Q
          </span>
        </span>
        {showPromptPreview && <span className={styles.preview}>{prompt}</span>}
        <span className={styles.meta}>
          {!hideProjectName && (
            <span className={styles.project}>{projectName}</span>
          )}
          {age && <span>{age}</span>}
          <span
            className={`${styles.status} ${QUEUE_STATUS_CLASSES[item.status]}`}
          >
            {statusLabel(item.status, t)}
          </span>
        </span>
      </Link>
    </li>
  );
}
