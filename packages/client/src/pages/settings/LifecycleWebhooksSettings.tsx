import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Status, Tag } from "../../components/garden";
import { LoadingState } from "../../components/garden/LoadingState";
import { useServerSettings } from "../../hooks/useServerSettings";
import { useI18n } from "../../i18n";
import { SettingsItem } from "./SettingsItem";
import styles from "./LifecycleWebhooksSettings.module.css";
import { useSettingsPaneTitle } from "./SettingsPaneTitleContext";
import { HideInSettingsSearch } from "./SettingsSearchContext";
import { SettingsSection } from "./SettingsSection";
import { useSettingsUndoBaseline } from "./SettingsUndoContext";

const MAX_URL_LENGTH = 2000;
const MAX_TOKEN_LENGTH = 5000;

export function LifecycleWebhooksSettings() {
  const { t } = useI18n();
  useSettingsPaneTitle(t("lifecycleWebhooksTitle"));
  const { settings, isLoading, error, updateSettings } = useServerSettings();
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasDraftEdits, setHasDraftEdits] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // True once the form mirrors loaded settings; gates the undo baseline so
  // it snapshots the open-time values, not the pre-load defaults.
  const [formSynced, setFormSynced] = useState(false);

  const serverEnabled = settings?.lifecycleWebhooksEnabled ?? false;
  const serverUrl = settings?.lifecycleWebhookUrl ?? "";
  const serverToken = settings?.lifecycleWebhookToken ?? "";
  const serverDryRun = settings?.lifecycleWebhookDryRun ?? true;
  const normalizedUrl = url.trim();
  const normalizedToken = token.trim();
  const hasChanges =
    enabled !== serverEnabled ||
    normalizedUrl !== serverUrl ||
    normalizedToken !== serverToken ||
    dryRun !== serverDryRun;

  useEffect(() => {
    if (!settings) return;
    if (hasDraftEdits || isSaving) return;
    setEnabled(serverEnabled);
    setUrl(serverUrl);
    setToken(serverToken);
    setDryRun(serverDryRun);
    setFormSynced(true);
  }, [
    hasDraftEdits,
    isSaving,
    serverDryRun,
    serverEnabled,
    serverToken,
    serverUrl,
    settings,
  ]);

  // Header undo covers shown form values (saved or not), back to open-time.
  const undoState = useMemo(
    () => (formSynced ? { enabled, url, token, dryRun } : null),
    [formSynced, enabled, url, token, dryRun],
  );
  const restoreUndoState = useCallback(
    (snapshot: NonNullable<typeof undoState>) => {
      setEnabled(snapshot.enabled);
      setUrl(snapshot.url);
      setToken(snapshot.token);
      setDryRun(snapshot.dryRun);
      setHasDraftEdits(false);
      setSaveError(null);
      void updateSettings({
        lifecycleWebhooksEnabled: snapshot.enabled,
        lifecycleWebhookUrl: snapshot.url.trim() || undefined,
        lifecycleWebhookToken: snapshot.token.trim() || undefined,
        lifecycleWebhookDryRun: snapshot.dryRun,
      }).catch(() => {
        // surfaced via the hook's error state
      });
    },
    [updateSettings],
  );
  useSettingsUndoBaseline(undoState, restoreUndoState);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await updateSettings({
        lifecycleWebhooksEnabled: enabled,
        lifecycleWebhookUrl: normalizedUrl || undefined,
        lifecycleWebhookToken: normalizedToken || undefined,
        lifecycleWebhookDryRun: dryRun,
      });
      setEnabled(enabled);
      setUrl(normalizedUrl);
      setToken(normalizedToken);
      setDryRun(dryRun);
      setHasDraftEdits(false);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : t("lifecycleWebhooksSaveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  }, [dryRun, enabled, normalizedToken, normalizedUrl, t, updateSettings]);

  if (isLoading) {
    return (
      <LoadingState label={t("lifecycleWebhooksLoading")} variant="compact" />
    );
  }

  const fieldChanged = (apply: () => void) => {
    apply();
    setHasDraftEdits(true);
    setSaveError(null);
  };

  return (
    <SettingsSection
      description={t("lifecycleWebhooksDescription")}
      scope="server"
      onSubmit={(event) => {
        event.preventDefault();
        if (hasChanges && !isSaving) void handleSave();
      }}
      keywords={[
        t("lifecycleWebhooksEnableTitle"),
        t("lifecycleWebhooksEnableDescription"),
        t("lifecycleWebhooksUrlTitle"),
        t("lifecycleWebhooksUrlDescription"),
        t("lifecycleWebhooksTokenTitle"),
        t("lifecycleWebhooksTokenDescription"),
        t("lifecycleWebhooksDryRunTitle"),
        t("lifecycleWebhooksDryRunDescription"),
      ]}
    >
      <div className="settings-group">
        <SettingsItem
          label={t("lifecycleWebhooksEnableTitle")}
          description={t("lifecycleWebhooksEnableDescription")}
          valueText={t(enabled ? "commonOn" : "commonOff")}
        >
          <label className="toggle-switch">
            <input
              type="checkbox"
              aria-label={t("lifecycleWebhooksEnableTitle")}
              checked={enabled}
              onChange={(e) => fieldChanged(() => setEnabled(e.target.checked))}
            />
            <span className="toggle-slider" />
          </label>
        </SettingsItem>
      </div>

      <SettingsSection title={t("lifecycleWebhooksEndpointTitle")}>
        <div className="settings-group">
          <HideInSettingsSearch>
            <WebhookEndpointSummary
              url={normalizedUrl}
              hasToken={normalizedToken !== ""}
              dryRun={dryRun}
              delivering={serverEnabled && serverUrl !== ""}
            />
          </HideInSettingsSearch>
          <SettingsItem
            label={t("lifecycleWebhooksUrlTitle")}
            description={t("lifecycleWebhooksUrlDescription")}
            valueText={normalizedUrl || undefined}
            className={styles.fieldRow}
          >
            <input
              aria-label={t("lifecycleWebhooksUrlTitle")}
              autoComplete="off"
              type="url"
              className={`settings-input ${styles.monoInput}`}
              id="lifecycle-webhook-url"
              name="vibeallday-lifecycle-webhook-url"
              value={url}
              onChange={(e) =>
                fieldChanged(() =>
                  setUrl(e.target.value.slice(0, MAX_URL_LENGTH)),
                )
              }
              placeholder="https://example.com/hooks/vibeallday"
              spellCheck={false}
            />
          </SettingsItem>

          <SettingsItem
            label={t("lifecycleWebhooksTokenTitle")}
            description={t("lifecycleWebhooksTokenDescription")}
            className={styles.fieldRow}
          >
            <input
              aria-label={t("lifecycleWebhooksTokenTitle")}
              autoComplete="new-password"
              type="password"
              className={`settings-input ${styles.monoInput}`}
              id="lifecycle-webhook-token"
              name="vibeallday-lifecycle-webhook-token"
              value={token}
              onChange={(e) =>
                fieldChanged(() =>
                  setToken(e.target.value.slice(0, MAX_TOKEN_LENGTH)),
                )
              }
              placeholder={t("lifecycleWebhooksTokenPlaceholder")}
              spellCheck={false}
            />
          </SettingsItem>

          <SettingsItem
            label={t("lifecycleWebhooksDryRunTitle")}
            description={t("lifecycleWebhooksDryRunDescription")}
            valueText={t(dryRun ? "commonOn" : "commonOff")}
          >
            <label className="toggle-switch">
              <input
                type="checkbox"
                aria-label={t("lifecycleWebhooksDryRunTitle")}
                checked={dryRun}
                onChange={(e) =>
                  fieldChanged(() => setDryRun(e.target.checked))
                }
              />
              <span className="toggle-slider" />
            </label>
          </SettingsItem>

          <div className={styles.footer}>
            {hasChanges && (
              <span className={styles.unsaved}>
                {t("lifecycleWebhooksUnsaved")}
              </span>
            )}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? t("providersSaving") : t("providersSave")}
            </Button>
          </div>
        </div>
      </SettingsSection>

      {(saveError || error) && (
        <p className="settings-warning">{saveError || error}</p>
      )}
    </SettingsSection>
  );
}

/** Lifecycle event the service sends (LifecycleWebhookService). */
const LIFECYCLE_EVENT_TYPE = "session-inactive";

/** Endpoint header: address, event and option tags, and delivery state. */
function WebhookEndpointSummary({
  url,
  hasToken,
  dryRun,
  delivering,
}: {
  url: string;
  hasToken: boolean;
  dryRun: boolean;
  delivering: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.endpoint}>
      <div className={styles.endpointText}>
        <span className={url ? styles.endpointUrl : styles.endpointEmpty}>
          {url || t("lifecycleWebhooksNoEndpoint")}
        </span>
        <span className={styles.endpointTags}>
          <Tag>{LIFECYCLE_EVENT_TYPE}</Tag>
          {dryRun && <Tag tone="accent">{t("lifecycleWebhooksDryRunTag")}</Tag>}
          {hasToken && <Tag>Bearer</Tag>}
        </span>
      </div>
      <Status state={delivering ? "ok" : "idle"}>
        {t(
          delivering
            ? "lifecycleWebhooksStatusActive"
            : "lifecycleWebhooksStatusPaused",
        )}
      </Status>
    </div>
  );
}
