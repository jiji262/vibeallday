import type { IssueItem, IssueSessionsResult } from "@vibeallday/shared";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Button, IconButton } from "../components/garden/Button";
import { EmptyState } from "../components/garden/EmptyState";
import { selectClassName } from "../components/garden/Field";
import {
  ExternalIcon,
  MoreHorizontalIcon,
  XIcon,
} from "../components/garden/icons";
import { LoadingState } from "../components/garden/LoadingState";
import { useI18n } from "../i18n";
import { IssueDetailFacts, IssueDetailKeyRow } from "./IssueDetailFacts";
import styles from "./IssueDetailPane.module.css";
import { IssueEditor, type IssueEditorProps } from "./IssueListRow";
import { IssueSessionRow } from "./IssueSessionRow";

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
  onMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  editor?: IssueEditorProps;
  onClose: () => void;
}

/** Page size the server uses for associated sessions. */
const SESSION_PAGE_SIZE = 50;

function DetailHeader({
  selected,
  onMenu,
  onClose,
}: Pick<IssueDetailPaneProps, "selected" | "onMenu" | "onClose">) {
  const { t } = useI18n();
  return (
    <div className={styles.detailHeader}>
      <div className={styles.headerTop}>
        <IssueDetailKeyRow item={selected} />
        <div className={styles.headerControls}>
          {selected.url && (
            <a
              className={styles.externalChip}
              href={selected.url}
              target="_blank"
              rel="noreferrer"
              aria-label={t("issuesOpenExternalNamed", { key: selected.key })}
            >
              <span>{t("issuesOpenExternal")}</span>
              <ExternalIcon size={13} />
            </a>
          )}
          <IconButton label={t("issuesItemActions")} size="sm" onClick={onMenu}>
            <MoreHorizontalIcon />
          </IconButton>
          <IconButton label={t("issuesClose")} size="sm" onClick={onClose}>
            <XIcon />
          </IconButton>
        </div>
      </div>
      <h2 className={styles.detailTitle}>{selected.title ?? selected.key}</h2>
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
    <div className={styles.pagerFooter}>
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
    </div>
  );
}

/** Sticky inspector card: facts grid, inline editor, and linked session cards. */
export function IssueDetailPane(props: IssueDetailPaneProps) {
  const { t } = useI18n();
  const { selected, detail, sort, onSort, onSessionOffset, editor } = props;
  return (
    <section
      className={styles.inspector}
      aria-label={t("issuesAssociatedSessions")}
    >
      <DetailHeader
        selected={selected}
        onMenu={props.onMenu}
        onClose={props.onClose}
      />
      {editor && (
        <div className={styles.editorSlot}>
          <IssueEditor {...editor} />
        </div>
      )}
      <IssueDetailFacts item={selected} />
      <div className={styles.detailBody}>
        <div className={styles.sessionHeading}>
          <h3 className={styles.sessionTitle}>
            {t("issuesAssociatedSessions")}
          </h3>
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
        {detail && detail.sessions.length > 0 && (
          <div className={styles.sessionList}>
            {detail.sessions.map((session) => (
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
          </div>
        )}
      </div>
      <SessionPager
        detail={detail}
        sessionOffset={props.sessionOffset}
        onSessionOffset={onSessionOffset}
      />
    </section>
  );
}
