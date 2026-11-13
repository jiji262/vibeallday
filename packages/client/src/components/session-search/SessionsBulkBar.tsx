import type { GlobalSessionItem } from "../../api/client";
import { type MessageKey, useI18n } from "../../i18n";
import { Button } from "../garden/Button";
import type { SearchStatus } from "./model";
import { CheckIcon } from "./SearchSelection";
import styles from "./SessionsBulkBar.module.css";

const COUNT_ICON_SIZE = 14;

/** Which bulk changes apply to at least one selected session. */
export type BulkAvailability = Partial<Record<SearchStatus, boolean>>;

/** A change is offered when at least one selected session would change. */
export function bulkAvailability(
  selected: readonly GlobalSessionItem[],
): BulkAvailability {
  return {
    archived: selected.some((s) => !s.isArchived),
    unarchived: selected.some((s) => s.isArchived),
    starred: selected.some((s) => !s.isStarred),
    unstarred: selected.some((s) => s.isStarred),
    read: selected.some((s) => s.hasUnread),
    unread: selected.some((s) => !s.hasUnread),
  };
}

interface SessionsBulkBarProps {
  selectedCount: number;
  available: BulkAvailability;
  onApply: (action: SearchStatus) => void;
  onClearSelection: () => void;
  pending: boolean;
}

const ACTIONS: readonly {
  action: SearchStatus;
  label: MessageKey;
  title: MessageKey;
}[] = [
  { action: "read", label: "bulkMarkRead", title: "bulkMarkReadTitle" },
  { action: "unread", label: "bulkMarkUnread", title: "bulkMarkUnreadTitle" },
  { action: "archived", label: "bulkArchive", title: "bulkArchiveSelected" },
  {
    action: "unarchived",
    label: "bulkUnarchive",
    title: "bulkUnarchiveSelected",
  },
  { action: "starred", label: "bulkStar", title: "bulkStarSelected" },
  { action: "unstarred", label: "bulkUnstar", title: "bulkUnstarSelected" },
];

/**
 * Bulk session actions (design batch bar): accent-soft band at the top of the
 * result card with the selected count, one small button per change that
 * applies to the selection, then cancel. It sticks under the page's sticky
 * search toolbar, whose height the page publishes as
 * --sessions-toolbar-height.
 */
export function SessionsBulkBar({
  selectedCount,
  available,
  onApply,
  onClearSelection,
  pending,
}: SessionsBulkBarProps) {
  const { t } = useI18n();
  if (selectedCount === 0) return null;
  return (
    <div
      className={styles.bar}
      role="toolbar"
      aria-label={t("bulkActionsLabel")}
    >
      <span className={styles.count}>
        <CheckIcon size={COUNT_ICON_SIZE} />
        {t("bulkSelectedCount", { count: selectedCount })}
      </span>
      <div className={styles.actions}>
        {ACTIONS.filter(({ action }) => available[action]).map(
          ({ action, label, title }) => (
            <Button
              key={action}
              size="sm"
              variant="secondary"
              onClick={() => onApply(action)}
              disabled={pending}
              title={t(title)}
            >
              {t(label)}
            </Button>
          ),
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
          disabled={pending}
        >
          {t("bulkClearSelection")}
        </Button>
      </div>
    </div>
  );
}
