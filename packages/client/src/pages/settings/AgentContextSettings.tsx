import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Tag } from "../../components/garden/Badge";
import { LoadingState } from "../../components/garden/LoadingState";
import { ScopeTag } from "../../components/garden/ScopeTag";
import {
  DEFAULT_HEARTBEAT_TURN_TEXT,
  DEFAULT_HEARTBEAT_TURNS_AFTER_MINUTES,
} from "@vibeallday/shared";
import { useServerSettings } from "../../hooks/useServerSettings";
import { useI18n } from "../../i18n";
import { AgentContextAdvanced } from "./AgentContextSettings.advanced";
import styles from "./AgentContextSettings.module.css";
import { EffectiveContextPreview } from "./AgentContextSettings.preview";
import { SettingsItem } from "./SettingsItem";
import { useSettingsPaneTitle } from "./SettingsPaneTitleContext";
import { HideInSettingsSearch } from "./SettingsSearchContext";
import { SettingsSection } from "./SettingsSection";
import { useSettingsUndoBaseline } from "./SettingsUndoContext";

const MAX_LENGTH = 10000;
const EDITOR_ROWS = 16;
const DEFAULT_HEARTBEAT_TEXT = DEFAULT_HEARTBEAT_TURN_TEXT;
const DEFAULT_HEARTBEAT_AFTER_MINUTES = DEFAULT_HEARTBEAT_TURNS_AFTER_MINUTES;

function parseHeartbeatMinutes(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 1
    ? Math.min(parsed, 1440)
    : DEFAULT_HEARTBEAT_AFTER_MINUTES;
}

export function AgentContextSettings() {
  const { t } = useI18n();
  useSettingsPaneTitle(t("agentContextTitle"));
  const { settings, isLoading, error, updateSettings } = useServerSettings();
  const [instructions, setInstructions] = useState("");
  const [heartbeatTurnsAfterMinutes, setHeartbeatTurnsAfterMinutes] = useState(
    String(DEFAULT_HEARTBEAT_AFTER_MINUTES),
  );
  const [heartbeatTurnText, setHeartbeatTurnText] = useState(
    DEFAULT_HEARTBEAT_TEXT,
  );
  const [latexMathRendering, setLatexMathRendering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // True once the form mirrors loaded settings; gates the undo baseline so
  // it snapshots the open-time values, not the pre-load defaults.
  const [formSynced, setFormSynced] = useState(false);

  useEffect(() => {
    if (settings) {
      setInstructions(settings.globalInstructions ?? "");
      setHeartbeatTurnsAfterMinutes(
        String(
          settings.heartbeatTurnsAfterMinutes ??
            DEFAULT_HEARTBEAT_AFTER_MINUTES,
        ),
      );
      setHeartbeatTurnText(
        settings.heartbeatTurnText ?? DEFAULT_HEARTBEAT_TEXT,
      );
      setLatexMathRendering(
        settings.agentContextHints?.latexMathRendering ?? false,
      );
      setFormSynced(true);
    }
  }, [settings]);

  const serverInstructions = settings?.globalInstructions ?? "";
  const serverHeartbeatTurnsAfterMinutes =
    settings?.heartbeatTurnsAfterMinutes ?? DEFAULT_HEARTBEAT_AFTER_MINUTES;
  const serverHeartbeatTurnText =
    settings?.heartbeatTurnText ?? DEFAULT_HEARTBEAT_TEXT;
  const serverLatexMathRendering =
    settings?.agentContextHints?.latexMathRendering ?? false;
  // The preview trails typing; keystroke echo never waits on its render.
  const deferredInstructions = useDeferredValue(instructions);

  // Header undo covers shown form values (saved or not), back to open-time.
  const undoState = useMemo(
    () =>
      formSynced
        ? {
            instructions,
            heartbeatTurnsAfterMinutes,
            heartbeatTurnText,
            latexMathRendering,
          }
        : null,
    [
      formSynced,
      instructions,
      heartbeatTurnsAfterMinutes,
      heartbeatTurnText,
      latexMathRendering,
    ],
  );
  const restoreUndoState = useCallback(
    (snapshot: NonNullable<typeof undoState>) => {
      setInstructions(snapshot.instructions);
      setHeartbeatTurnsAfterMinutes(snapshot.heartbeatTurnsAfterMinutes);
      setHeartbeatTurnText(snapshot.heartbeatTurnText);
      setLatexMathRendering(snapshot.latexMathRendering);
      setHasChanges(false);
      setSaveError(null);
      void updateSettings({
        globalInstructions: snapshot.instructions.trim() || undefined,
        heartbeatTurnsAfterMinutes: parseHeartbeatMinutes(
          snapshot.heartbeatTurnsAfterMinutes,
        ),
        heartbeatTurnText:
          snapshot.heartbeatTurnText.trim() || DEFAULT_HEARTBEAT_TEXT,
        agentContextHints: {
          latexMathRendering: snapshot.latexMathRendering,
        },
      }).catch(() => {
        // surfaced via the hook's error state
      });
    },
    [updateSettings],
  );
  useSettingsUndoBaseline(undoState, restoreUndoState);

  const recomputeHasChanges = useCallback(
    (next: {
      instructions?: string;
      heartbeatTurnsAfterMinutes?: string;
      heartbeatTurnText?: string;
      latexMathRendering?: boolean;
    }) => {
      const nextInstructions = next.instructions ?? instructions;
      const nextHeartbeatTurnsAfterMinutes =
        next.heartbeatTurnsAfterMinutes ?? heartbeatTurnsAfterMinutes;
      const nextHeartbeatTurnText = next.heartbeatTurnText ?? heartbeatTurnText;
      const nextLatexMathRendering =
        next.latexMathRendering ?? latexMathRendering;
      setHasChanges(
        nextInstructions !== serverInstructions ||
          nextHeartbeatTurnsAfterMinutes !==
            String(serverHeartbeatTurnsAfterMinutes) ||
          nextHeartbeatTurnText !== serverHeartbeatTurnText ||
          nextLatexMathRendering !== serverLatexMathRendering,
      );
    },
    [
      heartbeatTurnText,
      heartbeatTurnsAfterMinutes,
      instructions,
      latexMathRendering,
      serverHeartbeatTurnText,
      serverHeartbeatTurnsAfterMinutes,
      serverInstructions,
      serverLatexMathRendering,
    ],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await updateSettings({
        globalInstructions: instructions.trim() || undefined,
        heartbeatTurnsAfterMinutes: parseHeartbeatMinutes(
          heartbeatTurnsAfterMinutes,
        ),
        heartbeatTurnText: heartbeatTurnText.trim() || DEFAULT_HEARTBEAT_TEXT,
        agentContextHints: { latexMathRendering },
      });
      setHasChanges(false);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : t("agentContextSaveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    heartbeatTurnText,
    heartbeatTurnsAfterMinutes,
    instructions,
    latexMathRendering,
    t,
    updateSettings,
  ]);

  if (isLoading) {
    return <LoadingState label={t("agentContextLoading")} variant="compact" />;
  }

  const clearError = () => setSaveError(null);
  const instructionsModified = instructions !== serverInstructions;

  return (
    <SettingsSection
      description={t("agentContextDescription")}
      scope="server"
      onSubmit={(event) => {
        event.preventDefault();
        if (hasChanges && !isSaving) void handleSave();
      }}
      keywords={[
        t("agentContextGlobalInstructions"),
        t("agentContextGlobalInstructionsDescription"),
        t("agentContextSuggestedLatexTitle"),
        t("agentContextSuggestedLatexDescription"),
        t("agentContextHeartbeatAfterTitle"),
        t("agentContextHeartbeatAfterDescription"),
        t("agentContextHeartbeatTextTitle"),
        t("agentContextHeartbeatTextDescription"),
      ]}
    >
      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          <SettingsItem
            label={t("agentContextGlobalInstructions")}
            description={t("agentContextGlobalInstructionsDescription")}
            layout="custom"
            className={styles.editorCard}
          >
            <div className={styles.editorHead}>
              <strong id="agent-context-instructions-title">
                {t("agentContextGlobalInstructions")}
              </strong>
              <ScopeTag scope="server" />
              {instructionsModified && (
                <Tag tone="attn">{t("settingsAgentContextModified")}</Tag>
              )}
            </div>
            <p className={styles.editorDescription}>
              {t("agentContextGlobalInstructionsDescription")}
            </p>
            <textarea
              className={`settings-textarea ${styles.editor}`}
              aria-labelledby="agent-context-instructions-title"
              value={instructions}
              onChange={(e) => {
                const value = e.target.value.slice(0, MAX_LENGTH);
                setInstructions(value);
                recomputeHasChanges({ instructions: value });
                clearError();
              }}
              placeholder={t("agentContextPlaceholder")}
              rows={EDITOR_ROWS}
              spellCheck={false}
            />
            <CharacterMeter count={instructions.length} max={MAX_LENGTH} />
          </SettingsItem>

          <AgentContextAdvanced
            latexMathRendering={latexMathRendering}
            onLatexChange={(next) => {
              setLatexMathRendering(next);
              recomputeHasChanges({ latexMathRendering: next });
              clearError();
            }}
            heartbeatMinutes={heartbeatTurnsAfterMinutes}
            onHeartbeatMinutesChange={(next) => {
              setHeartbeatTurnsAfterMinutes(next);
              recomputeHasChanges({ heartbeatTurnsAfterMinutes: next });
              clearError();
            }}
            heartbeatText={heartbeatTurnText}
            onHeartbeatTextChange={(next) => {
              setHeartbeatTurnText(next);
              recomputeHasChanges({ heartbeatTurnText: next });
              clearError();
            }}
            heartbeatPlaceholder={DEFAULT_HEARTBEAT_TEXT}
          />
        </div>

        <HideInSettingsSearch>
          <EffectiveContextPreview
            instructions={deferredInstructions}
            savedInstructions={serverInstructions}
            latexMathRendering={latexMathRendering}
          />
        </HideInSettingsSearch>
      </div>

      <HideInSettingsSearch>
        {(saveError || error) && (
          <p className="settings-warning">{saveError || error}</p>
        )}
      </HideInSettingsSearch>
      {/* Stays in search results too: a matched editor row must stay savable. */}
      <div
        className={styles.saveBar}
        role="region"
        aria-label={t("settingsAgentContextSaveBar")}
      >
        <span
          className={hasChanges ? styles.dirtyDot : styles.cleanDot}
          aria-hidden="true"
        />
        <span className={styles.saveStatus}>
          {hasChanges
            ? t("settingsAgentContextUnsavedChanges")
            : t("settingsAgentContextNoChanges")}
        </span>
        <button
          type="submit"
          className="settings-button settings-button-primary"
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? t("providersSaving") : t("providersSave")}
        </button>
      </div>
    </SettingsSection>
  );
}

function CharacterMeter({ count, max }: { count: number; max: number }) {
  const { t } = useI18n();
  const label = t("agentContextCharacters", {
    current: count.toLocaleString(),
    max: max.toLocaleString(),
  });
  const percent = max > 0 ? Math.min(100, (count / max) * 100) : 0;
  return (
    <div className={styles.editorFoot}>
      <span className={styles.meter} role="img" aria-label={label}>
        <span style={{ width: `${percent}%` }} />
      </span>
      <span className="settings-hint">{label}</span>
    </div>
  );
}
