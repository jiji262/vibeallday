import type { ProviderChildSessionSummary } from "@vibeallday/shared";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n";
import {
  providerChildSessionHref,
  providerChildTitle,
} from "../../lib/providerChildSessions";
import { Segmented, type SegmentedOption } from "../garden";
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
  const navigate = useNavigate();
  if (siblings.length < 2 || !siblings.some((child) => child.id === agentId)) {
    return null;
  }
  const fallback = t("providerChildFallback");
  const options: SegmentedOption<string>[] = siblings.map((child) => ({
    value: child.id,
    label: (
      <span
        className={styles.siblingLabel}
        title={providerChildTitle(child, fallback)}
      >
        {providerChildTitle(child, fallback)}
      </span>
    ),
  }));
  return (
    <div className={styles.siblings}>
      <Segmented
        label={t("providerChildSiblings")}
        options={options}
        value={agentId}
        onChange={(id) =>
          navigate(providerChildSessionHref(basePath, projectId, sessionId, id))
        }
      />
    </div>
  );
}
