import { useMemo } from "react";
import { useI18n } from "../../i18n";
import type { AgentSession } from "../../types";
import { Status } from "../garden";
import {
  CHILD_STATUS,
  CHILD_STATUS_LABEL,
  childTaskPrompt,
  countChildToolCalls,
} from "./childTaskFacts";
import styles from "./ChildSession.module.css";

/**
 * Task card on a child session page: the prompt the parent handed over and
 * the stats the transcript can answer (status, type, tool calls). Duration
 * and model are not reported for provider children, so they are left out.
 */
export function ChildSessionTask({ content }: { content: AgentSession }) {
  const { t } = useI18n();
  const prompt = useMemo(() => childTaskPrompt(content.messages), [content]);
  const toolCalls = useMemo(
    () => countChildToolCalls(content.messages),
    [content],
  );
  return (
    <article className={styles.task} aria-labelledby="child-session-task">
      <div className={styles.taskBody}>
        <h2 className={styles.eyebrow} id="child-session-task">
          {t("providerChildTaskHeading")}
        </h2>
        {prompt && <p className={styles.prompt}>{prompt}</p>}
      </div>
      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>{t("providerChildStatLabel")}</dt>
          <dd>
            <Status state={CHILD_STATUS[content.status]}>
              {t(CHILD_STATUS_LABEL[content.status])}
            </Status>
          </dd>
        </div>
        {content.agentType && (
          <div className={styles.stat}>
            <dt>{t("providerChildTypeLabel")}</dt>
            <dd className={styles.mono}>{content.agentType}</dd>
          </div>
        )}
        <div className={styles.stat}>
          <dt>{t("providerChildToolCallsLabel")}</dt>
          <dd className={styles.mono}>
            {t("providerChildToolCallsCount", { count: toolCalls })}
          </dd>
        </div>
      </dl>
    </article>
  );
}
