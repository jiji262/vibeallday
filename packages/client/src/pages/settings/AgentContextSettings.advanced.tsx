import type { ReactNode } from "react";
import { HeartbeatTextArea } from "../../components/HeartbeatTextArea";
import { useI18n } from "../../i18n";
import styles from "./AgentContextSettings.module.css";
import { SettingsItem } from "./SettingsItem";
import { useSettingsSearchScope } from "./SettingsSearchContext";

const MIN_HEARTBEAT_MINUTES = 1;
const MAX_HEARTBEAT_MINUTES = 1440;

interface AgentContextAdvancedProps {
  latexMathRendering: boolean;
  onLatexChange: (next: boolean) => void;
  heartbeatMinutes: string;
  onHeartbeatMinutesChange: (next: string) => void;
  heartbeatText: string;
  onHeartbeatTextChange: (next: string) => void;
  heartbeatPlaceholder: string;
}

/**
 * LaTeX hint and heartbeat defaults, folded under "Advanced" (design
 * .sac-adv). Settings search shows the rows unfolded so matches stay visible.
 */
export function AgentContextAdvanced(props: AgentContextAdvancedProps) {
  const { t } = useI18n();
  const searching = useSettingsSearchScope() !== null;
  const rows = <AdvancedRows {...props} />;
  if (searching) return rows;
  const summary = t("settingsAgentContextAdvancedSummary", {
    latex: props.latexMathRendering
      ? t("settingsAgentContextLatexHintOn")
      : t("settingsAgentContextLatexHintOff"),
    minutes: props.heartbeatMinutes,
    text: props.heartbeatText,
  });
  return (
    <details className={styles.advanced}>
      <summary className={styles.advancedSummary}>
        <span className={styles.advancedTitle}>
          {t("settingsAgentContextAdvanced")}
        </span>
        <span className={styles.advancedMeta}>{summary}</span>
      </summary>
      {rows}
    </details>
  );
}

function AdvancedRows({
  latexMathRendering,
  onLatexChange,
  heartbeatMinutes,
  onHeartbeatMinutesChange,
  heartbeatText,
  onHeartbeatTextChange,
  heartbeatPlaceholder,
}: AgentContextAdvancedProps): ReactNode {
  const { t } = useI18n();
  return (
    <div className="settings-group">
      <SettingsItem
        as="label"
        label={t("agentContextSuggestedLatexTitle")}
        description={t("agentContextSuggestedLatexDescription")}
        keywords={[t("agentContextSuggestedHintsTitle")]}
      >
        <input
          type="checkbox"
          checked={latexMathRendering}
          onChange={(e) => onLatexChange(e.target.checked)}
          aria-label={t("agentContextSuggestedLatexTitle")}
        />
      </SettingsItem>
      <SettingsItem
        label={t("agentContextHeartbeatAfterTitle")}
        description={t("agentContextHeartbeatAfterDescription")}
        valueText={heartbeatMinutes}
      >
        <input
          type="number"
          className="settings-input-small"
          min={MIN_HEARTBEAT_MINUTES}
          max={MAX_HEARTBEAT_MINUTES}
          value={heartbeatMinutes}
          aria-label={t("agentContextHeartbeatAfterTitle")}
          onChange={(e) => onHeartbeatMinutesChange(e.target.value)}
        />
      </SettingsItem>
      <SettingsItem
        label={t("agentContextHeartbeatTextTitle")}
        description={t("agentContextHeartbeatTextDescription")}
        valueText={heartbeatText}
        className={styles.stackedRow}
      >
        <HeartbeatTextArea
          className="settings-input"
          value={heartbeatText}
          onChange={onHeartbeatTextChange}
          placeholder={heartbeatPlaceholder}
        />
      </SettingsItem>
    </div>
  );
}
