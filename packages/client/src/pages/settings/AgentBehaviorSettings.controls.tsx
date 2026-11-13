import {
  DEFAULT_LONG_CONTEXT_EFFORT_WARNING_TOKENS,
  LONG_CONTEXT_EFFORT_WARNING_SLIDER_MAX_TOKENS,
  LONG_CONTEXT_EFFORT_WARNING_SLIDER_STEP_TOKENS,
  MAX_POST_COMPACT_REPLAY_TURNS,
  type LongContextEffortWarningSettings,
  type PostCompactReplaySettings,
  type ProviderName,
} from "@vibeallday/shared";
import { useCallback } from "react";
import type { ServerSettings } from "../../api/client";
import { CommittedRangeNumberInput } from "../../components/ui/CommittedRangeNumberInput";
import { useToastContext } from "../../contexts/ToastContext";
import { type MessageKey, useI18n } from "../../i18n";
import styles from "./AgentBehaviorSettings.module.css";
import { SettingsItem } from "./SettingsItem";

export type UpdateServerSetting = <K extends keyof ServerSettings>(
  key: K,
  value: ServerSettings[K],
) => Promise<void>;

export type ProviderChoice = { id: string; displayName: string };
type ProviderFlags = Partial<Record<ProviderName, boolean>>;

/** Per-provider opt-in checkboxes; a cleared box drops the provider's key. */
function ProviderToggleList({
  providers,
  enabled,
  onChange,
}: {
  providers: readonly ProviderChoice[];
  enabled: ProviderFlags | undefined;
  onChange: (next: ProviderFlags) => void;
}) {
  return (
    <div className={styles.providerToggles}>
      {providers.map((provider) => {
        const providerId = provider.id as ProviderName;
        return (
          <label key={provider.id} className={styles.providerToggle}>
            <input
              type="checkbox"
              checked={enabled?.[providerId] === true}
              onChange={(event) => {
                const next = { ...enabled };
                if (event.target.checked) next[providerId] = true;
                else delete next[providerId];
                onChange(next);
              }}
            />
            <span>{provider.displayName}</span>
          </label>
        );
      })}
    </div>
  );
}

/** Save a server setting and toast the outcome with the given messages. */
function useToastedSave<K extends keyof ServerSettings>(
  key: K,
  updateSetting: UpdateServerSetting,
  messages: { saved: MessageKey; failed: MessageKey },
) {
  const { t } = useI18n();
  const { showToast } = useToastContext();
  const { saved, failed } = messages;
  return useCallback(
    async (next: ServerSettings[K]) => {
      try {
        await updateSetting(key, next);
        showToast(t(saved), "success");
      } catch (error) {
        showToast(error instanceof Error ? error.message : t(failed), "error");
      }
    },
    [failed, key, saved, showToast, t, updateSetting],
  );
}

const POST_COMPACT_KEYWORDS = [
  "compact",
  "compaction",
  "continue",
  "replay",
  "handoff",
  "post-compact",
];

export function PostCompactReplayControl({
  value,
  providers,
  updateSetting,
}: {
  value: PostCompactReplaySettings;
  providers: readonly ProviderChoice[];
  updateSetting: UpdateServerSetting;
}) {
  const { t } = useI18n();
  const replayTurnCount = value.replayTurnCount ?? 0;
  const save = useToastedSave("postCompactReplay", updateSetting, {
    saved: "providersPostCompactReplaySaved",
    failed: "providersPostCompactReplaySaveError",
  });

  return (
    <SettingsItem
      id="providers-post-compact-replay"
      label={t("providersPostCompactReplayTitle")}
      description={t("providersPostCompactReplayDescription")}
      keywords={POST_COMPACT_KEYWORDS}
      className="settings-item--wide-control"
      valueText={
        replayTurnCount === 0
          ? t("providersPostCompactReplayNone")
          : t("providersPostCompactReplayCountValue", {
              count: String(replayTurnCount),
            })
      }
    >
      <div className={styles.limitControls}>
        <CommittedRangeNumberInput
          id="providers-post-compact-replay-count"
          min={0}
          max={MAX_POST_COMPACT_REPLAY_TURNS}
          step={1}
          value={replayTurnCount}
          ariaLabel={t("providersPostCompactReplayCountAria")}
          onCommit={(count) => {
            void save({ ...value, replayTurnCount: count });
          }}
        />
        <p className="settings-hint">
          {t("providersPostCompactReplayCountHint")}
        </p>
        <ProviderToggleList
          providers={providers}
          enabled={value.providers}
          onChange={(next) => void save({ ...value, providers: next })}
        />
      </div>
    </SettingsItem>
  );
}

const LONG_CONTEXT_KEYWORDS = [
  "effort",
  "reasoning",
  "prompt cache",
  "cache",
  "long context",
  "fork",
  "warning",
];

/**
 * Long-context effort-change warning: threshold slider plus per-provider
 * checkboxes. Contract: topics/mid-session-effort-change.md.
 */
export function LongContextEffortWarningControl({
  value,
  providers,
  updateSetting,
}: {
  value: LongContextEffortWarningSettings;
  providers: readonly ProviderChoice[];
  updateSetting: UpdateServerSetting;
}) {
  const { t } = useI18n();
  const thresholdTokens =
    value.thresholdTokens ?? DEFAULT_LONG_CONTEXT_EFFORT_WARNING_TOKENS;
  const enabledCount = providers.filter(
    (provider) => value.providers?.[provider.id as ProviderName] === true,
  ).length;
  const save = useToastedSave("longContextEffortWarning", updateSetting, {
    saved: "providersLongContextEffortWarningSaved",
    failed: "providersLongContextEffortWarningSaveError",
  });

  return (
    <SettingsItem
      id="providers-long-context-effort-warning"
      label={t("providersLongContextEffortWarningTitle")}
      description={t("providersLongContextEffortWarningDescription")}
      keywords={LONG_CONTEXT_KEYWORDS}
      className="settings-item--wide-control"
      valueText={
        enabledCount === 0
          ? t("providersLongContextEffortWarningOff")
          : t("providersLongContextEffortWarningValue", {
              tokens: thresholdTokens.toLocaleString(),
              count: String(enabledCount),
            })
      }
    >
      <div className={styles.limitControls}>
        <CommittedRangeNumberInput
          id="providers-long-context-effort-warning-threshold"
          min={0}
          max={LONG_CONTEXT_EFFORT_WARNING_SLIDER_MAX_TOKENS}
          numberMax={Number.MAX_SAFE_INTEGER}
          step={LONG_CONTEXT_EFFORT_WARNING_SLIDER_STEP_TOKENS}
          snapTextToStep={false}
          value={thresholdTokens}
          unit="tokens"
          ariaLabel={t("providersLongContextEffortWarningThresholdAria")}
          onCommit={(tokens) => {
            void save({ ...value, thresholdTokens: Math.round(tokens) });
          }}
        />
        <p className="settings-hint">
          {t("providersLongContextEffortWarningThresholdHint")}
        </p>
        <ProviderToggleList
          providers={providers}
          enabled={value.providers}
          onChange={(next) => void save({ ...value, providers: next })}
        />
      </div>
    </SettingsItem>
  );
}
