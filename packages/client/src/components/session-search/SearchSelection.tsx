import type { GlobalSessionItem } from "../../api/client";
import { useI18n } from "../../i18n";
import { getSessionDisplayTitle } from "../../utils";
import { Button, IconButton } from "../garden/Button";
import { Sheet } from "../garden/Sheet";
import styles from "./SearchToolbar.module.css";

export function CheckIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m4 12 5 5L20 5" />
    </svg>
  );
}

function CancelIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      className={styles.clearIcon}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      aria-hidden="true"
    >
      <path d="m5 5 14 14M19 5 5 19" />
    </svg>
  );
}

export function SearchHelp() {
  const { t } = useI18n();
  return (
    <p className={styles.selectionHelp}>
      <span role="img" aria-label={t("sessionSearchHelpCount")}>
        <CheckIcon size={14} />
      </span>{" "}
      {t("sessionSearchHelp")}{" "}
      <span role="img" aria-label={t("sessionSearchHelpCancel")}>
        <CancelIcon size={14} />
      </span>
      {t("sessionSearchHelpClear")}
    </p>
  );
}

/** Count, Select all, Only selected and clear; shown only while selecting. */
export function SearchSelection({
  count,
  shown,
  allShownSelected,
  onSelectShown,
  onClear,
  onlySelected,
  onOnlySelected,
  onManage,
  pending,
}: {
  count: number;
  shown: number;
  allShownSelected: boolean;
  onSelectShown(): void;
  onClear(): void;
  onlySelected: boolean;
  onOnlySelected(value: boolean): void;
  onManage(): void;
  pending: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.selection}>
      <div className={styles.selectionTop}>
        <button
          type="button"
          className={styles.selectionCount}
          title={t("sessionSearchSelectionHelp", { count })}
          onClick={onManage}
        >
          <CheckIcon size={16} />
          {count}
        </button>
        {count > 0 && (
          <IconButton
            label={t("sessionSearchClear", { count })}
            onClick={onClear}
            disabled={pending}
          >
            <CancelIcon />
          </IconButton>
        )}
      </div>
      <div className={styles.selectionActions}>
        <Button
          variant="secondary"
          onClick={onSelectShown}
          disabled={!shown || allShownSelected || pending}
          title={t("sessionSearchSelectShownTitle", { count: shown })}
        >
          {t("sessionSearchSelectShown", { count: shown })}
        </Button>
        <Button
          variant="secondary"
          aria-pressed={onlySelected}
          onClick={() => onOnlySelected(!onlySelected)}
          title={t("sessionSearchOnlySelectedTitle")}
        >
          {t("sessionSearchOnlySelected")}
        </Button>
      </div>
      <SearchHelp />
    </div>
  );
}

/**
 * Every selected session, and every turn-searchable one, as a checklist: the
 * only place a selection made on a title-search row can be removed once the
 * search hides that row.
 */
export function SelectionManager({
  sessions,
  selected,
  listed,
  describe,
  onToggle,
  onClose,
}: {
  sessions: readonly GlobalSessionItem[];
  selected: ReadonlySet<string>;
  /** Whether an unselected session belongs in the list (turn-searchable). */
  listed: (session: GlobalSessionItem) => boolean;
  /** Why a session is not among the shown results; empty when it is. */
  describe: (session: GlobalSessionItem) => string | undefined;
  onToggle: (id: string, checked: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Sheet title={t("sessionSearchManageTitle")} onClose={onClose}>
      <section className={styles.manager} aria-label={t("sessionSearchManage")}>
        {sessions
          // A selected session is always listed, whatever its provider.
          .filter((session) => selected.has(session.id) || listed(session))
          .map((session) => (
            <label key={session.id} className={styles.managerRow}>
              <input
                type="checkbox"
                checked={selected.has(session.id)}
                onChange={(e) => onToggle(session.id, e.target.checked)}
              />
              <span>
                {getSessionDisplayTitle(session)}{" "}
                <small>· {session.provider}</small>{" "}
                {describe(session) && <small>{describe(session)}</small>}
              </span>
            </label>
          ))}
      </section>
    </Sheet>
  );
}
