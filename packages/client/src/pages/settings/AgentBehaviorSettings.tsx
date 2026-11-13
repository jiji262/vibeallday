import {
  CLAUDE_GATEWAY_CAPABILITY,
  DEFAULT_IDLE_REAP_HOURS,
  DEFAULT_SUBAGENT_MAX_DEPTH,
  IDLE_REAP_HOURS_SETTING_CAPABILITY,
  MAX_IDLE_REAP_HOURS,
  MAX_SUBAGENT_MAX_DEPTH,
  MIN_SUBAGENT_MAX_DEPTH,
  NEVER_IDLE_REAP_HOURS,
  SUBAGENT_MAX_DEPTH_SETTING_CAPABILITY,
  normalizeIdleReapHours,
  serverHasCapability,
} from "@vibeallday/shared";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { ServerSettings } from "../../api/client";
import { CommittedRangeNumberInput } from "../../components/ui/CommittedRangeNumberInput";
import { useProviders } from "../../hooks/useProviders";
import { useRemoteBasePath } from "../../hooks/useRemoteBasePath";
import { useServerSettings } from "../../hooks/useServerSettings";
import { useVersion } from "../../hooks/useVersion";
import { useI18n } from "../../i18n";
import {
  LongContextEffortWarningControl,
  PostCompactReplayControl,
  type UpdateServerSetting,
} from "./AgentBehaviorSettings.controls";
import styles from "./AgentBehaviorSettings.module.css";
import { ClaudeAutoCompactPercentOverrideControl } from "./compactSettingsControls";
import { InstructionRestorationControl } from "./InstructionRestorationControl";
import { buildProviderDisplayList } from "./ProvidersSettings.data";
import { SettingsItem } from "./SettingsItem";
import { useSettingsPaneTitle } from "./SettingsPaneTitleContext";
import { HideInSettingsSearch } from "./SettingsSearchContext";
import { SettingsSection } from "./SettingsSection";

/** Slider position for "leave it to the provider" (stored as null). */
const PROVIDER_DEFAULT_SUBAGENT_MAX_DEPTH = -1;
const SUBAGENT_DEPTH_TICKS = [1, 2, 3] as const;
const IDLE_REAP_TICK_HOURS = [0, 24, 48] as const;

interface RowProps {
  settings: ServerSettings | null;
  updateSetting: UpdateServerSetting;
}

function SubagentMaxDepthRow({ settings, updateSetting }: RowProps) {
  const { t } = useI18n();
  const depth =
    settings?.subagentMaxDepth === undefined
      ? DEFAULT_SUBAGENT_MAX_DEPTH
      : settings.subagentMaxDepth;
  const valueText =
    depth === null
      ? t("providersSubagentMaxDepthProviderDefault")
      : depth === 0
        ? t("providersSubagentMaxDepthDisabled")
        : t("providersSubagentMaxDepthValue", { value: depth });
  return (
    <SettingsItem
      id="providers-subagent-max-depth"
      label={t("providersSubagentMaxDepthLabel")}
      description={t("providersSubagentMaxDepthDescription")}
      className="settings-item--wide-control"
      valueText={valueText}
    >
      <div className={styles.limitControls}>
        <CommittedRangeNumberInput
          id="providers-subagent-max-depth-control"
          min={PROVIDER_DEFAULT_SUBAGENT_MAX_DEPTH}
          max={MAX_SUBAGENT_MAX_DEPTH}
          numberMin={MIN_SUBAGENT_MAX_DEPTH}
          numberMax={MAX_SUBAGENT_MAX_DEPTH}
          step={1}
          list="providers-subagent-max-depth-ticks"
          value={depth}
          unsetSliderValue={PROVIDER_DEFAULT_SUBAGENT_MAX_DEPTH}
          unit={t("providersSubagentMaxDepthUnit")}
          ariaLabel={t("providersSubagentMaxDepthAria")}
          onCommit={(value) => void updateSetting("subagentMaxDepth", value)}
        />
        <datalist id="providers-subagent-max-depth-ticks">
          <option
            value={PROVIDER_DEFAULT_SUBAGENT_MAX_DEPTH}
            label={t("providersSubagentMaxDepthProviderDefault")}
          />
          <option value={MIN_SUBAGENT_MAX_DEPTH} />
          {SUBAGENT_DEPTH_TICKS.map((tick) => (
            <option key={tick} value={tick} />
          ))}
          <option value={MAX_SUBAGENT_MAX_DEPTH} />
        </datalist>
        <p className="settings-hint">
          {t("providersSubagentMaxDepthCoverage")}
        </p>
      </div>
    </SettingsItem>
  );
}

function IdleReapHoursRow({ settings, updateSetting }: RowProps) {
  const { t } = useI18n();
  const hours = settings?.idleReapHours ?? DEFAULT_IDLE_REAP_HOURS;
  return (
    <SettingsItem
      id="providers-idle-reap-hours"
      label={t("providersIdleReapHoursLabel")}
      description={t("providersIdleReapHoursDescription")}
      className="settings-item--wide-control"
      valueText={
        hours < 0
          ? t("providersIdleReapNever")
          : t("providersIdleReapHoursValue", { value: hours })
      }
    >
      <div className={styles.limitControls}>
        <CommittedRangeNumberInput
          id="providers-idle-reap-hours-control"
          min={NEVER_IDLE_REAP_HOURS}
          max={MAX_IDLE_REAP_HOURS}
          numberMin={NEVER_IDLE_REAP_HOURS}
          numberMax={MAX_IDLE_REAP_HOURS}
          step={1}
          list="providers-idle-reap-hours-ticks"
          value={hours}
          unit={t("providersIdleReapHoursUnit")}
          ariaLabel={t("providersIdleReapHoursAria")}
          snapTextToStep={false}
          onCommit={(value) =>
            void updateSetting("idleReapHours", normalizeIdleReapHours(value))
          }
        />
        <datalist id="providers-idle-reap-hours-ticks">
          <option
            value={NEVER_IDLE_REAP_HOURS}
            label={t("providersIdleReapNever")}
          />
          {IDLE_REAP_TICK_HOURS.map((tick) => (
            <option key={tick} value={tick} />
          ))}
          <option value={MAX_IDLE_REAP_HOURS} />
        </datalist>
        <p className="settings-hint">{t("providersIdleReapNeverHint")}</p>
      </div>
    </SettingsItem>
  );
}

function AgentBehaviorLede() {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  return (
    <HideInSettingsSearch>
      <p className={styles.lede}>
        <Link to={`${basePath}/settings/providers`}>
          {t("settingsAgentBehaviorProvidersNote")}
        </Link>
      </p>
    </HideInSettingsSearch>
  );
}

/**
 * Run-time behaviour shared by every provider: subagent depth, idle reaping,
 * long-context warnings and continuation, and instruction restoration. Row
 * ids keep their `providers-*` names so saved jump links still land.
 */
export function AgentBehaviorSettings() {
  const { t } = useI18n();
  useSettingsPaneTitle(t("settingsAgentBehaviorTitle"));
  const { settings, updateSetting } = useServerSettings();
  const { version } = useVersion();
  const { providers: serverProviders } = useProviders();
  const supportsGateway = serverHasCapability(
    version,
    CLAUDE_GATEWAY_CAPABILITY,
  );
  const providers = useMemo(
    () => buildProviderDisplayList(serverProviders, supportsGateway),
    [serverProviders, supportsGateway],
  );
  const rowProps = { settings, updateSetting };
  const supportsDepth = serverHasCapability(
    version,
    SUBAGENT_MAX_DEPTH_SETTING_CAPABILITY,
  );
  const supportsIdleReap = serverHasCapability(
    version,
    IDLE_REAP_HOURS_SETTING_CAPABILITY,
  );
  const claudeAutoCompact = providers.some(
    (p) => p.id === "claude" && p.supportsLaunchCompactPercentOverride,
  );
  const hasLongContextRows =
    settings?.longContextEffortWarning !== undefined ||
    settings?.postCompactReplay !== undefined ||
    claudeAutoCompact;

  return (
    <>
      <AgentBehaviorLede />
      {supportsDepth && (
        <SettingsSection
          title={t("settingsAgentBehaviorSubagents")}
          scope="server"
        >
          <div className="settings-group">
            <SubagentMaxDepthRow {...rowProps} />
          </div>
        </SettingsSection>
      )}
      {supportsIdleReap && (
        <SettingsSection title={t("settingsAgentBehaviorIdle")} scope="server">
          <div className="settings-group">
            <IdleReapHoursRow {...rowProps} />
          </div>
        </SettingsSection>
      )}
      {hasLongContextRows && (
        <SettingsSection
          title={t("settingsAgentBehaviorLongContext")}
          scope="server"
        >
          <div className="settings-group">
            {settings?.longContextEffortWarning !== undefined && (
              <LongContextEffortWarningControl
                value={settings.longContextEffortWarning}
                providers={providers}
                updateSetting={updateSetting}
              />
            )}
            {settings?.postCompactReplay !== undefined && (
              <PostCompactReplayControl
                value={settings.postCompactReplay}
                providers={providers}
                updateSetting={updateSetting}
              />
            )}
            {claudeAutoCompact && (
              <ClaudeAutoCompactPercentOverrideControl
                id="provider-claude-auto-compact"
                value={settings?.claudeAutoCompactPercentOverride}
                updateSetting={updateSetting}
              />
            )}
          </div>
        </SettingsSection>
      )}
      {settings?.instructionRestoration !== undefined && (
        <SettingsSection
          title={t("settingsAgentBehaviorRestoration")}
          scope="server"
        >
          <div className="settings-group">
            <InstructionRestorationControl
              value={settings.instructionRestoration}
              providers={providers}
              save={(value) => updateSetting("instructionRestoration", value)}
            />
          </div>
        </SettingsSection>
      )}
    </>
  );
}
