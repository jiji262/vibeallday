import type { ReviewComment } from "@vibeallday/shared";
import { useLayoutEffect, useRef } from "react";
import { Count } from "../components/garden/Count";
import type { TranslationFn } from "../i18n";
import { ReviewCommentsPanel } from "./ReviewCommentsPanel";
import { ReviewSubmissionsPanel } from "./ReviewSubmissionsPanel";
import styles from "./ReviewTabPanel.module.css";

/**
 * The Review tab (design GitReview boards): pending comments first, then the
 * submitted reviews when the review-history opt-in is on. `tab=comments` and
 * `tab=reviews` both land here; `reviews` (with `submission`) scrolls to the
 * submitted section once, so those deep links keep their target.
 */
export function ReviewTabPanel({
  projectId,
  pending,
  onOpenFile,
  onSubmit,
  reviewsEnabled,
  focusSubmitted,
  initialSubmissionId,
  sessionHref,
  t,
}: {
  projectId: string;
  pending: ReviewComment[];
  onOpenFile: (path: string) => void;
  onSubmit: () => void;
  reviewsEnabled: boolean;
  /** Deep link into the submitted reviews (`tab=reviews`). */
  focusSubmitted: boolean;
  initialSubmissionId?: string;
  sessionHref: (sessionId: string) => string;
  t: TranslationFn;
}) {
  const submittedRef = useRef<HTMLElement>(null);
  const scrolledRef = useRef(false);
  useLayoutEffect(() => {
    if (!focusSubmitted || scrolledRef.current) return;
    scrolledRef.current = true;
    submittedRef.current?.scrollIntoView?.({ block: "start" });
  }, [focusSubmitted]);
  return (
    <div className={styles.panel} data-source-review-tab>
      <section
        className={styles.section}
        aria-labelledby="source-review-pending-heading"
      >
        <h2 id="source-review-pending-heading" className={styles.heading}>
          {t("sourceReviewPendingHeading")}
          {pending.length > 0 ? <Count>{pending.length}</Count> : null}
        </h2>
        <ReviewCommentsPanel
          projectId={projectId}
          pending={pending}
          onOpenFile={onOpenFile}
          onSubmit={onSubmit}
          t={t}
        />
      </section>
      {reviewsEnabled ? (
        <section
          ref={submittedRef}
          className={styles.section}
          aria-labelledby="source-review-submitted-heading"
        >
          <h2 id="source-review-submitted-heading" className={styles.heading}>
            {t("sourceReviewSubmittedHeading")}
          </h2>
          <ReviewSubmissionsPanel
            projectId={projectId}
            initialSubmissionId={initialSubmissionId}
            sessionHref={sessionHref}
            t={t}
          />
        </section>
      ) : null}
    </div>
  );
}
