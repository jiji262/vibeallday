import { useI18n } from "../../i18n";
import { Button } from "../garden/Button";
import { FilterChip } from "../controls/FilterChip";
import { type ChipStatus, type SearchStatus, toggleChipStatus } from "./model";
import styles from "./SearchToolbar.module.css";

function SlidersIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  );
}

/** Opens the Filters sheet; the badge counts groups that differ from default. */
export function FiltersButton({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  const { t } = useI18n();
  return (
    <Button
      variant="secondary"
      size="sm"
      className={styles.filtersButton}
      icon={<SlidersIcon />}
      aria-haspopup="dialog"
      aria-label={
        count > 0
          ? t("sessionSearchFiltersActive", { count })
          : t("sessionSearchFilters")
      }
      onClick={onClick}
    >
      {t("sessionSearchFilters")}
      {count > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {count}
        </span>
      )}
    </Button>
  );
}

const CHIPS: readonly {
  status: ChipStatus;
  label:
    | "globalSessionsStatusUnread"
    | "globalSessionsStatusStarred"
    | "globalSessionsStatusArchived";
}[] = [
  { status: "unread", label: "globalSessionsStatusUnread" },
  { status: "starred", label: "globalSessionsStatusStarred" },
  { status: "archived", label: "globalSessionsStatusArchived" },
];

/** Quick status chips. Each chip is one status filter. */
export function SearchChips({
  filters,
  onFilters,
}: {
  filters: SearchStatus[];
  onFilters: (next: SearchStatus[]) => void;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.chips}>
      {CHIPS.map(({ status, label }) => (
        <FilterChip
          key={status}
          pressed={filters.includes(status)}
          onClick={() => onFilters(toggleChipStatus(filters, status))}
        >
          {t(label)}
        </FilterChip>
      ))}
    </div>
  );
}

/** Enters and leaves select mode; rows then show their select boxes. */
export function SelectModeButton({
  selecting,
  onSelecting,
}: {
  selecting: boolean;
  onSelecting: (next: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <Button
      variant={selecting ? "secondary" : "ghost"}
      size="sm"
      aria-pressed={selecting}
      onClick={() => onSelecting(!selecting)}
    >
      {t(selecting ? "sessionSearchSelectDone" : "sessionSearchSelectMode")}
    </Button>
  );
}
