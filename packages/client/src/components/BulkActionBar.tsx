import type { ReactNode } from "react";
import { type MessageKey, useI18n } from "../i18n";
import { Button } from "./garden/Button";
import { CardBand } from "./garden/Card";
import { StarIcon } from "./garden/icons";
import styles from "./BulkActionBar.module.css";

const ICON_SIZE = 14;

interface BulkActionBarProps {
  selectedCount: number;
  onArchive: () => Promise<void>;
  onUnarchive: () => Promise<void>;
  onStar: () => Promise<void>;
  onUnstar: () => Promise<void>;
  onMarkRead: () => Promise<void>;
  onMarkUnread: () => Promise<void>;
  onClearSelection: () => void;
  isPending?: boolean;
  /** True if any selected item can be archived (is not archived) */
  canArchive?: boolean;
  /** True if any selected item can be unarchived (is archived) */
  canUnarchive?: boolean;
  /** True if any selected item can be starred (is not starred) */
  canStar?: boolean;
  /** True if any selected item can be unstarred (is starred) */
  canUnstar?: boolean;
  /** True if any selected item can be marked as read (has unread) */
  canMarkRead?: boolean;
  /** True if any selected item can be marked as unread (is read) */
  canMarkUnread?: boolean;
  /** Select all filtered sessions (shown when filters active, no selection) */
  onSelectAllFiltered?: () => void;
  /** Number of sessions in filtered results */
  filteredCount?: number;
}

function StrokeIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ARCHIVE_BOX = (
  <>
    <path d="M21 8v13H3V8" />
    <rect x="1" y="3" width="22" height="5" />
  </>
);

const ICONS = {
  archive: (
    <StrokeIcon>
      {ARCHIVE_BOX}
      <path d="M10 12h4" />
    </StrokeIcon>
  ),
  unarchive: (
    <StrokeIcon>
      {ARCHIVE_BOX}
      <path d="M12 17v-6m-3 3 3-3 3 3" />
    </StrokeIcon>
  ),
  star: <StarIcon size={ICON_SIZE} />,
  unstar: (
    <StrokeIcon>
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
      <path d="M4 4l16 16" />
    </StrokeIcon>
  ),
  read: (
    <StrokeIcon>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m22 4-10 10.01-3-3" />
    </StrokeIcon>
  ),
  unread: (
    <StrokeIcon>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </StrokeIcon>
  ),
} as const;

interface BulkAction {
  key: keyof typeof ICONS;
  visible: boolean;
  label: MessageKey;
  title: MessageKey;
  run: () => Promise<void>;
}

function bulkActions(props: BulkActionBarProps): BulkAction[] {
  const {
    canArchive = true,
    canUnarchive = true,
    canStar = true,
    canUnstar = true,
    canMarkRead = true,
    canMarkUnread = true,
  } = props;
  return [
    {
      key: "archive",
      visible: canArchive,
      label: "bulkArchive",
      title: "bulkArchiveSelected",
      run: props.onArchive,
    },
    {
      key: "unarchive",
      visible: canUnarchive,
      label: "bulkUnarchive",
      title: "bulkUnarchiveSelected",
      run: props.onUnarchive,
    },
    {
      key: "star",
      visible: canStar,
      label: "bulkStar",
      title: "bulkStarSelected",
      run: props.onStar,
    },
    {
      key: "unstar",
      visible: canUnstar,
      label: "bulkUnstar",
      title: "bulkUnstarSelected",
      run: props.onUnstar,
    },
    {
      key: "read",
      visible: canMarkRead,
      label: "bulkMarkRead",
      title: "bulkMarkReadTitle",
      run: props.onMarkRead,
    },
    {
      key: "unread",
      visible: canMarkUnread,
      label: "bulkMarkUnread",
      title: "bulkMarkUnreadTitle",
      run: props.onMarkUnread,
    },
  ];
}

/** The filtered select-all shortcut, shown before anything is selected. */
function SelectAllFilteredBand({
  count,
  onSelect,
  disabled,
}: {
  count: number;
  onSelect: () => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  return (
    <CardBand className={styles.band}>
      <Button
        size="sm"
        onClick={onSelect}
        disabled={disabled}
        title={t("bulkSelectAllFilteredTitle", { count })}
      >
        {t("bulkSelectAllFiltered", { count })}
      </Button>
    </CardBand>
  );
}

/**
 * Bulk session actions as the indigo band at the top of the result card:
 * mono selected count, one small button per applicable action, then cancel.
 */
export function BulkActionBar(props: BulkActionBarProps) {
  const { t } = useI18n();
  const {
    selectedCount,
    isPending = false,
    onSelectAllFiltered,
    filteredCount = 0,
  } = props;
  if (selectedCount === 0) {
    if (!onSelectAllFiltered || filteredCount === 0) return null;
    return (
      <SelectAllFilteredBand
        count={filteredCount}
        onSelect={onSelectAllFiltered}
        disabled={isPending}
      />
    );
  }

  return (
    <CardBand
      className={styles.band}
      role="toolbar"
      aria-label={t("bulkActionsLabel")}
    >
      <span className={styles.count}>
        {t("bulkSelectedCount", { count: selectedCount })}
      </span>
      <div className={styles.actions}>
        {bulkActions(props)
          .filter((action) => action.visible)
          .map((action) => (
            <Button
              key={action.key}
              size="sm"
              icon={ICONS[action.key]}
              onClick={action.run}
              disabled={isPending}
              title={t(action.title)}
            >
              {t(action.label)}
            </Button>
          ))}
      </div>
      <Button
        size="sm"
        variant="ghost"
        className={styles.cancel}
        onClick={props.onClearSelection}
        disabled={isPending}
      >
        {t("bulkClearSelection")}
      </Button>
    </CardBand>
  );
}
