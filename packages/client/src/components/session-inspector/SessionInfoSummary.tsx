import type { ProviderName } from "@vibeallday/shared";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n";
import { ChevronRightIcon } from "../garden/icons";
import { ProviderBadge } from "../ProviderBadge";
import {
  type SessionHeaderState,
  SessionHeaderStateBadge,
} from "../SessionHeaderMeta";
import styles from "./SessionInfoSummary.module.css";

export interface SessionInfoSummaryProps {
  state: SessionHeaderState;
  project?: { name: string; href: string };
  model?: {
    provider: ProviderName;
    model?: string;
    thinking?: { type: string };
    effort?: string;
  };
  /** Opens the existing model and session-info panel. */
  onOpenModel: () => void;
  /** Closes the surrounding session menu sheet. */
  close: () => void;
}

/**
 * Top of the phone 会话信息 sheet: status, project and the model row. It only
 * links to destinations the header already offers; the session menu's own
 * groups follow it in the same sheet.
 */
export function SessionInfoSummary({
  state,
  project,
  model,
  onOpenModel,
  close,
}: SessionInfoSummaryProps) {
  const { t } = useI18n();
  return (
    <section className={styles.summary} aria-labelledby="session-info-summary">
      <div className={styles.head}>
        <h2 className={styles.title} id="session-info-summary">
          {t("sessionInfoShortcut")}
        </h2>
        <SessionHeaderStateBadge state={state} />
      </div>
      <div className={styles.card}>
        {project && (
          <Link className={styles.row} to={project.href} onClick={close}>
            <span className={styles.key}>{t("sessionInfoSheetProject")}</span>
            <span className={styles.value}>{project.name}</span>
            <ChevronRightIcon aria-hidden="true" />
          </Link>
        )}
        {model && (
          <button
            type="button"
            className={styles.row}
            onClick={() => {
              close();
              onOpenModel();
            }}
          >
            <span className={styles.key}>{t("sessionInfoSheetModel")}</span>
            <ProviderBadge
              flat
              provider={model.provider}
              model={model.model}
              thinking={model.thinking}
              effort={model.effort}
            />
            <ChevronRightIcon aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
