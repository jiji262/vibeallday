import type { IssueItem, IssueSort } from "@vibeallday/shared";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Badge } from "../components/garden/Badge";
import { Button, IconButton } from "../components/garden/Button";
import { inputClassName } from "../components/garden/Field";
import { MoreHorizontalIcon } from "../components/garden/icons";
import { TrackerStatusBadge } from "../components/TrackerStatusBadge";
import { useI18n } from "../i18n";
import { formatBriefAge } from "../lib/sessionAge";
import { IssueTypeBadge } from "./IssueTypeBadge";
import styles from "./IssuesPage.module.css";

const TITLE_MAX_LENGTH = 512;
const URL_MAX_LENGTH = 4096;

export type IssueEditKind = "title" | "url" | "delete";

function IssueActivity({ item, sort }: { item: IssueItem; sort: IssueSort }) {
  const { t } = useI18n();
  const mentioned = sort === "mentioned";
  const timestamp = mentioned ? item.lastMentionAt : item.lastSessionActivityAt;
  const age = formatBriefAge(timestamp);
  if (!age || !timestamp) {
    return (
      <span>
        {t(mentioned ? "issuesMentionTimeUnknown" : "issuesActivityUnknown")}
      </span>
    );
  }
  return (
    <time dateTime={timestamp} title={new Date(timestamp).toLocaleString()}>
      {t(mentioned ? "issuesRecentlyMentionedAge" : "issuesSessionActiveAge", {
        age,
      })}
    </time>
  );
}

interface IssueEditorProps {
  kind: IssueEditKind;
  value: string;
  onChange: (value: string) => void;
  busy: boolean;
  /** Resolving a URL needs a loaded session to attach it to. */
  canResolve: boolean;
  onSave: () => void;
  onCancel: () => void;
}

const SAVE_LABEL = {
  title: "issuesSaveTitle",
  url: "issuesResolve",
  delete: "issuesDeleteConfirm",
} as const;

function IssueEditorFields({
  kind,
  value,
  onChange,
}: Pick<IssueEditorProps, "kind" | "value" | "onChange">) {
  const { t } = useI18n();
  const isTitle = kind === "title";
  if (kind === "delete") {
    return <p className={styles.editorHelp}>{t("issuesDeleteHelp")}</p>;
  }
  return (
    <>
      <label htmlFor="issue-edit-value" className={styles.editorLabel}>
        {t(isTitle ? "issuesTitleOverride" : "issuesResolveHelp")}
      </label>
      <input
        id="issue-edit-value"
        className={inputClassName()}
        aria-label={t(isTitle ? "issuesTitleOverride" : "issuesResolveUrl")}
        type={isTitle ? "text" : "url"}
        maxLength={isTitle ? TITLE_MAX_LENGTH : URL_MAX_LENGTH}
        required={kind === "url"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </>
  );
}

/** Inline title override, URL resolution or delete confirmation. */
function IssueEditor({
  kind,
  value,
  onChange,
  busy,
  canResolve,
  onSave,
  onCancel,
}: IssueEditorProps) {
  const { t } = useI18n();
  return (
    <form
      className={styles.editor}
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <IssueEditorFields kind={kind} value={value} onChange={onChange} />
      <div className={styles.actions}>
        <Button
          size="sm"
          variant={kind === "delete" ? "danger" : "primary"}
          disabled={busy || (kind === "url" && !canResolve)}
          type="submit"
        >
          {t(SAVE_LABEL[kind])}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t("issuesCancel")}
        </Button>
      </div>
    </form>
  );
}

interface IssueListRowProps {
  item: IssueItem;
  selected: boolean;
  /** Sort the server applied; activity shows unless keys are the order. */
  sort?: IssueSort | "key";
  onSelect: () => void;
  onMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  editor?: IssueEditorProps;
}

function IssueSelectButton({
  item,
  selected,
  sort,
  onSelect,
}: Pick<IssueListRowProps, "item" | "selected" | "sort" | "onSelect">) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className={styles.itemSelect}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className={styles.itemReference}>
        <span className={styles.itemTitle}>
          <strong className={styles.itemKey}>{item.key}</strong>
          <IssueTypeBadge item={item} />
        </span>
        {item.title && item.title !== item.key && (
          <span className={styles.itemSummary}>{item.title}</span>
        )}
      </span>
      <span className={styles.itemMeta}>
        <span>
          {t(
            item.sessionCount === 1
              ? "issuesSingleSession"
              : "issuesSessionCount",
            { count: item.sessionCount },
          )}
        </span>
        {sort && sort !== "key" && <IssueActivity item={item} sort={sort} />}
      </span>
      <span className={styles.itemState}>
        <TrackerStatusBadge item={item} />
        {item.unresolved && (
          <Badge tone="outline">{t("issuesUnresolved")}</Badge>
        )}
      </span>
    </button>
  );
}

/** One reference: mono key + type tag, title, session count, tracker state. */
export function IssueListRow({
  item,
  selected,
  sort,
  onSelect,
  onMenu,
  editor,
}: IssueListRowProps) {
  const { t } = useI18n();
  const rowClass = selected ? `${styles.item} ${styles.selected}` : styles.item;
  return (
    <li className={rowClass}>
      <div className={styles.itemRow}>
        <IssueSelectButton
          item={item}
          selected={selected}
          sort={sort}
          onSelect={onSelect}
        />
        <IconButton
          label={t("issuesItemMenu", { key: item.key })}
          className={styles.menuButton}
          onClick={onMenu}
        >
          <MoreHorizontalIcon />
        </IconButton>
      </div>
      {editor && <IssueEditor {...editor} />}
    </li>
  );
}

export type { IssueEditorProps };
