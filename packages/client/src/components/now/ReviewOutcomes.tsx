import type { ReviewInboxItem } from "@vibeallday/shared";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n";
import { Badge, type BadgeTone } from "../garden/Badge";
import { Card, CardHeader } from "../garden/Card";
import styles from "./ReviewOutcomes.module.css";

type Disposition = ReviewInboxItem["outcomes"][number]["disposition"];
type Translate = ReturnType<typeof useI18n>["t"];

function dispositionLabel(disposition: Disposition, t: Translate): string {
  if (disposition === "wont_fix") return t("sourceReviewOutcomeNoChange");
  if (disposition === "question") return t("sourceReviewOutcomeQuestion");
  return t("sourceReviewOutcomeDone");
}

function dispositionTone(disposition: Disposition): BadgeTone {
  if (disposition === "wont_fix") return "grey";
  if (disposition === "question") return "indigo";
  return "mint";
}

function sessionHref(basePath: string, projectId: string, sessionId: string) {
  return `${basePath}/projects/${encodeURIComponent(
    projectId,
  )}/sessions/${encodeURIComponent(sessionId)}`;
}

interface ReviewOutcomesProps {
  items: ReviewInboxItem[];
  basePath: string;
  hideProjectName: boolean;
}

/** Unread source-review replies, one row per outcome. */
export function ReviewOutcomes({
  items,
  basePath,
  hideProjectName,
}: ReviewOutcomesProps) {
  const { t } = useI18n();
  const outcomes = items.flatMap((item) =>
    item.outcomes.map((outcome) => ({ item, outcome })),
  );
  return (
    <Card as="section" flush aria-label={t("inboxTierReviewOutcomes")}>
      <CardHeader title={t("inboxTierReviewOutcomes")} meta={outcomes.length} />
      <ul className={styles.list}>
        {outcomes.map(({ item, outcome }) => {
          const reviewParams = new URLSearchParams({
            projectId: item.projectId,
            tab: "reviews",
            submission: item.submissionId,
          });
          return (
            <li
              key={`${item.submissionId}\0${outcome.siteId}\0${outcome.entryId}`}
              className={styles.row}
            >
              <div className={styles.head}>
                <Link
                  className={styles.name}
                  to={`${basePath}/git-status?${reviewParams}`}
                >
                  {item.name ?? t("sourceReviewUnreadSubmission")}
                </Link>
                <Badge tone={dispositionTone(outcome.disposition)}>
                  {dispositionLabel(outcome.disposition, t)}
                </Badge>
              </div>
              <div className={styles.text}>{outcome.text}</div>
              <div className={styles.meta}>
                {!hideProjectName && <span>{item.projectName}</span>}
                <span className={styles.path}>{outcome.path}</span>
                {outcome.sessionId && (
                  <Link
                    to={sessionHref(
                      basePath,
                      item.projectId,
                      outcome.sessionId,
                    )}
                  >
                    {t("sourceReviewOutcomeSession")}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
