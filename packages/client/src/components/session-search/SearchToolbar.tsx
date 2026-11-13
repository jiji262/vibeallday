import { useI18n } from "../../i18n";
import { Button } from "../garden/Button";
import { Count } from "../garden/Count";
import { Segmented } from "../garden/Segmented";
import { StatusDot } from "../garden/StatusDot";
import { FilterChip } from "../controls/FilterChip";
import {
  type ActivityFilter,
  type QuickCounts,
  type SearchField,
  type SearchStatus,
  toggleActivity,
  toggleChipStatus,
} from "./model";
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
        <span aria-hidden="true">
          <Count tone="accent">{count}</Count>
        </span>
      )}
    </Button>
  );
}

type ScopeValue = "title" | "content";
const CONTENT_FIELDS: SearchField[] = ["assistant", "user"];

/**
 * 标题 | 内容: title-only search, or the assistant and user turns. Finer field
 * mixes (and C-s / C-r) still come from the Filters sheet; any turn field
 * shows as Content.
 */
export function SearchScope({
  fields,
  supported,
  onFields,
}: {
  fields: readonly SearchField[];
  supported: boolean;
  onFields: (fields: SearchField[]) => void;
}) {
  const { t } = useI18n();
  const value: ScopeValue = fields.some((field) => field !== "title")
    ? "content"
    : "title";
  return (
    <span
      className={styles.scope}
      title={supported ? undefined : t("sessionsScopeContentUnsupported")}
    >
      <Segmented<ScopeValue>
        label={t("sessionSearchIn")}
        value={value}
        onChange={(next) =>
          onFields(next === "title" ? ["title"] : CONTENT_FIELDS)
        }
        options={[
          { value: "title", label: t("sessionsScopeTitle") },
          {
            value: "content",
            label: t("sessionsScopeContent"),
            disabled: !supported,
          },
        ]}
      />
    </span>
  );
}

interface QuickChipsProps {
  statuses: SearchStatus[];
  onStatuses: (next: SearchStatus[]) => void;
  activity: ActivityFilter[];
  onActivity: (next: ActivityFilter[]) => void;
  counts: QuickCounts;
}

/** 需要你 / 运行中 / 未读: the three live views, each a toggle. */
export function QuickChips(props: QuickChipsProps) {
  const { t } = useI18n();
  const { activity, onActivity, counts } = props;
  return (
    <div
      className={styles.chips}
      role="group"
      aria-label={t("sessionsQuickFilters")}
    >
      <FilterChip
        pressed={activity.includes("attention")}
        onClick={() => onActivity(toggleActivity(activity, "attention"))}
      >
        <StatusDot state="attn" />
        {t("sessionsChipNeedsYou")}
        {counts.attention > 0 && <Count tone="attn">{counts.attention}</Count>}
      </FilterChip>
      <FilterChip
        pressed={activity.includes("running")}
        onClick={() => onActivity(toggleActivity(activity, "running"))}
      >
        <StatusDot state="run" />
        {t("sessionsChipRunning")}
        {counts.running > 0 && <Count>{counts.running}</Count>}
      </FilterChip>
      <FilterChip
        pressed={props.statuses.includes("unread")}
        onClick={() =>
          props.onStatuses(toggleChipStatus(props.statuses, "unread"))
        }
      >
        <span className={styles.unreadDot} aria-hidden="true" />
        {t("sessionsChipUnread")}
        {counts.unread > 0 && <Count>{counts.unread}</Count>}
      </FilterChip>
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
