import { AgentAuthRouterSettings } from "../../components/AgentAuthRouterControls";
import { Link, useParams } from "react-router-dom";
import { useRemoteBasePath } from "../../hooks/useRemoteBasePath";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SERVER_CAPABILITIES,
  CLAUDE_ADDITIONAL_MODELS_CAPABILITY,
  CLAUDE_GATEWAY_AUTOSTART_CAPABILITY,
  CLAUDE_GATEWAY_CAPABILITY,
  CLAUDE_GATEWAY_DISABLE_AGENT_CAPABILITY,
  CLAUDE_GATEWAY_DISABLE_PLAN_MODE_CAPABILITY,
  CLAUDE_GATEWAY_SERVICES_CAPABILITY,
  CODEX_CYBER_ACCESS_PROGRAM_SETTING_CAPABILITY,
  CODEX_PLAN_TOOL_SETTING_CAPABILITY,
  CODEX_REASONING_SUMMARIES,
  CODEX_REASONING_SUMMARY_SETTING_CAPABILITY,
  DEFAULT_CODEX_REASONING_SUMMARY,
  MAX_CLAUDE_ADDITIONAL_MODEL_ID_LENGTH,
  isCodexReasoningSummary,
  isCodexPlanToolMode,
  isCodexCyberAccessProgram,
  isValidClaudeAdditionalModelId,
  isValidClaudeAdditionalModelLabel,
  type ClaudeAdditionalModelSelection,
  type CodexCyberAccessProgram,
  type CodexPlanToolMode,
  type CodexReasoningSummary,
  type HelperTargetConfig,
  type ModelInfo,
  type ProviderInfo,
  type ServerCapabilitySource,
  serverHasCapability,
} from "@vibeallday/shared";
import { api, type ServerSettings } from "../../api/client";
import { Modal, type ModalAnchorRect } from "../../components/ui/Modal";
import { useToastContext } from "../../contexts/ToastContext";
import { useCodexUpdateStatus } from "../../hooks/useCodexUpdateStatus";
import { useProviders } from "../../hooks/useProviders";
import { useServerSettings } from "../../hooks/useServerSettings";
import { GatewayServicesSettings } from "./GatewayServicesSettings";
import { useVersion } from "../../hooks/useVersion";
import { useI18n } from "../../i18n";
import { ProviderSignIn } from "./ProviderSignIn";
import { VibeAllDayCompactContextEarlyControl } from "./compactSettingsControls";
import { SettingsItem } from "./SettingsItem";
import styles from "./ProvidersSettings.module.css";
import { useSettingsDetailCrumb } from "./SettingsPane";
import { useSettingsPaneTitle } from "./SettingsPaneTitleContext";
import {
  HideInSettingsSearch,
  useSettingsSearchScope,
} from "./SettingsSearchContext";
import { LoadingState, Notice } from "../../components/garden";
import { ProviderDetailHeader } from "./ProviderDetailHeader";
import { ProvidersOverview } from "./ProvidersSettings.overview";
import {
  AUTH_ROUTER_ITEM_ID,
  GATEWAY_SERVICES_ITEM_ID,
  buildProviderDisplayList,
  type ProviderDisplayEntry,
  providerIsAuthenticated,
} from "./ProvidersSettings.data";
import { SettingsSection } from "./SettingsSection";
import { getProviderSessionDefaults } from "../../lib/newSessionDefaults";
import {
  helperTargetDescription,
  helperTargetValue,
} from "../../lib/helperTargets";

const DEFAULT_OLLAMA_SYSTEM_PROMPT =
  "You are a helpful coding assistant. You help users with software engineering tasks. You have access to tools for reading files, editing files, running shell commands, and searching code. Use tools when needed to answer questions or make changes. Be concise and direct.";
const DEFAULT_CLAUDE_LOGIN_COMMAND = "claude auth login --claudeai";
const DEFAULT_CODEX_LOGIN_COMMAND = "codex login";
const CLAUDE_OLLAMA_DEPRECATION_DISMISSAL_KEY =
  "vibeallday:claude-ollama-deprecation-v1";
// Re-enable with topics/openai-compatible-helper-sessions.md.
const SHOW_HELPER_TARGETS_SETTINGS = false;

function shouldShowClaudeOllamaDeprecation(): boolean {
  try {
    return (
      window.localStorage.getItem(CLAUDE_OLLAMA_DEPRECATION_DISMISSAL_KEY) !==
      "dismissed"
    );
  } catch {
    return true;
  }
}

function rememberClaudeOllamaDeprecationDismissal(): void {
  try {
    window.localStorage.setItem(
      CLAUDE_OLLAMA_DEPRECATION_DISMISSAL_KEY,
      "dismissed",
    );
  } catch {
    // The notice still stays dismissed for this mounted settings pane.
  }
}

interface HelperTargetDraft {
  id?: string;
  name: string;
  baseUrl: string;
  model: string;
}

type UpdateServerSetting = <K extends keyof ServerSettings>(
  key: K,
  value: ServerSettings[K],
) => Promise<void>;

interface HelperTargetsSettingsProps {
  settings: ServerSettings | null;
  updateSetting: UpdateServerSetting;
}

const DEFAULT_HELPER_TARGET_DRAFT: HelperTargetDraft = {
  name: "Local vLLM",
  baseUrl: "http://localhost:8001/v1",
  model: "",
};

function createHelperTargetId(
  name: string,
  targets: readonly HelperTargetConfig[],
): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "helper-target";
  const existingIds = new Set(targets.map((target) => target.id));
  if (!existingIds.has(base)) return base;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!existingIds.has(candidate)) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}

function draftFromTarget(target: HelperTargetConfig): HelperTargetDraft {
  return {
    id: target.id,
    name: target.name,
    baseUrl: target.baseUrl,
    model: target.model ?? "",
  };
}

function targetFromDraft(
  draft: HelperTargetDraft,
  targets: readonly HelperTargetConfig[],
): HelperTargetConfig {
  const name = draft.name.trim();
  const model = draft.model.trim();
  return {
    id: draft.id ?? createHelperTargetId(name, targets),
    name,
    kind: "openai-compatible",
    baseUrl: draft.baseUrl.trim(),
    ...(model ? { model } : {}),
  };
}

function mergeModelOptions(
  selectedModel: string,
  discoveredModels: readonly ModelInfo[],
): ModelInfo[] {
  if (
    selectedModel &&
    !discoveredModels.some((model) => model.id === selectedModel)
  ) {
    return [{ id: selectedModel, name: selectedModel }, ...discoveredModels];
  }
  return [...discoveredModels];
}

function HelperTargetsSettings({
  settings,
  updateSetting,
}: HelperTargetsSettingsProps) {
  const { t } = useI18n();
  const targets = settings?.helperTargets ?? [];
  const [draft, setDraft] = useState<HelperTargetDraft>(
    DEFAULT_HELPER_TARGET_DRAFT,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<ModelInfo[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const modelFieldId = useId();

  const resetDraft = useCallback(() => {
    setDraft(DEFAULT_HELPER_TARGET_DRAFT);
    setEditingId(null);
    setDiscoveredModels([]);
    setMessage(null);
    setError(null);
  }, []);

  const beginEdit = useCallback((target: HelperTargetConfig) => {
    setDraft(draftFromTarget(target));
    setEditingId(target.id);
    setDiscoveredModels(
      target.model ? [{ id: target.model, name: target.model }] : [],
    );
    setMessage(null);
    setError(null);
  }, []);

  const deleteTarget = useCallback(
    async (targetId: string) => {
      setIsSaving(true);
      setError(null);
      try {
        await updateSetting(
          "helperTargets",
          targets.filter((target) => target.id !== targetId),
        );
        if (editingId === targetId) {
          resetDraft();
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("helperTargetsSaveError"),
        );
      } finally {
        setIsSaving(false);
      }
    },
    [editingId, resetDraft, t, targets, updateSetting],
  );

  const discoverModels = useCallback(async () => {
    setIsDiscovering(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.discoverHelperTargetModels(draft.baseUrl);
      setDraft((prev) => ({ ...prev, baseUrl: result.baseUrl }));
      setDiscoveredModels(result.models);
      setMessage(
        t("helperTargetsDiscovered", {
          count: String(result.models.length),
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("helperTargetsLoadError"),
      );
    } finally {
      setIsDiscovering(false);
    }
  }, [draft.baseUrl, t]);

  const saveTarget = useCallback(async () => {
    if (!draft.name.trim() || !draft.baseUrl.trim()) {
      setError(t("helperTargetsInvalid"));
      return;
    }

    const nextTarget = targetFromDraft(draft, targets);
    const nextTargets = editingId
      ? targets.map((target) => (target.id === editingId ? nextTarget : target))
      : [...targets, nextTarget];

    setIsSaving(true);
    setError(null);
    try {
      await updateSetting("helperTargets", nextTargets);
      resetDraft();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("helperTargetsSaveError"),
      );
    } finally {
      setIsSaving(false);
    }
  }, [draft, editingId, resetDraft, t, targets, updateSetting]);

  const modelOptions = mergeModelOptions(draft.model, discoveredModels);

  return (
    <SettingsItem
      label={t("helperTargetsTitle")}
      as="form"
      containerProps={{
        onSubmit: (event) => {
          event.preventDefault();
          if (!isSaving) void saveTarget();
        },
      }}
      description={t("helperTargetsDescription")}
      className="helper-targets-settings"
      info={
        <>
          <strong>{t("helperTargetsTitle")}</strong>
          <p>{t("helperTargetsDescription")}</p>
          <p className="settings-hint">{t("helperTargetsRuntimeNote")}</p>
        </>
      }
    >
      <HideInSettingsSearch>
        <div className="helper-targets-panel">
          {targets.length === 0 ? (
            <p className="settings-hint">{t("helperTargetsEmpty")}</p>
          ) : (
            <div className="helper-target-list">
              {targets.map((target) => (
                <div key={target.id} className="helper-target-row">
                  <div className="helper-target-row-main">
                    <strong>{target.name}</strong>
                    <span>{helperTargetDescription(target)}</span>
                    <code>
                      {t("helperTargetsIdPrefix")} {helperTargetValue(target)}
                    </code>
                  </div>
                  <div className="helper-target-row-actions">
                    <button
                      type="button"
                      className="settings-button settings-button-secondary"
                      onClick={() => beginEdit(target)}
                      disabled={isSaving}
                    >
                      {t("helperTargetsEdit")}
                    </button>
                    <button
                      type="button"
                      className="settings-button settings-button-secondary"
                      onClick={() => void deleteTarget(target.id)}
                      disabled={isSaving}
                    >
                      {t("helperTargetsDelete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="helper-target-editor">
            <label>
              <span>{t("helperTargetsNameLabel")}</span>
              <input
                type="text"
                className="settings-input"
                value={draft.name}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </label>
            <label>
              <span>{t("helperTargetsBaseUrlLabel")}</span>
              <input
                type="text"
                className="settings-input"
                value={draft.baseUrl}
                placeholder={t("helperTargetsBaseUrlPlaceholder")}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, baseUrl: event.target.value }))
                }
              />
            </label>
            <label htmlFor={modelFieldId}>
              <span>{t("helperTargetsModelLabel")}</span>
              {modelOptions.length > 0 ? (
                <select
                  id={modelFieldId}
                  className="settings-select"
                  value={draft.model}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      model: event.target.value,
                    }))
                  }
                >
                  <option value="">{t("helperTargetsModelDefault")}</option>
                  {modelOptions.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={modelFieldId}
                  type="text"
                  className="settings-input"
                  value={draft.model}
                  placeholder={t("helperTargetsModelPlaceholder")}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      model: event.target.value,
                    }))
                  }
                />
              )}
            </label>
          </div>

          <div className="helper-target-actions">
            <button
              type="button"
              className="settings-button settings-button-secondary"
              onClick={() => void discoverModels()}
              disabled={isDiscovering || !draft.baseUrl.trim()}
            >
              {isDiscovering
                ? t("helperTargetsDiscovering")
                : t("helperTargetsDiscover")}
            </button>
            {editingId && (
              <button
                type="button"
                className="settings-button settings-button-secondary"
                onClick={resetDraft}
                disabled={isSaving}
              >
                {t("helperTargetsCancelEdit")}
              </button>
            )}
            <button
              type="submit"
              className="settings-button settings-button-primary"
              disabled={isSaving}
            >
              {isSaving
                ? t("providersSaving")
                : editingId
                  ? t("helperTargetsSave")
                  : t("helperTargetsAdd")}
            </button>
          </div>

          {message && <p className="settings-hint">{message}</p>}
          {error && <p className="settings-warning">{error}</p>}
        </div>
      </HideInSettingsSearch>
    </SettingsItem>
  );
}

function OllamaUrlInput() {
  const { t } = useI18n();
  const { settings, updateSetting } = useServerSettings();
  const [url, setUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const serverValue = settings?.ollamaUrl ?? "";

  useEffect(() => {
    if (settings) {
      setUrl(settings.ollamaUrl ?? "");
    }
  }, [settings]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSetting("ollamaUrl", url.trim() || undefined);
      setHasChanges(false);
    } catch {
      // Error handled by useServerSettings
    } finally {
      setIsSaving(false);
    }
  }, [url, updateSetting]);

  return (
    <form
      style={{ marginTop: "var(--space-2)", width: "100%" }}
      onSubmit={(event) => {
        event.preventDefault();
        if (hasChanges && !isSaving) void handleSave();
      }}
    >
      <div
        style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}
      >
        <input
          type="text"
          className="settings-input"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setHasChanges(e.target.value !== serverValue);
          }}
          placeholder="http://localhost:11434"
          style={{ flex: 1 }}
        />
        <button
          type="submit"
          className="settings-button settings-button-primary"
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? t("providersSaving") : t("providersSave")}
        </button>
      </div>
      <span className="settings-hint">{t("providersOllamaUrlHint")}</span>
    </form>
  );
}

function OllamaUseFullSystemPrompt() {
  const { t } = useI18n();
  const { settings, updateSetting } = useServerSettings();
  const enabled = settings?.ollamaUseFullSystemPrompt ?? false;

  return (
    <label
      style={{
        display: "flex",
        gap: "var(--space-2)",
        alignItems: "center",
        marginTop: "var(--space-2)",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) =>
          updateSetting("ollamaUseFullSystemPrompt", e.target.checked)
        }
      />
      <span>{t("providersUseFullPrompt")}</span>
      <span className="settings-hint" style={{ marginLeft: "auto" }}>
        {t("providersUseFullPromptHint")}
      </span>
    </label>
  );
}

function OllamaSystemPromptInput() {
  const { t } = useI18n();
  const { settings, updateSetting } = useServerSettings();
  const [prompt, setPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const serverValue = settings?.ollamaSystemPrompt ?? "";

  useEffect(() => {
    if (settings) {
      setPrompt(settings.ollamaSystemPrompt ?? "");
    }
  }, [settings]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSetting("ollamaSystemPrompt", prompt.trim() || undefined);
      setHasChanges(false);
    } catch {
      // Error handled by useServerSettings
    } finally {
      setIsSaving(false);
    }
  }, [prompt, updateSetting]);

  return (
    <div style={{ marginTop: "var(--space-2)", width: "100%" }}>
      <textarea
        className="settings-textarea"
        value={prompt}
        onChange={(e) => {
          setPrompt(e.target.value);
          setHasChanges(e.target.value !== serverValue);
        }}
        placeholder={DEFAULT_OLLAMA_SYSTEM_PROMPT}
        rows={4}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "var(--space-2)",
        }}
      >
        <span className="settings-hint">{t("providersOllamaPromptHint")}</span>
        <button
          type="button"
          className="settings-button"
          disabled={!hasChanges || isSaving}
          onClick={handleSave}
        >
          {isSaving ? t("providersSaving") : t("providersSave")}
        </button>
      </div>
    </div>
  );
}

function GrokBuildApiKeySettings() {
  const { t } = useI18n();
  const { settings, updateSetting } = useServerSettings();
  const enabled = settings?.grokBuildUseXaiApiKey ?? false;

  return (
    <label
      style={{
        display: "flex",
        gap: "var(--space-2)",
        alignItems: "flex-start",
        marginTop: "var(--space-2)",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={(event) =>
          updateSetting("grokBuildUseXaiApiKey", event.target.checked)
        }
        style={{ marginTop: "0.2rem" }}
      />
      <span>
        <span>{t("providersGrokUseXaiApiKey")}</span>
        <span className="settings-hint" style={{ display: "block" }}>
          {t("providersGrokUseXaiApiKeyHint")}
        </span>
      </span>
    </label>
  );
}

function CodexUpdatePanel() {
  const { t } = useI18n();
  const { showToast } = useToastContext();
  const { settings, updateSetting } = useServerSettings();
  const {
    status,
    isChecking,
    isInstalling,
    error,
    installOutput,
    refresh,
    install,
  } = useCodexUpdateStatus();

  const policy = settings?.codexUpdatePolicy ?? "notify";
  const canAuto = status?.updateMethod === "npm";

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        showToast(t("providersCodexUpdateCommandCopied"), "success");
      } catch {
        showToast(t("providersCodexUpdateCopyFailed"), "error");
      }
    },
    [showToast, t],
  );

  if (!status?.installed || !status.latest) {
    return null;
  }

  const updateAvailable = status.updateAvailable;

  return (
    <div style={{ marginTop: "var(--space-2)", width: "100%" }}>
      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {updateAvailable ? (
          <span>
            <strong>{t("providersCodexUpdateAvailable")}</strong>{" "}
            {status.installed} → {status.latest}
          </span>
        ) : (
          <span className="settings-hint">
            {t("providersCodexUpdateUpToDate", {
              version: status.installed,
            })}
          </span>
        )}
        <button
          type="button"
          className="settings-button"
          onClick={() => void refresh(true)}
          disabled={isChecking}
        >
          {isChecking
            ? t("providersCodexUpdateChecking")
            : t("providersCodexUpdateCheckNow")}
        </button>
        {status.releaseUrl && updateAvailable && (
          <a
            href={status.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="settings-link"
          >
            {t("providersCodexUpdateReleaseNotes")}
          </a>
        )}
        {/* A div rather than a fieldset: a <legend> is laid out in the border
            area whatever the fieldset's display is, so it always took a line of
            its own above radios that fit beside it. */}
        <div
          role="radiogroup"
          aria-label={t("providersCodexUpdatePolicyTitle")}
          style={{
            display: "flex",
            gap: "var(--space-3)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span className="settings-hint">
            {t("providersCodexUpdatePolicyTitle")}
          </span>
          {(["auto", "notify", "off"] as const).map((value) => {
            const disabled = value === "auto" && !canAuto;
            return (
              <label
                key={value}
                style={{
                  display: "inline-flex",
                  gap: 4,
                  alignItems: "center",
                  opacity: disabled ? 0.55 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
                title={
                  disabled
                    ? t("providersCodexUpdatePolicyAutoUnavailable")
                    : undefined
                }
              >
                <input
                  type="radio"
                  name="codex-update-policy"
                  value={value}
                  checked={policy === value}
                  disabled={disabled}
                  onChange={() =>
                    void updateSetting("codexUpdatePolicy", value)
                  }
                />
                <span>
                  {value === "auto"
                    ? t("commonAuto")
                    : value === "notify"
                      ? t("providersCodexUpdatePolicyNotify")
                      : t("commonOff")}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {updateAvailable && (
        <div
          style={{
            display: "flex",
            gap: "var(--space-2)",
            alignItems: "center",
            marginTop: "var(--space-2)",
            flexWrap: "wrap",
          }}
        >
          {status.updateMethod === "npm" ? (
            <button
              type="button"
              className="settings-button"
              onClick={() => void install()}
              disabled={isInstalling}
            >
              {isInstalling
                ? t("providersCodexUpdateInstalling")
                : t("providersCodexUpdateNow")}
            </button>
          ) : status.manualInstallCommand ? (
            <span className="settings-hint">
              {t("providersCodexUpdateWithInstaller")}
            </span>
          ) : null}
          {status.manualInstallCommand ? (
            <>
              <code
                style={{
                  padding: "2px 6px",
                  background: "var(--color-surface-raised, #f5f5f5)",
                  borderRadius: 4,
                  fontSize: "0.85em",
                }}
              >
                {status.manualInstallCommand}
              </code>
              <button
                type="button"
                className="settings-button"
                onClick={() => void copy(status.manualInstallCommand ?? "")}
              >
                {t("remoteSetupCopy")}
              </button>
            </>
          ) : status.updateMethod === "manual" ? (
            <span className="settings-hint">
              {t("providersCodexUpdateManualInstallHint")}
            </span>
          ) : null}
        </div>
      )}

      {error && (
        <p className="settings-hint" style={{ color: "var(--color-error)" }}>
          {error}
        </p>
      )}
      {installOutput && (
        <details style={{ marginTop: "var(--space-2)" }}>
          <summary className="settings-hint">
            {t("providersCodexUpdateInstallOutput")}
          </summary>
          <pre
            style={{
              fontSize: "0.8em",
              whiteSpace: "pre-wrap",
              maxHeight: 200,
              overflow: "auto",
            }}
          >
            {installOutput}
          </pre>
        </details>
      )}
    </div>
  );
}

function CodexReasoningSummarySetting({
  value,
  updateSetting,
}: {
  value: CodexReasoningSummary;
  updateSetting: UpdateServerSetting;
}) {
  const { t } = useI18n();
  const labels: Record<CodexReasoningSummary, string> = {
    auto: t("providersCodexReasoningSummaryAutomatic"),
    concise: t("providersCodexReasoningSummaryConcise"),
    detailed: t("providersCodexReasoningSummaryDetailed"),
    none: t("providersCodexReasoningSummaryOff"),
  };

  return (
    <SettingsItem
      id="provider-codex-reasoning-summary"
      label={t("providersCodexReasoningSummaryTitle")}
      description={t("providersCodexReasoningSummaryDescription")}
      keywords={[
        "model_reasoning_summary",
        "reasoning summary",
        "auto",
        "concise",
        "detailed",
        "none",
        "off",
      ]}
      valueText={labels[value]}
    >
      <select
        className="settings-select"
        aria-label={t("providersCodexReasoningSummaryAria")}
        value={value}
        onChange={(event) => {
          if (isCodexReasoningSummary(event.target.value)) {
            void updateSetting("codexReasoningSummary", event.target.value);
          }
        }}
      >
        {CODEX_REASONING_SUMMARIES.map((summary) => (
          <option key={summary} value={summary}>
            {labels[summary]}
          </option>
        ))}
      </select>
    </SettingsItem>
  );
}

type CodexPlanToolSelection = CodexPlanToolMode | "inherit";

function CodexPlanToolSetting({
  value,
  updateSetting,
}: {
  value: CodexPlanToolMode | undefined;
  updateSetting: UpdateServerSetting;
}) {
  const { t } = useI18n();
  const selection: CodexPlanToolSelection = value ?? "inherit";
  const labels: Record<CodexPlanToolSelection, string> = {
    inherit: t("providersCodexPlanToolInherit"),
    "provider-default": t("providersCodexPlanToolProviderDefault"),
    enabled: t("providersCodexPlanToolEnabled"),
    disabled: t("providersCodexPlanToolDisabled"),
  };

  return (
    <SettingsItem
      id="provider-codex-plan-tool"
      label={t("providersCodexPlanToolTitle")}
      description={t("providersCodexPlanToolDescription")}
      keywords={["update_plan", "plan", "checklist", "tasks", "todo"]}
      valueText={labels[selection]}
    >
      <select
        className="settings-select"
        aria-label={t("providersCodexPlanToolAria")}
        value={selection}
        onChange={(event) => {
          if (event.target.value === "inherit") {
            void updateSetting("codexPlanToolMode", null);
          } else if (isCodexPlanToolMode(event.target.value)) {
            void updateSetting("codexPlanToolMode", event.target.value);
          }
        }}
      >
        {(Object.keys(labels) as CodexPlanToolSelection[]).map((mode) => (
          <option key={mode} value={mode}>
            {labels[mode]}
          </option>
        ))}
      </select>
    </SettingsItem>
  );
}

type CodexCyberAccessSelection = CodexCyberAccessProgram | "inherit";

function CodexCyberAccessProgramSetting({
  value,
  updateSetting,
}: {
  value: CodexCyberAccessProgram | undefined;
  updateSetting: UpdateServerSetting;
}) {
  const { t } = useI18n();
  const selection: CodexCyberAccessSelection = value ?? "inherit";
  const labels: Record<CodexCyberAccessSelection, string> = {
    inherit: t("providersCodexCyberAccessInherit"),
    "provider-default": t("providersCodexCyberAccessProviderDefault"),
    standard: t("providersCodexCyberAccessStandard"),
    "daybreak-blue": t("providersCodexCyberAccessDaybreakBlue"),
    "daybreak-red": t("providersCodexCyberAccessDaybreakRed"),
  };

  return (
    <SettingsItem
      id="provider-codex-cyber-access"
      label={t("providersCodexCyberAccessTitle")}
      description={t("providersCodexCyberAccessDescription")}
      keywords={["daybreak", "cyber", "security", "access", "program"]}
      valueText={labels[selection]}
    >
      <select
        className="settings-select"
        aria-label={t("providersCodexCyberAccessAria")}
        value={selection}
        onChange={(event) => {
          if (event.target.value === "inherit") {
            void updateSetting("codexCyberAccessProgram", null);
          } else if (isCodexCyberAccessProgram(event.target.value)) {
            void updateSetting("codexCyberAccessProgram", event.target.value);
          }
        }}
      >
        {(Object.keys(labels) as CodexCyberAccessSelection[]).map((program) => (
          <option key={program} value={program}>
            {labels[program]}
          </option>
        ))}
      </select>
    </SettingsItem>
  );
}

function OllamaSettings() {
  const { settings } = useServerSettings();
  const useFullPrompt = settings?.ollamaUseFullSystemPrompt ?? false;

  return (
    <>
      <OllamaUrlInput />
      <OllamaUseFullSystemPrompt />
      {!useFullPrompt && <OllamaSystemPromptInput />}
    </>
  );
}

function ClaudeGatewaySettings({
  reloadProviders,
  supportsAutostart,
}: {
  reloadProviders: () => Promise<void>;
  supportsAutostart: boolean;
}) {
  const exampleUrl = "http://localhost:4141";
  const { t } = useI18n();
  const { settings, updateSetting, updateSettings } = useServerSettings();
  const [url, setUrl] = useState("");
  const [startCommand, setStartCommand] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const serverValue = settings?.claudeGatewayUrl ?? "";
  const serverStartCommand = settings?.claudeGatewayStartCommand ?? "";
  const hasChanges =
    url.trim() !== serverValue ||
    (supportsAutostart && startCommand.trim() !== serverStartCommand);

  useEffect(() => {
    setUrl(settings?.claudeGatewayUrl ?? "");
  }, [settings?.claudeGatewayUrl]);

  useEffect(() => {
    setStartCommand(settings?.claudeGatewayStartCommand ?? "");
  }, [settings?.claudeGatewayStartCommand]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      if (supportsAutostart) {
        await updateSettings({
          claudeGatewayUrl: url.trim() || undefined,
          claudeGatewayStartCommand: startCommand.trim() || undefined,
        });
      } else {
        await updateSetting("claudeGatewayUrl", url.trim() || undefined);
      }
      await reloadProviders();
    } catch {
      // Error handled by useServerSettings.
    } finally {
      setIsSaving(false);
    }
  }, [
    reloadProviders,
    startCommand,
    supportsAutostart,
    updateSetting,
    updateSettings,
    url,
  ]);

  return (
    <div
      id="provider-claude-gateway-configuration"
      className="settings-subsection"
    >
      <h3>{t("providersClaudeGatewayTitle")}</h3>
      <p className="settings-hint">{t("providersClaudeGatewayDescription")}</p>
      <form
        className="claude-gateway-settings-control"
        onSubmit={(event) => {
          event.preventDefault();
          if (hasChanges && !isSaving) void handleSave();
        }}
      >
        <div className="claude-gateway-settings-row">
          <input
            type="url"
            className="settings-input"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onFocus={() => {
              if (!url.trim()) setUrl(exampleUrl);
            }}
            placeholder={exampleUrl}
            aria-label={t("providersClaudeGatewayUrlAria")}
          />
          <button
            type="submit"
            className="settings-button settings-button-primary"
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? t("providersSaving") : t("providersSave")}
          </button>
        </div>
        {supportsAutostart && (
          <>
            <label className="claude-gateway-start-command">
              <span>{t("providersClaudeGatewayStartCommandLabel")}</span>
              <input
                type="text"
                className="settings-input"
                value={startCommand}
                maxLength={10_000}
                onChange={(event) => setStartCommand(event.target.value)}
                placeholder={t("providersClaudeGatewayStartCommandPlaceholder")}
                aria-label={t("providersClaudeGatewayStartCommandAria")}
              />
            </label>
            <p className="settings-hint">
              {t("providersClaudeGatewayStartCommandHint")}
            </p>
          </>
        )}
        <p className="settings-hint">
          {t("providersClaudeGatewayIsolationHint")}
        </p>
      </form>
    </div>
  );
}

type ClaudeGatewayToggleSettingProps = {
  id: string;
  setting: "claudeGatewayDisableAgent" | "claudeGatewayDisablePlanMode";
  title: string;
  description: string;
};

function ClaudeGatewayToggleSetting({
  id,
  setting,
  title,
  description,
}: ClaudeGatewayToggleSettingProps) {
  const { settings, updateSetting } = useServerSettings();
  const enabled = settings?.[setting] ?? true;

  return (
    <div id={id} className="settings-subsection">
      <label>
        <input
          type="checkbox"
          checked={enabled}
          aria-label={title}
          onChange={(event) =>
            void updateSetting(setting, event.target.checked)
          }
        />{" "}
        <strong>{title}</strong>
      </label>
      <p className="settings-hint">{description}</p>
    </div>
  );
}

function ProviderLoginCommandPanel({
  command,
  provider,
  onCopy,
}: {
  command: string;
  provider: string;
  onCopy: (command: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="settings-command-panel">
      <div
        className="settings-command-preview"
        role="group"
        aria-label={t("providersLoginCommandPreviewAria", { provider })}
      >
        <code>{command}</code>
      </div>
      <button
        type="button"
        className="settings-button"
        onClick={() => onCopy(command)}
      >
        {t("providersLoginCommandCopy", { provider })}
      </button>
    </div>
  );
}

function ClaudeVibeAllDayCompactEarlyMirror({
  serverProviders,
  settings,
  updateSetting,
}: {
  serverProviders: ProviderInfo[];
  settings: ServerSettings | null;
  updateSetting: UpdateServerSetting;
}) {
  const { t } = useI18n();
  const claudeProvider = serverProviders.find((p) => p.name === "claude");
  const claudeDefaults = getProviderSessionDefaults(
    settings?.newSessionDefaults,
    "claude",
  );
  const claudeModelId =
    typeof claudeDefaults.model === "string" &&
    claudeDefaults.model !== "default"
      ? claudeDefaults.model
      : claudeProvider?.models?.[0]?.id;
  if (!claudeModelId || claudeModelId === "default") {
    return null;
  }
  const modelInfo = claudeProvider?.models?.find((m) => m.id === claudeModelId);
  const stored =
    settings?.clientDefaults?.compactAtContextPercent?.[claudeModelId] ?? 0;
  return (
    <VibeAllDayCompactContextEarlyControl
      id="provider-vibeallday-compact-early"
      modelId={claudeModelId}
      contextWindow={modelInfo?.contextWindow}
      storedPercent={stored}
      map={settings?.clientDefaults?.compactAtContextPercent}
      updateSetting={updateSetting}
      description={t("providersVibeAllDayCompactEarlyMirrorDescription", {
        model: modelInfo?.name ?? claudeModelId,
      })}
      searchable={false}
    />
  );
}

interface ClaudeAdditionalModelsSettingsProps {
  modelOptions: readonly ModelInfo[];
  selections: readonly ClaudeAdditionalModelSelection[];
  updateSetting: UpdateServerSetting;
  reloadProviders: () => Promise<void>;
}

function ClaudeAdditionalModelsSettings({
  modelOptions,
  selections,
  updateSetting,
  reloadProviders,
}: ClaudeAdditionalModelsSettingsProps) {
  const { t } = useI18n();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<ModalAnchorRect | null>(null);
  const [customId, setCustomId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = useMemo(
    () => new Set(selections.map((selection) => selection.id)),
    [selections],
  );
  const choices = useMemo(() => {
    const maintainedIds = new Set(modelOptions.map((model) => model.id));
    return [
      ...modelOptions,
      ...selections
        .filter((selection) => !maintainedIds.has(selection.id))
        .map(
          (selection): ModelInfo => ({
            id: selection.id,
            name: selection.label,
            description:
              selection.origin === "registry"
                ? t("providersAdditionalModelsUnlistedDescription")
                : t("providersAdditionalModelsCustomDescription"),
            catalogGroup: "additional",
          }),
        ),
    ];
  }, [modelOptions, selections, t]);

  const summary =
    selections.length === 0
      ? t("providersAdditionalModelsNone")
      : selections.length === 1
        ? t("providersAdditionalModelsOne")
        : t("providersAdditionalModelsMany", {
            count: String(selections.length),
          });

  const saveSelections = useCallback(
    async (nextSelections: ClaudeAdditionalModelSelection[]) => {
      setIsSaving(true);
      setError(null);
      try {
        await updateSetting("claudeAdditionalModels", nextSelections);
        await reloadProviders();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("providersAdditionalModelsSaveError"),
        );
      } finally {
        setIsSaving(false);
      }
    },
    [reloadProviders, t, updateSetting],
  );

  const toggleModel = useCallback(
    (model: ModelInfo) => {
      const nextSelections = selectedIds.has(model.id)
        ? selections.filter((selection) => selection.id !== model.id)
        : [
            ...selections,
            {
              id: model.id,
              label: model.name,
              origin: "registry" as const,
            },
          ];
      void saveSelections(nextSelections);
    },
    [saveSelections, selectedIds, selections],
  );

  const addCustomModel = useCallback(() => {
    const id = customId.trim();
    if (!isValidClaudeAdditionalModelId(id)) {
      setError(t("providersAdditionalModelsInvalidId"));
      return;
    }
    if (selectedIds.has(id)) {
      setError(t("providersAdditionalModelsDuplicateId"));
      return;
    }

    const maintained = modelOptions.find((model) => model.id === id);
    // A custom entry stores label = id, so the id must also satisfy the label
    // bounds the server enforces; a registry match carries the maintained name.
    if (!maintained && !isValidClaudeAdditionalModelLabel(id)) {
      setError(t("providersAdditionalModelsInvalidId"));
      return;
    }
    const nextSelection: ClaudeAdditionalModelSelection = maintained
      ? {
          id,
          label: maintained.name,
          origin: "registry",
        }
      : {
          id,
          label: id,
          origin: "custom",
        };
    setCustomId("");
    void saveSelections([...selections, nextSelection]);
  }, [customId, modelOptions, saveSelections, selectedIds, selections, t]);

  const openEditor = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    setAnchorRect(
      rect
        ? {
            bottom: rect.bottom,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            width: rect.width,
          }
        : null,
    );
    setError(null);
    setOpen(true);
  }, []);

  return (
    <>
      <SettingsItem
        id="provider-claude-additional-models"
        label={t("providersAdditionalModelsTitle")}
        description={t("providersAdditionalModelsDescription")}
        valueText={summary}
        className="providers-additional-models-setting"
      >
        <button
          ref={triggerRef}
          type="button"
          className="settings-button settings-button-secondary providers-additional-models-trigger"
          onClick={openEditor}
          aria-haspopup="dialog"
        >
          <span>{summary}</span>
          <span aria-hidden="true">▾</span>
        </button>
      </SettingsItem>
      {open && (
        <Modal
          title={t("providersAdditionalModelsTitle")}
          onClose={() => setOpen(false)}
          anchorRect={anchorRect}
        >
          <div className="providers-additional-models-editor">
            <p className="settings-hint">
              {t("providersAdditionalModelsEditorDescription")}
            </p>
            <div className="providers-additional-models-list">
              {choices.map((model) => (
                <label
                  key={model.id}
                  className="providers-additional-model-option"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(model.id)}
                    disabled={isSaving}
                    onChange={() => toggleModel(model)}
                  />
                  <span>
                    <strong>{model.name}</strong>
                    <code>{model.id}</code>
                    {model.description && (
                      <span className="settings-hint">{model.description}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <details className="providers-additional-models-custom">
              <summary>{t("providersAdditionalModelsCustomTitle")}</summary>
              <p className="settings-hint">
                {t("providersAdditionalModelsCustomHint")}
              </p>
              <div className="providers-additional-models-custom-row">
                <input
                  type="text"
                  className="settings-input"
                  value={customId}
                  maxLength={MAX_CLAUDE_ADDITIONAL_MODEL_ID_LENGTH}
                  placeholder={t("providersAdditionalModelsCustomPlaceholder")}
                  aria-label={t("providersAdditionalModelsCustomInputAria")}
                  onChange={(event) => setCustomId(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCustomModel();
                    }
                  }}
                />
                <button
                  type="button"
                  className="settings-button"
                  disabled={isSaving || !customId.trim()}
                  onClick={addCustomModel}
                >
                  {t("providersAdditionalModelsAdd")}
                </button>
              </div>
            </details>
            {isSaving && (
              <p className="settings-hint">{t("providersSaving")}</p>
            )}
            {error && <p className="settings-warning">{error}</p>}
          </div>
        </Modal>
      )}
    </>
  );
}

type ProvidersQuery = ReturnType<typeof useProviders>;

interface ProviderSupportFlags {
  additionalModels: boolean;
  codexReasoningSummary: boolean;
  codexPlanTool: boolean;
  codexCyberAccess: boolean;
  claudeGateway: boolean;
  claudeGatewayAutostart: boolean;
  gatewayServices: boolean;
  gatewayDisableAgent: boolean;
  gatewayDisablePlanMode: boolean;
  authRouter: boolean;
}

/** Everything a provider's rows read, gathered once per pane mount. */
interface ProviderPaneState {
  settings: ServerSettings | null;
  updateSetting: UpdateServerSetting;
  serverProviders: ProviderInfo[];
  providersLoading: boolean;
  providersError: ProvidersQuery["error"];
  reloadProviders: () => Promise<void>;
  supports: ProviderSupportFlags;
  /** No server version yet, so every capability still reads as absent. */
  versionPending: boolean;
  providers: ProviderDisplayEntry[];
  showClaudeOllamaDeprecation: boolean;
  dismissClaudeOllamaDeprecation: () => void;
  copyLoginCommand: (command: string, provider: string) => Promise<void>;
}

function providerSupportFlags(
  version: ServerCapabilitySource | null | undefined,
): ProviderSupportFlags {
  const has = (capability: string) => serverHasCapability(version, capability);
  return {
    additionalModels: has(CLAUDE_ADDITIONAL_MODELS_CAPABILITY),
    codexReasoningSummary: has(CODEX_REASONING_SUMMARY_SETTING_CAPABILITY),
    codexPlanTool: has(CODEX_PLAN_TOOL_SETTING_CAPABILITY),
    codexCyberAccess: has(CODEX_CYBER_ACCESS_PROGRAM_SETTING_CAPABILITY),
    claudeGateway: has(CLAUDE_GATEWAY_CAPABILITY),
    claudeGatewayAutostart: has(CLAUDE_GATEWAY_AUTOSTART_CAPABILITY),
    gatewayServices: has(CLAUDE_GATEWAY_SERVICES_CAPABILITY),
    gatewayDisableAgent: has(CLAUDE_GATEWAY_DISABLE_AGENT_CAPABILITY),
    gatewayDisablePlanMode: has(CLAUDE_GATEWAY_DISABLE_PLAN_MODE_CAPABILITY),
    authRouter: has(SERVER_CAPABILITIES.agentAuthRouter.name),
  };
}

function useProviderPaneState(): ProviderPaneState {
  const { t } = useI18n();
  const { showToast } = useToastContext();
  const [showClaudeOllamaDeprecation, setShowClaudeOllamaDeprecation] =
    useState(shouldShowClaudeOllamaDeprecation);
  const query = useProviders();
  const { settings, updateSetting } = useServerSettings();
  const { version, loading: versionLoading } = useVersion();
  const supports = providerSupportFlags(version);
  const copyLoginCommand = useCallback(
    async (command: string, provider: string) => {
      try {
        await navigator.clipboard.writeText(command);
        showToast(t("providersLoginCommandCopied", { provider }), "success");
      } catch {
        showToast(t("providersLoginCommandCopyError", { provider }), "error");
      }
    },
    [showToast, t],
  );
  const dismissClaudeOllamaDeprecation = useCallback(() => {
    setShowClaudeOllamaDeprecation(false);
    rememberClaudeOllamaDeprecationDismissal();
  }, []);
  return {
    settings,
    updateSetting,
    serverProviders: query.providers,
    providersLoading: query.loading,
    providersError: query.error,
    reloadProviders: query.refetch,
    supports,
    versionPending: !version && versionLoading,
    providers: buildProviderDisplayList(
      query.providers,
      supports.claudeGateway,
    ),
    showClaudeOllamaDeprecation,
    dismissClaudeOllamaDeprecation,
    copyLoginCommand,
  };
}

interface ProviderRowProps {
  provider: ProviderDisplayEntry;
  pane: ProviderPaneState;
}

const GATEWAY_KEYWORDS = [
  "gateway URL",
  "start command",
  "autostart",
  "disable agent",
  "disable plan mode",
];

function ProviderRowAfter({ provider, pane }: ProviderRowProps) {
  const { t } = useI18n();
  const { supports } = pane;
  return (
    <>
      {provider.id === "claude-gateway" &&
        supports.claudeGateway &&
        supports.gatewayServices && (
          <GatewayServicesSettings reloadProviders={pane.reloadProviders} />
        )}
      {provider.id === "claude-ollama" && pane.showClaudeOllamaDeprecation ? (
        <div className="provider-deprecation-notice" role="status">
          <span>{t("providersClaudeOllamaDeprecationNotice")}</span>
          <button
            type="button"
            className="provider-deprecation-notice__dismiss"
            aria-label={t("providersClaudeOllamaDeprecationDismissAria")}
            onClick={pane.dismissClaudeOllamaDeprecation}
          >
            ×
          </button>
        </div>
      ) : undefined}
    </>
  );
}

function isClaudeOrCodex(id: string): id is "claude" | "codex" {
  return id === "claude" || id === "codex";
}

/** Runtime, desktop-application and authentication lines of a provider row. */
function ProviderStatusLines({ provider }: { provider: ProviderDisplayEntry }) {
  const { t } = useI18n();
  return (
    <>
      <div className="settings-item-header">
        <strong>{provider.displayName}</strong>
        {provider.installed ? (
          <span className="settings-status-badge settings-status-detected">
            {t("providersRuntimeReady")}
          </span>
        ) : (
          <span className="settings-status-badge settings-status-not-detected">
            {t("providersRuntimeUnavailable")}
          </span>
        )}
      </div>
      <p>{provider.metadata.description}</p>
      {isClaudeOrCodex(provider.id) &&
        provider.applicationDetected !== undefined && (
          <p className="settings-hint">
            {t("providersDesktopApplicationStatus", {
              status: provider.applicationDetected
                ? t("providersDetected")
                : t("providersNotDetected"),
            })}
          </p>
        )}
      {provider.installed && (
        <p className="settings-hint">
          {t("providersAuthenticationStatus", {
            status: providerIsAuthenticated(provider)
              ? t("providersAuthenticated")
              : t("providersNotAuthenticated"),
          })}
        </p>
      )}
      {provider.metadata.limitations.length > 0 && (
        <ul className="settings-limitations">
          {provider.metadata.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      )}
    </>
  );
}

function ProviderLoginHelp({ provider, pane }: ProviderRowProps) {
  const { t } = useI18n();
  if (!isClaudeOrCodex(provider.id)) return null;
  if (provider.installed && !provider.authenticated) {
    return (
      <div className={styles.loginHelp}>
        <p className="settings-hint">
          {t("providersLoginHint", { provider: provider.displayName })}
        </p>
        <ProviderLoginCommandPanel
          command={
            provider.loginCommand ??
            (provider.id === "claude"
              ? DEFAULT_CLAUDE_LOGIN_COMMAND
              : DEFAULT_CODEX_LOGIN_COMMAND)
          }
          provider={provider.displayName}
          onCopy={(command) =>
            void pane.copyLoginCommand(command, provider.displayName)
          }
        />
        {provider.supportsInAppLogin && (
          <ProviderSignIn
            provider={provider.id}
            displayName={provider.displayName}
            supportsHostTerminal={provider.supportsHostTerminalLogin}
            onSignedIn={pane.reloadProviders}
          />
        )}
      </div>
    );
  }
  if (provider.applicationDetected === true && !provider.installed) {
    return (
      <p className="settings-hint">
        {t("providersApplicationWithoutRuntimeHint", {
          provider: provider.displayName,
        })}
      </p>
    );
  }
  return null;
}

function ClaudeGatewayPanels({ pane }: { pane: ProviderPaneState }) {
  const { t } = useI18n();
  const { supports } = pane;
  if (!supports.claudeGateway) return null;
  return (
    <>
      {!supports.gatewayServices && (
        <ClaudeGatewaySettings
          reloadProviders={pane.reloadProviders}
          supportsAutostart={supports.claudeGatewayAutostart}
        />
      )}
      {supports.gatewayDisableAgent && (
        <ClaudeGatewayToggleSetting
          id="provider-claude-gateway-disable-agent"
          setting="claudeGatewayDisableAgent"
          title={t("providersClaudeGatewayDisableAgentTitle")}
          description={t("providersClaudeGatewayDisableAgentDescription")}
        />
      )}
      {supports.gatewayDisablePlanMode && (
        <ClaudeGatewayToggleSetting
          id="provider-claude-gateway-disable-plan-mode"
          setting="claudeGatewayDisablePlanMode"
          title={t("providersClaudeGatewayDisablePlanModeTitle")}
          description={t("providersClaudeGatewayDisablePlanModeDescription")}
        />
      )}
    </>
  );
}

function CodexRefreshPanel({ pane }: { pane: ProviderPaneState }) {
  const { t } = useI18n();
  return (
    <>
      <div className={styles.loginHelp}>
        <button
          type="button"
          className="settings-button"
          disabled={pane.providersLoading}
          onClick={() => void pane.reloadProviders()}
        >
          {pane.providersLoading
            ? t("providersModelsRefreshing")
            : t("providersModelsRefresh")}
        </button>
        {pane.providersError && (
          <p className="settings-hint" role="alert">
            {t("providersModelsRefreshFailed")}
          </p>
        )}
      </div>
      <CodexUpdatePanel />
    </>
  );
}

function ProviderRowInfo({ provider, pane }: ProviderRowProps) {
  return (
    <>
      <ProviderStatusLines provider={provider} />
      <ProviderLoginHelp provider={provider} pane={pane} />
      {provider.id === "claude-ollama" && <OllamaSettings />}
      {provider.id === "grok" && <GrokBuildApiKeySettings />}
      {provider.id === "claude-gateway" && <ClaudeGatewayPanels pane={pane} />}
      {provider.id === "codex" && provider.installed && (
        <CodexRefreshPanel pane={pane} />
      )}
    </>
  );
}

/** Codex- and Claude-only rows that follow the provider's own row. */
function ProviderExtraRows({ provider, pane }: ProviderRowProps) {
  const { settings, updateSetting, supports } = pane;
  if (provider.id === "codex") {
    return (
      <>
        {supports.codexReasoningSummary && (
          <CodexReasoningSummarySetting
            value={
              settings?.codexReasoningSummary ?? DEFAULT_CODEX_REASONING_SUMMARY
            }
            updateSetting={updateSetting}
          />
        )}
        {supports.codexPlanTool && (
          <CodexPlanToolSetting
            value={settings?.codexPlanToolMode ?? undefined}
            updateSetting={updateSetting}
          />
        )}
        {supports.codexCyberAccess && (
          <CodexCyberAccessProgramSetting
            value={settings?.codexCyberAccessProgram ?? undefined}
            updateSetting={updateSetting}
          />
        )}
      </>
    );
  }
  if (provider.id !== "claude") return null;
  return (
    <>
      <ClaudeVibeAllDayCompactEarlyMirror
        serverProviders={pane.serverProviders}
        settings={settings}
        updateSetting={updateSetting}
      />
      {supports.additionalModels && (
        <ClaudeAdditionalModelsSettings
          modelOptions={provider.additionalModelOptions ?? []}
          selections={settings?.claudeAdditionalModels ?? []}
          updateSetting={updateSetting}
          reloadProviders={pane.reloadProviders}
        />
      )}
    </>
  );
}

/** One provider's row plus its provider-only settings rows. */
function ProviderRows({ provider, pane }: ProviderRowProps) {
  const { t } = useI18n();
  return (
    <>
      <SettingsItem
        id={`provider-${provider.id}`}
        label={provider.displayName}
        description={provider.metadata.description}
        keywords={
          provider.id === "claude-gateway" ? GATEWAY_KEYWORDS : undefined
        }
        scope={null}
        after={<ProviderRowAfter provider={provider} pane={pane} />}
        info={<ProviderRowInfo provider={provider} pane={pane} />}
      >
        {provider.metadata.website && (
          <a
            href={provider.metadata.website}
            target="_blank"
            rel="noopener noreferrer"
            className="settings-link"
          >
            {t("providersWebsite")}
          </a>
        )}
      </SettingsItem>
      <ProviderExtraRows provider={provider} pane={pane} />
    </>
  );
}

function SignInShortcuts({ pane }: { pane: ProviderPaneState }) {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  return (
    <nav
      className={styles.signInShortcuts}
      aria-label={t("providerSignInShortcuts")}
    >
      {pane.serverProviders
        .filter(
          (provider) =>
            isClaudeOrCodex(provider.name) && provider.supportsInAppLogin,
        )
        .map((provider) => (
          <Link
            key={provider.name}
            to={`${basePath}/provider-sign-in/${provider.name}`}
          >
            {t("providersSignIn", { provider: provider.displayName })}
          </Link>
        ))}
    </nav>
  );
}

/**
 * Every provider's rows in one list. Settings search mounts this form, so
 * each row stays searchable and operable in place whichever page owns it.
 */
function ProvidersFullList({ pane }: { pane: ProviderPaneState }) {
  const { t } = useI18n();
  return (
    <SettingsSection
      description={t("providersSectionDescription")}
      scope="server"
    >
      <SignInShortcuts pane={pane} />
      {pane.supports.authRouter && (
        <div className={styles.authRouter}>
          <AgentAuthRouterSettings />
        </div>
      )}
      {SHOW_HELPER_TARGETS_SETTINGS && (
        <div className="settings-group">
          <HelperTargetsSettings
            settings={pane.settings}
            updateSetting={pane.updateSetting}
          />
        </div>
      )}
      <div className="settings-group">
        {pane.providers.map((provider) => (
          <ProviderRows key={provider.id} provider={provider} pane={pane} />
        ))}
      </div>
    </SettingsSection>
  );
}

function ProviderDetailBody({
  itemId,
  pane,
}: {
  itemId: string;
  pane: ProviderPaneState;
}) {
  const { supports } = pane;
  if (itemId === GATEWAY_SERVICES_ITEM_ID) {
    if (!supports.claudeGateway || !supports.gatewayServices) return null;
    return (
      <SettingsSection scope="server">
        <GatewayServicesSettings reloadProviders={pane.reloadProviders} />
      </SettingsSection>
    );
  }
  if (itemId === AUTH_ROUTER_ITEM_ID) {
    if (!supports.authRouter) return null;
    return (
      <div className={styles.authRouter}>
        <AgentAuthRouterSettings />
      </div>
    );
  }
  const provider = pane.providers.find((entry) => entry.id === itemId);
  if (!provider) return null;
  return (
    <>
      <ProviderDetailHeader provider={provider} />
      <SettingsSection scope="server">
        <div className="settings-group">
          <ProviderRows provider={provider} pane={pane} />
        </div>
      </SettingsSection>
    </>
  );
}

/** Label of a detail page, or null when this server does not have it. */
function useProviderDetailLabel(
  itemId: string | undefined,
  pane: ProviderPaneState,
): string | null {
  const { t } = useI18n();
  const { supports } = pane;
  if (!itemId) return null;
  if (itemId === GATEWAY_SERVICES_ITEM_ID) {
    const served = supports.claudeGateway && supports.gatewayServices;
    return served ? t("providersGatewayServicesTitle") : null;
  }
  if (itemId === AUTH_ROUTER_ITEM_ID) {
    return supports.authRouter ? t("routerTitle") : null;
  }
  return (
    pane.providers.find((entry) => entry.id === itemId)?.displayName ?? null
  );
}

function ProviderDetailPage({
  itemId,
  pane,
}: {
  itemId: string;
  pane: ProviderPaneState;
}) {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  const listPath = `${basePath}/settings/providers`;
  const label = useProviderDetailLabel(itemId, pane);
  useSettingsDetailCrumb({ label: label ?? itemId, backTo: listPath });
  if (label) return <ProviderDetailBody itemId={itemId} pane={pane} />;
  // Capabilities and server-reported providers are unknown until both
  // answers arrive; a direct load must not call the page missing meanwhile.
  const pending =
    pane.versionPending ||
    (pane.providersLoading && pane.serverProviders.length === 0);
  if (pending) return <LoadingState label={t("loading")} variant="compact" />;
  return (
    <Notice
      tone="warning"
      actions={<Link to={listPath}>{t("providersDetailBackToList")}</Link>}
    >
      {t("providersDetailNotFound")}
    </Notice>
  );
}

/**
 * Providers: an overview of provider cards at `/settings/providers`, one
 * provider's panels at `/settings/providers/:itemId`, and every row at once
 * inside settings search.
 */
export function ProvidersSettings() {
  const { t } = useI18n();
  useSettingsPaneTitle(t("providersSectionTitle"));
  const { itemId } = useParams<{ itemId?: string }>();
  const searchScope = useSettingsSearchScope();
  const pane = useProviderPaneState();
  if (searchScope) return <ProvidersFullList pane={pane} />;
  if (itemId) return <ProviderDetailPage itemId={itemId} pane={pane} />;
  return (
    <ProvidersOverview
      providers={pane.providers}
      loading={pane.providersLoading}
      onRecheck={pane.reloadProviders}
      showGatewayServices={
        pane.supports.claudeGateway && pane.supports.gatewayServices
      }
      showAuthRouter={pane.supports.authRouter}
    />
  );
}
