import { useI18n } from "../../i18n";
import { Button } from "../garden/Button";
import styles from "./ProjectSessionCta.module.css";

/**
 * Arriving from a project: start a session there, seeded with the needle
 * as its first prompt when there is one.
 */
export function ProjectSessionCta({
  projectName,
  query,
  onStart,
}: {
  projectName: string;
  query: string;
  onStart: () => void;
}) {
  const { t } = useI18n();
  const prompt = query.trim();
  return (
    <div className={`global-sessions-project-cta ${styles.cta}`}>
      <div className={styles.copy}>
        <strong>
          {t("sidebarNewSession")}{" "}
          <code className="global-sessions-project-cta__token">
            {projectName}
          </code>
        </strong>
        <span>
          {prompt
            ? t("globalSessionsProjectCtaPromptLabel")
            : t("globalSessionsProjectCtaHint")}{" "}
          <code className="global-sessions-project-cta__token">
            {prompt || projectName}
          </code>
        </span>
      </div>
      <Button variant="primary" size="sm" onClick={onStart}>
        {t("sidebarNewSession")}
      </Button>
    </div>
  );
}
