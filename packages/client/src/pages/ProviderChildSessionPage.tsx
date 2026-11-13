import { Link, useParams } from "react-router-dom";
import { Notice } from "../components/garden";
import { ProviderChildSessionDetail } from "../components/ProviderChildSessionDetail";
import childStyles from "../components/session-inspector/ChildSession.module.css";
import { ChildSessionSiblings } from "../components/session-inspector/ChildSessionSiblings";
import { useParentSession } from "../components/session-inspector/useParentSession";
import { useProviderChildren } from "../components/session-inspector/useProviderChildren";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useI18n } from "../i18n";
import styles from "./ProviderChildSessionPage.module.css";

interface ChildRoute {
  projectId: string;
  sessionId: string;
  agentId: string;
  basePath: string;
}

function ChildBreadcrumb({
  parentHref,
  parentTitle,
}: {
  parentHref: string;
  parentTitle?: string;
}) {
  const { t } = useI18n();
  return (
    <nav className={childStyles.crumbs} aria-label={t("breadcrumbLabel")}>
      <Link to={parentHref}>
        {parentTitle ?? t("providerChildParentFallback")}
      </Link>
      <span aria-hidden="true">›</span>
      <span>{t("sessionInspectorTabChildren")}</span>
    </nav>
  );
}

/** Read-only notice where a session's composer would be. */
function ReadOnlyDock({ parentHref }: { parentHref: string }) {
  const { t } = useI18n();
  return (
    <div className={childStyles.dock}>
      <Notice
        actions={
          <Link className={`btn-primary ${styles.dockLink}`} to={parentHref}>
            {t("providerChildPageBack")}
          </Link>
        }
      >
        {t("providerChildDockNotice")}
      </Notice>
    </div>
  );
}

function ChildSessionView({
  projectId,
  sessionId,
  agentId,
  basePath,
}: ChildRoute) {
  const { t } = useI18n();
  const parent = useParentSession(projectId, sessionId);
  const siblings = useProviderChildren(sessionId, parent.providerChildren);
  const parentHref = `${basePath}/projects/${projectId}/sessions/${sessionId}`;
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <ProviderChildSessionDetail
          key={agentId}
          projectId={projectId}
          sessionId={sessionId}
          agentId={agentId}
          headingLevel={1}
          page
          breadcrumb={
            <ChildBreadcrumb
              parentHref={parentHref}
              parentTitle={parent.title}
            />
          }
          actions={
            <Link className={styles.parentLink} to={parentHref}>
              {t("providerChildPageBack")}
            </Link>
          }
          subheader={
            <ChildSessionSiblings
              basePath={basePath}
              projectId={projectId}
              sessionId={sessionId}
              agentId={agentId}
              siblings={siblings}
            />
          }
        />
        <ReadOnlyDock parentHref={parentHref} />
      </main>
    </div>
  );
}

export function ProviderChildSessionPage() {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  const { projectId, sessionId, agentId } = useParams<{
    projectId: string;
    sessionId: string;
    agentId: string;
  }>();

  if (!projectId || !sessionId || !agentId) {
    return (
      <div className={styles.page}>
        <p className={styles.status}>{t("providerChildPageInvalidUrl")}</p>
      </div>
    );
  }

  return (
    <ChildSessionView
      projectId={projectId}
      sessionId={sessionId}
      agentId={agentId}
      basePath={basePath}
    />
  );
}
