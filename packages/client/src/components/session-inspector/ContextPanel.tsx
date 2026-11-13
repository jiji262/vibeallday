import type { ContextUsage } from "@vibeallday/shared";
import type { CSSProperties } from "react";
import { useContextBreakdown } from "../../hooks/useContextBreakdown";
import { useI18n } from "../../i18n";
import { formatTokens } from "../ContextUsageIndicator";
import { EmptyState } from "../garden";
import {
  bucketContext,
  type ContextBuckets,
  percentOf,
} from "./contextBuckets";
import styles from "./SessionInspector.module.css";
import contextStyles from "./ContextPanel.module.css";

interface ContextPanelProps {
  sessionId: string;
  /** Last-turn usage from the session; the breakdown adds the split. */
  usage?: ContextUsage;
}

const BUCKETS = [
  {
    key: "system",
    label: "sessionInspectorContextSystem",
    tone: contextStyles.keySystem,
  },
  {
    key: "files",
    label: "sessionInspectorContextFiles",
    tone: contextStyles.keyFiles,
  },
  {
    key: "conversation",
    label: "sessionInspectorContextConversation",
    tone: contextStyles.keyConversation,
  },
] as const;

function Ring({ percent }: { percent: number }) {
  const { t } = useI18n();
  return (
    <span
      className={contextStyles.ring}
      role="img"
      aria-label={t("sessionInspectorContextUsedLabel", { percent })}
      style={{ "--p": percent } as CSSProperties}
    >
      <b>{percent}%</b>
    </span>
  );
}

function Composition({ buckets }: { buckets: ContextBuckets }) {
  const { t } = useI18n();
  const shares = {
    system: percentOf(buckets.system, buckets.max),
    files: percentOf(buckets.files, buckets.max),
    conversation: percentOf(buckets.conversation, buckets.max),
  };
  return (
    <>
      <div
        className={contextStyles.stack}
        role="img"
        aria-label={t("sessionInspectorContextComposition", shares)}
      >
        {BUCKETS.map((bucket) => (
          <span
            key={bucket.key}
            className={bucket.tone}
            style={{ width: `${shares[bucket.key]}%` }}
          />
        ))}
      </div>
      <ul className={styles.legend}>
        {BUCKETS.map((bucket) => (
          <li key={bucket.key} className={styles.kv}>
            <span className={`${contextStyles.swatch} ${bucket.tone}`} />
            <span className={styles.kvKey}>{t(bucket.label)}</span>
            <span className={styles.meta}>
              {formatTokens(buckets[bucket.key])}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Totals({
  used,
  max,
  autoAt,
}: {
  used: number;
  max?: number;
  autoAt?: number;
}) {
  const { t } = useI18n();
  return (
    <span className={contextStyles.totals}>
      <span className={styles.strong}>
        {formatTokens(used)}
        {max ? ` / ${formatTokens(max)}` : ""}
      </span>
      <span className={styles.meta}>
        {max
          ? t("sessionInspectorContextRemaining", {
              tokens: formatTokens(Math.max(0, max - used)),
            })
          : null}
        {autoAt
          ? ` · ${t("sessionInspectorContextAutoCompact", { tokens: formatTokens(autoAt) })}`
          : null}
      </span>
    </span>
  );
}

/**
 * Context window use. The breakdown request runs only while this tab is
 * mounted, once per opening; the ring falls back to the session's last-turn
 * usage when the provider reports no breakdown.
 */
export function ContextPanel({ sessionId, usage }: ContextPanelProps) {
  const { t } = useI18n();
  const state = useContextBreakdown(sessionId, true);
  const buckets =
    state?.status === "loaded" ? bucketContext(state.breakdown) : null;
  const used = buckets?.total ?? usage?.inputTokens;
  const max = buckets?.max ?? usage?.contextWindow;
  if (used === undefined) {
    return (
      <div className={styles.panelBody}>
        <EmptyState compact title={t("sessionInspectorContextEmpty")} />
      </div>
    );
  }
  const percent = max
    ? percentOf(used, max)
    : Math.round(usage?.percentage ?? 0);
  return (
    <div className={styles.panelBody}>
      <div className={contextStyles.ringRow}>
        <Ring percent={percent} />
        <Totals used={used} max={max} autoAt={buckets?.autoCompactAt} />
      </div>
      {state?.status === "loading" && (
        <p className={styles.hint}>{t("sessionInspectorLoading")}</p>
      )}
      {buckets ? (
        <Composition buckets={buckets} />
      ) : (
        state?.status !== "loading" && (
          <p className={styles.hint}>
            {t("sessionInspectorContextBreakdownMissing")}
          </p>
        )
      )}
    </div>
  );
}
