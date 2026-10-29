import { useI18n } from "../../i18n";
import { Button } from "../garden/Button";
import { EmptyState } from "../garden/EmptyState";
import { ListIcon } from "../garden/icons";

/** No result: clear the filters when something narrows the list, else start. */
export function SessionsEmpty({
  narrowed,
  onClear,
  onStart,
}: {
  narrowed: boolean;
  onClear: () => void;
  onStart: () => void;
}) {
  const { t } = useI18n();
  return (
    <EmptyState
      icon={<ListIcon />}
      title={t("globalSessionsNoResultsTitle")}
      hint={
        narrowed
          ? t("globalSessionsNoResultsFiltered")
          : t("globalSessionsNoResultsEmpty")
      }
      action={
        narrowed ? (
          <Button size="sm" onClick={onClear}>
            {t("globalSessionsClearFilters")}
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={onStart}>
            {t("nowStartSession")}
          </Button>
        )
      }
    />
  );
}
