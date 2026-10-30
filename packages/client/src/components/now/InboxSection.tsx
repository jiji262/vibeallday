import { LAUNCH_SOURCES } from "@vibeallday/shared";
import { Link } from "react-router-dom";
import type { InboxItem } from "../../contexts/InboxContext";
import { type MessageKey, useI18n } from "../../i18n";
import { getSessionDisplayTitle } from "../../utils";
import { Card } from "../garden/Card";
import { Count } from "../garden/Count";
import { ChevronRightIcon } from "../garden/icons";
import { SessionListItem } from "../SessionListItem";
import { InboxQueueItem } from "./InboxQueueItem";
import styles from "./InboxSection.module.css";
import {
  type InboxSectionLink,
  type InboxSectionModel,
  inboxRowModel,
  inboxSectionId,
} from "./inboxSections";

const CHEVRON_SIZE = 14;

/** Row decorations and capability flags shared by every section. */
export interface InboxRowContext {
  projectNameById: ReadonlyMap<string, string>;
  /** Single-project scope hides the project on every row. */
  hideProjectName: boolean;
  basePath: string;
  projectId?: string;
  drafts: ReadonlySet<string>;
  projectQueuedSessionIds: ReadonlySet<string>;
  publicShareCreationReady: boolean;
  publicShareManagementAvailable: boolean;
}

function needsBadgeKey(
  row: InboxItem,
  inNeedsSection: boolean,
): MessageKey | null {
  if (row.pendingInputType === "tool-approval") return "inboxStatusApproval";
  if (row.pendingInputType === "user-question") return "inboxStatusQuestion";
  return inNeedsSection ? "inboxStatusNeedsYou" : null;
}

function InboxRow({
  row,
  sectionKey,
  context,
}: {
  row: InboxItem;
  sectionKey: InboxSectionModel["key"];
  context: InboxRowContext;
}) {
  const { t } = useI18n();
  const badgeKey = needsBadgeKey(row, sectionKey === "needsAttention");
  return (
    <SessionListItem
      sessionId={row.sessionId}
      projectId={row.projectId}
      title={getSessionDisplayTitle({
        customTitle: row.customTitle,
        title: row.sessionTitle,
      })}
      hasCustomTitle={!!row.customTitle}
      projectName={row.projectName}
      model={inboxRowModel(row)}
      updatedAt={row.updatedAt}
      hasUnread={row.hasUnread}
      isStarred={row.isStarred}
      // A queue-only row is listed as running without a live turn.
      activity={row.activityInferredFromInboxTier ? undefined : row.activity}
      pendingInputType={row.pendingInputType}
      mode="card"
      openNonHumanUserTurn
      showProjectName={!context.hideProjectName}
      showTimestamp
      showStatusBadge={false}
      showActivityIndicator={sectionKey === "active"}
      customBadge={
        badgeKey
          ? { label: t(badgeKey), className: styles.badgeAttn ?? "" }
          : null
      }
      basePath={context.basePath}
      hasDraft={context.drafts.has(row.sessionId)}
      hasProjectQueue={context.projectQueuedSessionIds.has(row.sessionId)}
      publicShareCreationReady={context.publicShareCreationReady}
      publicShareManagementAvailable={context.publicShareManagementAvailable}
    />
  );
}

const LINK_LABEL: Record<InboxSectionLink, MessageKey> = {
  allSessions: "sessionOverviewViewAll",
  allUnread: "inboxViewAllUnread",
  manageQueue: "inboxManageQueue",
};

function sectionHref(link: InboxSectionLink, context: InboxRowContext) {
  const { basePath, projectId } = context;
  if (link === "manageQueue") return `${basePath}/projects`;
  const params = new URLSearchParams();
  if (link === "allUnread") {
    params.set("status", "unarchived,unread");
    params.set("source", LAUNCH_SOURCES.join(","));
  }
  if (projectId) params.set("project", projectId);
  const query = params.toString();
  return `${basePath}/sessions${query ? `?${query}` : ""}`;
}

function SectionLink({
  link,
  context,
}: {
  link: InboxSectionLink;
  context: InboxRowContext;
}) {
  const { t } = useI18n();
  return (
    <Link className={styles.link} to={sectionHref(link, context)}>
      {t(LINK_LABEL[link])}
      <ChevronRightIcon size={CHEVRON_SIZE} />
    </Link>
  );
}

/** One section: heading, count and its rows in a single list card. */
export function InboxSection({
  model,
  context,
}: {
  model: InboxSectionModel;
  context: InboxRowContext;
}) {
  const { t } = useI18n();
  const count = model.items.length + model.queueItems.length;
  const id = inboxSectionId(model.key);
  const tone = model.key === "needsAttention" ? "attn" : "default";
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className={styles.head}>
        <h2 id={`${id}-title`} className={styles.title}>
          {t(model.titleKey)}
        </h2>
        <Count tone={tone}>{count}</Count>
        {model.link && <SectionLink link={model.link} context={context} />}
      </div>
      {count === 0 ? (
        <p className={styles.empty}>{t("inboxFilterEmpty")}</p>
      ) : (
        <Card flush className={styles.card}>
          <ul className={`sessions-list ${styles.collection}`}>
            {model.queueItems.map((item) => (
              <InboxQueueItem
                key={item.id}
                item={item}
                projectName={
                  context.projectNameById.get(item.projectId) ??
                  t("projectQueueUnknownProject")
                }
                hideProjectName={context.hideProjectName}
                basePath={context.basePath}
              />
            ))}
            {model.items.map((row) => (
              <InboxRow
                key={row.sessionId}
                row={row}
                sectionKey={model.key}
                context={context}
              />
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
