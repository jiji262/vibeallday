import type { ProviderChildSessionSummary } from "@vibeallday/shared";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n";
import {
  providerChildSessionHref,
  providerChildTitle,
} from "../../lib/providerChildSessions";
import { EmptyState, StatusDot } from "../garden";
import { ChevronRightIcon } from "../garden/icons";
import styles from "./SessionInspector.module.css";
import { useProviderChildren } from "./useProviderChildren";

/** Same window the header's subagent control calls "recently active". */
const RECENTLY_ACTIVE_MS = 3 * 60 * 1000;

interface ChildrenPanelProps {
  projectId: string;
  sessionId: string;
  basePath: string;
  childrenFromSession?: ProviderChildSessionSummary[];
  running: boolean;
}

function isRecentlyActive(
  child: ProviderChildSessionSummary,
  running: boolean,
  nowMs: number,
): boolean {
  if (!running) return false;
  const updated = Date.parse(child.updatedAt);
  return Number.isFinite(updated) && nowMs - updated < RECENTLY_ACTIVE_MS;
}

export function ChildrenPanel({
  projectId,
  sessionId,
  basePath,
  childrenFromSession,
  running,
}: ChildrenPanelProps) {
  const { t } = useI18n();
  const children = useProviderChildren(sessionId, childrenFromSession);
  if (children.length === 0) {
    return (
      <div className={styles.panelBody}>
        <EmptyState compact title={t("sessionInspectorChildrenEmpty")} />
      </div>
    );
  }
  const nowMs = Date.now();
  const fallback = t("providerChildFallback");
  return (
    <div className={styles.panelBody}>
      <ul className={styles.cards}>
        {children.map((child) => {
          const active = isRecentlyActive(child, running, nowMs);
          const title = providerChildTitle(child, fallback);
          return (
            <li key={child.id}>
              <Link
                className={styles.childCard}
                to={providerChildSessionHref(
                  basePath,
                  projectId,
                  sessionId,
                  child.id,
                )}
              >
                <StatusDot state={active ? "run" : "idle"} />
                <span className={styles.fileText}>
                  <span className={styles.fileName}>{title}</span>
                  <span className={styles.meta}>
                    {[
                      child.agentType && child.agentType !== title
                        ? child.agentType
                        : null,
                      t(
                        active
                          ? "sessionInspectorChildrenActive"
                          : "sessionInspectorChildrenIdle",
                      ),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <ChevronRightIcon aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
