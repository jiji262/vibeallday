import type { ReviewComment } from "@vibeallday/shared";
import { Button } from "../components/garden/Button";
import { Count } from "../components/garden/Count";
import { CommentIcon } from "../components/garden/icons";
import type { TranslationFn } from "../i18n";
import styles from "./PendingReviewAction.module.css";

const ICON_SIZE = 16;

/** File name and line of a draft, e.g. `DraftSyncBridge.ts:43`. */
function draftLocation(comment: ReviewComment): string {
  const { anchor } = comment;
  const name = anchor.path.split("/").pop() || anchor.path;
  const line = anchor.side === "old" ? anchor.oldLine : anchor.newLine;
  return line ? `${name}:${line}` : name;
}

/**
 * Design 提交审查: drafts waiting outside the review tab. Wide layouts float
 * a button over the page corner; phones show it as a card in the flow.
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
      <CommentIcon size={ICON_SIZE} className={styles.icon} />
      <div className={styles.summary}>
        <span className={styles.title}>{summary}</span>
        <span className={styles.meta}>{locations}</span>
      </div>
      <Button className={styles.submit} onClick={onSubmit}>
        <CommentIcon size={ICON_SIZE} className={styles.buttonIcon} />
        {t("sourceReviewSubmitTitle")}
        <Count tone="accent" className={styles.count}>
          {count}
        </Count>
      </Button>
    </aside>
  );
}
