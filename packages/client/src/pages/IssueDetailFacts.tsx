import type { IssueItem } from "@vibeallday/shared";
import { Fragment, type ReactNode } from "react";
import {
  TRACKER_STATUS_LABELS,
  TrackerStatusBadge,
} from "../components/TrackerStatusBadge";
import { type MessageKey, useI18n } from "../i18n";
import { formatBriefAge } from "../lib/sessionAge";
import styles from "./IssueDetailFacts.module.css";
import { IssueTypeBadge } from "./IssueTypeBadge";

type Translate = ReturnType<typeof useI18n>["t"];

interface Fact {
  key: string;
  label: string;
  value: ReactNode;
}

/** A timestamp as "2h ago", with the full time on hover. */
function AgeValue({
  timestamp,
  unknown,
}: {
  timestamp?: string | null;
  unknown: MessageKey;
}) {
  const { t } = useI18n();
  const age = formatBriefAge(timestamp);
  if (!age || !timestamp) return <>{t(unknown)}</>;
  return (
    <time dateTime={timestamp} title={new Date(timestamp).toLocaleString()}>
      {t("issuesFactAge", { age })}
    </time>
  );
}

function trackerFact(item: IssueItem, t: Translate): Fact | null {
  const status = item.trackerStatus;
  const label = status && TRACKER_STATUS_LABELS[status.state];
  if (!status || !label) return null;
  return {
    key: "tracker",
    label: t("issuesFactTracker"),
    value: t("issuesStatusChecked", {
      state: t(label),
      age: formatBriefAge(status.checkedAt) ?? "?",
    }),
  };
}

function issueFacts(item: IssueItem, t: Translate): Fact[] {
  const facts: Array<Fact | null> = [
    {
      key: "sessions",
      label: t("issuesColumnSessions"),
      value: t(
        item.sessionCount === 1 ? "issuesSingleSession" : "issuesSessionCount",
        { count: item.sessionCount },
      ),
    },
    {
      key: "activity",
      label: t("issuesFactActivity"),
      value: (
        <AgeValue
          timestamp={item.lastSessionActivityAt}
          unknown="issuesActivityUnknown"
        />
      ),
    },
    {
      key: "mentioned",
      label: t("issuesFactMentioned"),
      value: (
        <AgeValue
          timestamp={item.lastMentionAt}
          unknown="issuesMentionTimeUnknown"
        />
      ),
    },
    trackerFact(item, t),
  ];
  return facts.filter((fact): fact is Fact => fact !== null);
}

/** Design detail eyebrow: the key, then what it is and where it stands. */
export function IssueDetailKeyRow({ item }: { item: IssueItem }) {
  return (
    <p className={styles.keyRow}>
      <span className={styles.key}>{item.key}</span>
      <IssueTypeBadge item={item} />
      <TrackerStatusBadge item={item} />
    </p>
  );
}

/** Design .iss-dl: what the index knows about the reference. */
export function IssueDetailFacts({ item }: { item: IssueItem }) {
  const { t } = useI18n();
  return (
    <dl className={styles.facts}>
      {issueFacts(item, t).map((fact) => (
        <Fragment key={fact.key}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
