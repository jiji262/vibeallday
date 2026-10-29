import type { IssueItem, IssueSessionsResult } from "@vibeallday/shared";
import { Button, IconButton } from "../components/garden/Button";
import { Card, CardBody, CardFooter } from "../components/garden/Card";
import { EmptyState } from "../components/garden/EmptyState";
import { selectClassName } from "../components/garden/Field";
import { ExternalIcon, XIcon } from "../components/garden/icons";
import { LoadingState } from "../components/garden/LoadingState";
import { useI18n } from "../i18n";
import { IssueSessionRow } from "./IssueSessionRow";
import styles from "./IssuesPage.module.css";

type IssueAction = Parameters<typeof IssueSessionRow>[0]["action"];

interface IssueDetailPaneProps {
  selected: IssueItem;
  detail?: IssueSessionsResult;
  /** The dismissed filter `detail` was fetched under. */
  includeDismissed: boolean;
  busy: boolean;
  action: IssueAction;
  sort: string;
  onSort: (sort: string) => void;
  sessionOffset: number;
  onSessionOffset: (offset: number) => void;
  onClose: () => void;
}

/** Page size the server uses for associated sessions. */
const SESSION_PAGE_SIZE = 50;

function DetailHeader({
  selected,
  onClose,
}: Pick<IssueDetailPaneProps, "selected" | "onClose">) {
  const { t } = useI18n();
  return (
    <div className={styles.detailHeader}>
      <div className={styles.detailHeading}>
        <p className={styles.detailKey}>{selected.key}</p>
        <h2 className={styles.detailTitle}>{selected.title ?? selected.key}</h2>
        {selected.url && (
          <a
            className={styles.externalLink}
            href={selected.url}
            target="_blank"
            rel="noreferrer"
            aria-label={t("issuesOpenExternalNamed", { key: selected.key })}
          >
            {t("issuesOpenExternal")}
            <ExternalIcon size={14} />
          </a>
        )}
      </div>
      <IconButton label={t("issuesClose")} size="sm" onClick={onClose}>
        <XIcon />
      </IconButton>
    </div>
  );
}

function SessionPager({
  detail,
  sessionOffset,
  onSessionOffset,
}: Pick<IssueDetailPaneProps, "detail" | "sessionOffset" | "onSessionOffset">) {
  const { t } = useI18n();
  const next = detail?.nextOffset;
  if (sessionOffset === 0 && next == null) return null;
  return (
    <CardFooter band>
      <span />
      <span className={styles.actions}>
        {sessionOffset > 0 && (
          <Button
            size="sm"
            onClick={() =>
              onSessionOffset(Math.max(0, sessionOffset - SESSION_PAGE_SIZE))
            }
          >
            {t("issuesPreviousSessions")}
          </Button>
        )}
        {next != null && (
          <Button size="sm" onClick={() => onSessionOffset(next)}>
            {t("issuesNextSessions")}
          </Button>
        )}
      </span>
    </CardFooter>
  );
}

/** Sessions that mention the selected reference, with their evidence. */
export function IssueDetailPane(props: IssueDetailPaneProps) {
  const { t } = useI18n();
  const { selected, detail, sort, onSort, onSessionOffset } = props;
  return (
    <Card
      as="section"
      className={styles.detail}
      aria-label={t("issuesAssociatedSessions")}
    >
      <DetailHeader selected={selected} onClose={props.onClose} />
      <CardBody className={styles.detailBody}>
        <div className={styles.sessionHeading}>
          <h3>{t("issuesAssociatedSessions")}</h3>
          <select
            className={selectClassName(styles.sessionSort)}
            aria-label={t("issuesSessionSort")}
            value={sort}
            onChange={(event) => {
              onSort(event.target.value);
              onSessionOffset(0);
            }}
          >
            <option value="activity">{t("issuesActivityNewest")}</option>
            <option value="oldest">{t("issuesActivityOldest")}</option>
          </select>
        </div>
        {!detail && (
          <LoadingState variant="compact" label={t("issuesLoadingSessions")} />
        )}
        {detail?.sessions.length === 0 && (
          <EmptyState compact title={t("issuesNoSessions")} />
        )}
        {detail?.sessions.map((session) => (
          <IssueSessionRow
            key={`${selected.id}:${session.sessionId}`}
            issueId={selected.id}
            session={session}
            unresolved={selected.unresolved}
            busy={props.busy}
            includeDismissed={props.includeDismissed}
            action={props.action}
          />
        ))}
      </CardBody>
      <SessionPager
        detail={detail}
        sessionOffset={props.sessionOffset}
        onSessionOffset={onSessionOffset}
      />
    </Card>
  );
}
