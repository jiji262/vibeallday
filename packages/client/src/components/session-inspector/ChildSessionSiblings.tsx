import type { ProviderChildSessionSummary } from "@vibeallday/shared";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n";
import {
  providerChildSessionHref,
  providerChildTitle,
} from "../../lib/providerChildSessions";
import { SegmentedNav, segmentedLinkClassName } from "../garden";
import styles from "./ChildSession.module.css";

interface ChildSessionSiblingsProps {
  basePath: string;
  projectId: string;
  sessionId: string;
  agentId: string;
  siblings: readonly ProviderChildSessionSummary[];
}

/**
 * Switches between children of the same parent. Hidden unless there is a
 * sibling to switch to, or when the current child is not in the list.
 */
export function ChildSessionSiblings({
  basePath,
  projectId,
  sessionId,
  agentId,
  siblings,
}: ChildSessionSiblingsProps) {
  const { t } = useI18n();
  if (siblings.length < 2 || !siblings.some((child) => child.id === agentId)) {
    return null;
  }
  const fallback = t("providerChildFallback");
  return (
    <div className={styles.siblings}>
      <SegmentedNav label={t("providerChildSiblings")}>
        {siblings.map((child) => {
          const title = providerChildTitle(child, fallback);
          const current = child.id === agentId;
          return (
            <Link
              key={child.id}
              to={providerChildSessionHref(
                basePath,
                projectId,
                sessionId,
                child.id,
              )}
              className={segmentedLinkClassName}
              aria-current={current ? "page" : undefined}
            >
              <span className={styles.siblingLabel} title={title}>
                {title}
              </span>
            </Link>
          );
        })}
      </SegmentedNav>
    </div>
  );
}
