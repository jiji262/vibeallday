import type { IssueItem } from "@vibeallday/shared";
import { useI18n } from "../i18n";
import { type BadgeTone, Tag } from "./garden/Badge";

export const TRACKER_STATUS_LABELS = {
  open: "issuesStatus_open",
  draft: "issuesStatus_draft",
  merged: "issuesStatus_merged",
  closed: "issuesStatus_closed",
} as const;

/**
 * Design tag families: open = accent (the board's 开放), draft = idle,
 * merged = ok (done), closed = outline (inert, not an error).
 */
const TONES: Record<keyof typeof TRACKER_STATUS_LABELS, BadgeTone> = {
  open: "accent",
  draft: "idle",
  merged: "ok",
  closed: "outline",
};

/** The tracker's reported state; nothing at all when the server sent none. */
export function TrackerStatusBadge({
  item,
  className,
}: {
  item: IssueItem;
  className?: string;
}) {
  const { t } = useI18n();
  const status = item.trackerStatus;
  // A state a later server adds is left out rather than shown unlabelled.
  const label = status && TRACKER_STATUS_LABELS[status.state];
  if (!status || !label) return null;
  return (
    <Tag
      tone={TONES[status.state]}
      className={className}
      title={[
        status.checkedAt,
        status.mergedAt
          ? t("issuesMergedOn", {
              date: new Date(status.mergedAt).toLocaleString(),
            })
          : "",
        status.mergeCommitSha
          ? t("issuesMergeCommit", { sha: status.mergeCommitSha })
          : "",
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      {t(label)}
    </Tag>
  );
}
