import { type ReactNode, useEffect, useState } from "react";
import { api } from "../api/client";
import { SessionMetadataProvider } from "../contexts/SessionMetadataContext";
import { useI18n } from "../i18n";
import type { AgentSession } from "../types";
import { Status, Tag } from "./garden";
import { TaskNestedContent } from "./renderers/tools/TaskNestedContent";
import { ChildSessionTask } from "./session-inspector/ChildSessionTask";
import {
  CHILD_STATUS,
  CHILD_STATUS_LABEL,
} from "./session-inspector/childTaskFacts";
import styles from "./ProviderChildSessionDetail.module.css";

interface ProviderChildSessionDetailProps {
  projectId: string;
  sessionId: string;
  agentId: string;
  fallbackTitle?: string;
  actions?: ReactNode;
  headingLevel?: 1 | 2;
  /** Page mode: parent › 子代理 trail above the title. */
  breadcrumb?: ReactNode;
  /** Page mode: the 只读 tag and the parent's task card. */
  page?: boolean;
  /** Between the header and the transcript (the sibling switcher). */
  subheader?: ReactNode;
}

export function ProviderChildSessionDetail({
  projectId,
  sessionId,
  agentId,
  fallbackTitle,
  actions,
  headingLevel = 2,
  breadcrumb,
  page = false,
  subheader,
}: ProviderChildSessionDetailProps) {
  const { t } = useI18n();
  const [content, setContent] = useState<AgentSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);
    void api
      .getAgentSession(projectId, sessionId, agentId)
      .then((data) => {
        if (!cancelled) setContent(data);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : t("providerChildPageNotFound"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentId, projectId, sessionId, t]);

  const title =
    content?.description ||
    content?.agentType ||
    fallbackTitle ||
    t("providerChildFallback");
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <div className={styles.identity}>
          {breadcrumb}
          <div className={styles.titleRow}>
            <Heading className={styles.title}>{title}</Heading>
            {page && <Tag>{t("providerChildReadOnlyTag")}</Tag>}
            {content?.status && (
              <Status state={CHILD_STATUS[content.status]}>
                {t(CHILD_STATUS_LABEL[content.status])}
              </Status>
            )}
          </div>
          <div className={styles.meta}>
            {content?.agentType && content.agentType !== title && (
              <span>{content.agentType}</span>
            )}
            {content?.spawnDepth !== undefined && (
              <span>
                {t("providerChildSpawnDepth", { count: content.spawnDepth })}
              </span>
            )}
          </div>
        </div>
        <p className={styles.readonly}>{t("providerChildPageReadOnly")}</p>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      {subheader}
      <div className={styles.content}>
        {loading && (
          <p className={styles.status}>{t("providerChildPageLoading")}</p>
        )}
        {!loading && error && <p className={styles.status}>{error}</p>}
        {!loading && !error && content && (
          <SessionMetadataProvider
            projectId={projectId}
            projectPath={null}
            sessionId={sessionId}
            sessionTitle={title}
          >
            {page && <ChildSessionTask content={content} />}
            {content.messages.length > 0 ? (
              <TaskNestedContent
                messages={content.messages}
                isStreaming={content.status === "running"}
              />
            ) : (
              <p className={styles.status}>{t("providerChildPageEmpty")}</p>
            )}
          </SessionMetadataProvider>
        )}
      </div>
    </section>
  );
}
