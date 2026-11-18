import type { ReviewComment } from "@vibeallday/shared";
import { Button } from "../components/garden/Button";
import { Count } from "../components/garden/Count";
import { CommentIcon } from "../components/garden/icons";
import type { TranslationFn } from "../i18n";
import styles from "./PendingReviewAction.module.css";

const ICON_SIZE = 15;

/** File name and line of a draft, e.g. `DraftSyncBridge.ts:43`. */
function draftLocation(comment: ReviewComment): string {
  const { anchor } = comment;
  const name = anchor.path.split("/").pop() || anchor.path;
  const line = anchor.side === "old" ? anchor.oldLine : anchor.newLine;
  return line ? `${name}:${line}` : name;
}

/**
 * Studio Floating Review Action Bar: surfaces pending inline review drafts
 * outside the Review tab as an elevated floating dock on desktop and a crisp
 * card in the flow on mobile.
 */
export function PendingReviewAction({
  pending,
  onSubmit,
  t,
}: {
  pending: readonly ReviewComment[];
  onSubmit: () => void;
  t: TranslationFn;
}) {
  if (pending.length === 0) return null;
  const count = pending.length;
  const summary = t("sourceCommentCount", { count });
  const locations = [...new Set(pending.map(draftLocation))].join(", ");
  return (
    <aside className={styles.root} aria-label={summary}>
      <span className={styles.iconWrap} aria-hidden="true">
        <CommentIcon size={ICON_SIZE} className={styles.icon} />
      </span>
      <div className={styles.summary}>
        <span className={styles.title}>{summary}</span>
        <span className={styles.meta}>{locations}</span>
      </div>
      <Button
        variant="primary"
        size="sm"
        className={styles.submit}
        onClick={onSubmit}
      >
        {t("sourceReviewSubmitTitle")}
        <Count className={styles.count}>{count}</Count>
      </Button>
    </aside>
  );
}
