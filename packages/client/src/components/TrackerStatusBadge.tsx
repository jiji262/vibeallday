import type { IssueItem } from "@vibeallday/shared";
import { useI18n } from "../i18n";
import { Badge, type BadgeTone } from "./garden/Badge";

export const TRACKER_STATUS_LABELS = {
  open: "issuesStatus_open",
  draft: "issuesStatus_draft",
  merged: "issuesStatus_merged",
  closed: "issuesStatus_closed",
} as const;

/** Garden tones: open = mint, draft = grey, merged = indigo, closed = rose. */
const TONES: Record<keyof typeof TRACKER_STATUS_LABELS, BadgeTone> = {
  open: "mint",
  draft: "grey",
  merged: "indigo",
  closed: "rose",
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
    <Badge
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
    </Badge>
  );
}
