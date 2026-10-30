import { useI18n } from "../../i18n";
import { CheckChip, FilterChip } from "../controls/FilterChip";
import { SegmentedControl } from "../controls/SegmentedControl";
import { Button } from "../garden/Button";
import { Sheet } from "../garden/Sheet";
import type {
  ActivityFilter,
  SearchField,
  SearchStatus,
  TimeBasis,
} from "./model";
import { Section, StatusFilters } from "./FilterSheetSections";
import {
  ProjectFilter,
  ProviderFilter,
  type ScopeFilterProps,
  SourceFilters,
} from "./SearchScopeFilters";
import styles from "./SearchFilterSheet.module.css";

const FIELDS: readonly SearchField[] = ["title", "assistant", "user"];
const BASES: readonly TimeBasis[] = ["activity", "turns", "created"];
const QUICK_AGE_DAYS = [1, 7, 30];
export interface FilterSheetProps {
  onClose: () => void;
  onClear: () => void;
  /** Sessions the current filters leave, for the footer button. */
  resultCount: number;
  activeCount: number;
  fields: SearchField[];
  onFields: (fields: SearchField[]) => void;
  /** False on servers without turn search: only the title field works. */
  supported: boolean;
  intersection: boolean;
  onIntersection: (value: boolean) => void;
  basis: TimeBasis;
  onBasis: (basis: TimeBasis) => void;
  young: string;
  old: string;
  onYoung: (value: string) => void;
  onOld: (value: string) => void;
  limit: string;
  onLimit: (value: string) => void;
  showLimit: boolean;
  statuses: SearchStatus[];
  onStatuses: (next: SearchStatus[]) => void;
  activity: ActivityFilter[];
  onActivity: (next: ActivityFilter[]) => void;
  /** Data for the project, provider and source dropdowns. */
  scope: ScopeFilterProps;
}

function SearchInFields(props: FilterSheetProps) {
  const { t } = useI18n();
  const { fields, onFields, supported } = props;
  return (
    <Section title={t("sessionsFilterSearchIn")}>
      <div className={styles.chipRow}>
        {FIELDS.map((field) => (
          <CheckChip
            key={field}
            checked={fields.includes(field)}
            disabled={field !== "title" && !supported}
            hint={
              field === "title"
                ? undefined
                : field === "assistant"
                  ? "C-s"
                  : "C-r"
            }
            title={
              field !== "title" && !supported
                ? t("sessionSearchUpgrade")
                : field === "title"
                  ? t("sessionSearchTitleHelp")
                  : undefined
            }
            onChange={(e) => {
              const next = e.target.checked
                ? [...fields, field]
                : fields.filter((f) => f !== field);
              onFields(field !== "title" && !next.length ? ["title"] : next);
            }}
          >
            {t(`sessionSearchField_${field}`)}
          </CheckChip>
        ))}
        <CheckChip
          checked={props.intersection}
          title={t("sessionSearchIntersectionHelp")}
          onChange={(e) => props.onIntersection(e.target.checked)}
        >
          {t("sessionSearchIntersection")}
        </CheckChip>
      </div>
    </Section>
  );
}

function AgeInput({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  const { t } = useI18n();
  return (
    <input
      className={styles.ageInput}
      aria-label={label}
      title={t("sessionSearchAgeHelp")}
      placeholder={placeholder}
      value={value}
      maxLength={20}
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function TimeFilters(props: FilterSheetProps) {
  const { t } = useI18n();
  const { young, old, basis } = props;
  return (
    <Section title={t("sessionSearchSectionTime")}>
      <SegmentedControl
        label={t("sessionSearchSectionTime")}
        value={basis}
        onChange={props.onBasis}
        options={BASES.map((value) => ({
          value,
          label: t(`sessionSearchTime_${value}`),
          title: t(`sessionSearchTimeHelp_${value}`),
        }))}
      />
      <div className={styles.ageRow}>
        <span className={styles.rowLabel}>{t("globalSessionsFilterAge")}</span>
        <AgeInput
          label={t("sessionSearchFrom")}
          placeholder="0d"
          value={young}
          onChange={props.onYoung}
        />
        <span aria-hidden="true">–</span>
        <AgeInput
          label={t("sessionSearchTo")}
          placeholder="∞d"
          value={old}
          onChange={props.onOld}
        />
      </div>
      <div className={styles.chipRow}>
        {QUICK_AGE_DAYS.map((days) => (
          <FilterChip
            key={days}
            pressed={basis === "activity" && !young && old === `${days}d`}
            title={t("sessionSearchRecentHelp", { days })}
            onClick={() => {
              props.onBasis("activity");
              props.onYoung("");
              props.onOld(`${days}d`);
            }}
          >
            {days}d
          </FilterChip>
        ))}
        <FilterChip
          pressed={!young && !old}
          onClick={() => {
            props.onYoung("");
            props.onOld("");
          }}
        >
          {t("sessionSearchAnyAge")}
        </FilterChip>
      </div>
      {props.showLimit && (
        <label className={styles.ageRow} title={t("sessionSearchLimitHelp")}>
          <span className={styles.rowLabel}>{t("sessionSearchLimit")}</span>
          <input
            className={styles.ageInput}
            inputMode="numeric"
            placeholder="∞"
            value={props.limit}
            aria-label={t("sessionSearchLimit")}
            onChange={(e) => props.onLimit(e.target.value)}
          />
        </label>
      )}
    </Section>
  );
}

/**
 * Every filter and search-in option of the Sessions page, grouped as status,
 * project, provider, time and source, then the finer search-in fields.
 * Choices apply as they are made; the footer button only closes the sheet.
 */
export function SearchFilterSheet(props: FilterSheetProps) {
  const { t } = useI18n();
  return (
    <Sheet title={t("sessionsFilterSheetTitle")} onClose={props.onClose}>
      <div className={styles.body}>
        <StatusFilters
          statuses={props.statuses}
          onStatuses={props.onStatuses}
          activity={props.activity}
          onActivity={props.onActivity}
        />
        <Section title={t("sessionsFilterProject")}>
          <ProjectFilter {...props.scope} />
        </Section>
        <Section title={t("sessionsFilterProvider")}>
          <ProviderFilter {...props.scope} />
        </Section>
        <TimeFilters {...props} />
        <Section title={t("sessionsFilterSource")}>
          <SourceFilters {...props.scope} />
        </Section>
        <SearchInFields {...props} />
      </div>
      <div className={styles.footer}>
        <Button
          variant="secondary"
          size="lg"
          onClick={props.onClear}
          disabled={props.activeCount === 0}
        >
          {t("globalSessionsClearFilters")}
        </Button>
        <Button variant="primary" size="lg" onClick={props.onClose}>
          {t("sessionSearchShowResults", { count: props.resultCount })}
        </Button>
      </div>
    </Sheet>
  );
}
