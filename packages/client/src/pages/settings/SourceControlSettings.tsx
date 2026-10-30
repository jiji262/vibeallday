import {
  GIT_LIVE_WORKTREE_SETTING_CAPABILITY,
  serverHasCapability,
} from "@vibeallday/shared";
import { ErrorState } from "../../components/garden/ErrorState";
import { LoadingState } from "../../components/garden/LoadingState";
import { useCallback, useMemo } from "react";
import type { ServerSettings } from "../../api/client";
import { useServerSettings } from "../../hooks/useServerSettings";
import {
  type SourceControlCleanLanding,
  useSourceControlCleanLanding,
} from "../../hooks/useSourceControlCleanLanding";
import { useVersion } from "../../hooks/useVersion";
import { useI18n } from "../../i18n";
import { SettingsItem } from "./SettingsItem";
import { useSettingsPaneTitle } from "./SettingsPaneTitleContext";
import { SettingsSection } from "./SettingsSection";
import { useSettingsUndoBaseline } from "./SettingsUndoContext";

export function SourceControlSettings() {
  const { t } = useI18n();
  useSettingsPaneTitle(t("sourceControlSettingsTitle"));
  const { version, refetch: refetchVersion } = useVersion();
  const liveWorktreeSettingSupported = serverHasCapability(
    version,
    GIT_LIVE_WORKTREE_SETTING_CAPABILITY,
  );
  const { settings, isLoading, error, updateSettings } = useServerSettings();
  const reviewsEnabled = settings?.sourceReviewSubmissionsEnabled ?? false;
  const liveWorktreeMonitoringEnabled =
    settings?.liveWorktreeMonitoringEnabled ?? false;
  const { sourceControlCleanLanding, setSourceControlCleanLanding } =
    useSourceControlCleanLanding();

  const undoState = useMemo(
    () =>
      settings
        ? {
            sourceControlCleanLanding,
            sourceReviewSubmissionsEnabled: reviewsEnabled,
            ...(liveWorktreeSettingSupported
              ? { liveWorktreeMonitoringEnabled }
              : {}),
          }
        : null,
    [
      liveWorktreeMonitoringEnabled,
      liveWorktreeSettingSupported,
      reviewsEnabled,
      settings,
      sourceControlCleanLanding,
    ],
  );
  const restoreUndoState = useCallback(
    (snapshot: NonNullable<typeof undoState>) => {
      setSourceControlCleanLanding(snapshot.sourceControlCleanLanding);
      const updates: Partial<ServerSettings> = {
        sourceReviewSubmissionsEnabled: snapshot.sourceReviewSubmissionsEnabled,
      };
      if ("liveWorktreeMonitoringEnabled" in snapshot) {
        updates.liveWorktreeMonitoringEnabled =
          snapshot.liveWorktreeMonitoringEnabled;
      }
      void updateSettings(updates)
        .then(() => refetchVersion())
        .catch(() => {
          // The hook keeps the actionable error visible in this pane.
        });
    },
    [refetchVersion, setSourceControlCleanLanding, updateSettings],
  );
  useSettingsUndoBaseline(undoState, restoreUndoState);

  if (isLoading) {
    return (
      <LoadingState
        label={t("sourceControlSettingsLoading")}
        variant="compact"
      />
    );
  }

  return (
    <SettingsSection description={t("sourceControlSettingsDescription")}>
      <SettingsSection title={t("sourceControlSectionChanges")} scope="local">
        <div className="settings-group">
          <SettingsItem
            className="settings-item--wide-control"
            label={t("sourceControlCleanLandingTitle")}
            description={t("sourceControlCleanLandingDescription")}
            valueText={
              sourceControlCleanLanding === "latest-commit"
                ? t("sourceControlCleanLandingLatestCommit")
                : t("sourceControlCleanLandingWorkingTree")
            }
          >
            <select
              className="settings-select"
              aria-label={t("sourceControlCleanLandingTitle")}
              value={sourceControlCleanLanding}
              onChange={(event) =>
                setSourceControlCleanLanding(
                  event.target.value as SourceControlCleanLanding,
                )
              }
            >
              <option value="working-tree">
                {t("sourceControlCleanLandingWorkingTree")}
              </option>
              <option value="latest-commit">
                {t("sourceControlCleanLandingLatestCommit")}
              </option>
            </select>
          </SettingsItem>
        </div>
      </SettingsSection>
      <SettingsSection title={t("sourceControlSectionReview")} scope="server">
        <div className="settings-group">
          <SettingsItem
            as="label"
            label={t("sourceReviewSubmissionsSettingTitle")}
            description={t("sourceReviewSubmissionsSettingDescription")}
            valueText={reviewsEnabled ? t("commonOn") : t("commonOff")}
          >
            <span className="toggle-switch">
              <input
                type="checkbox"
                aria-label={t("sourceReviewSubmissionsSettingTitle")}
                checked={reviewsEnabled}
                onChange={(event) => {
                  void updateSettings({
                    sourceReviewSubmissionsEnabled: event.target.checked,
                  }).catch(() => {
                    // The hook keeps the actionable error visible in this pane.
                  });
                }}
              />
              <span className="toggle-slider" />
            </span>
          </SettingsItem>
        </div>
      </SettingsSection>
      {liveWorktreeSettingSupported && (
        <SettingsSection
          title={t("sourceControlSectionAdvanced")}
          scope="server"
        >
          <div className="settings-group">
            <SettingsItem
              as="label"
              label={t("liveWorktreeMonitoringSettingTitle")}
              description={t("liveWorktreeMonitoringSettingDescription")}
              valueText={
                liveWorktreeMonitoringEnabled ? t("commonOn") : t("commonOff")
              }
            >
              <span className="toggle-switch">
                <input
                  type="checkbox"
                  aria-label={t("liveWorktreeMonitoringSettingTitle")}
                  checked={liveWorktreeMonitoringEnabled}
                  onChange={(event) => {
                    void updateSettings({
                      liveWorktreeMonitoringEnabled: event.target.checked,
                    })
                      .then(() => refetchVersion())
                      .catch(() => {
                        // The hook keeps the actionable error visible in this pane.
                      });
                  }}
                />
                <span className="toggle-slider" />
              </span>
            </SettingsItem>
          </div>
        </SettingsSection>
      )}
      {error && <ErrorState inline message={error} />}
    </SettingsSection>
  );
}
