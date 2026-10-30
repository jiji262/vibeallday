import { useCallback, useMemo, useState } from "react";
import { ErrorState } from "../../components/garden/ErrorState";
import { EmptyState } from "../../components/garden/EmptyState";
import { LoadingState } from "../../components/garden/LoadingState";
import type { RemoteExecutorTestResult } from "../../api/client";
import type { MessageKey } from "../../i18n";
import { useRemoteExecutors } from "../../hooks/useRemoteExecutors";
import { useI18n } from "../../i18n";
import { ExecutorCard } from "./RemoteExecutorsSettings.card";
import styles from "./RemoteExecutorsSettings.module.css";
import { SettingsItem } from "./SettingsItem";
import { useSettingsPaneTitle } from "./SettingsPaneTitleContext";
import { HideInSettingsSearch } from "./SettingsSearchContext";
import { SettingsSection } from "./SettingsSection";
import { useSettingsUndoBaseline } from "./SettingsUndoContext";

const REQUIREMENT_KEYS = [
  "remoteExecutorsRequirementSshConfig",
  "remoteExecutorsRequirementKeyAuth",
  "remoteExecutorsRequirementClaude",
  "remoteExecutorsRequirementPaths",
] as const satisfies readonly MessageKey[];

interface ExecutorStatus {
  testing: boolean;
  result?: RemoteExecutorTestResult;
}

export function RemoteExecutorsSettings() {
  const { t } = useI18n();
  useSettingsPaneTitle(t("remoteExecutorsTitle"));
  const {
    executors,
    loading,
    addExecutor,
    removeExecutor,
    replaceExecutors,
    testExecutor,
  } = useRemoteExecutors();

  const [newHost, setNewHost] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [executorStatus, setExecutorStatus] = useState<
    Record<string, ExecutorStatus>
  >({});

  // Header undo reconciles the executor list back to the open-time set
  // (removes hosts added since, re-adds hosts removed since). Re-added hosts
  // may land at the end of the list rather than their original position.
  const undoState = useMemo(
    () => (loading ? null : { executors }),
    [loading, executors],
  );
  const restoreUndoState = useCallback(
    async (snapshot: NonNullable<typeof undoState>) => {
      await replaceExecutors(snapshot.executors);
      setAddError(null);
    },
    [replaceExecutors],
  );
  useSettingsUndoBaseline(undoState, restoreUndoState);

  const handleAddExecutor = async () => {
    if (!newHost.trim() || isAdding) return;

    setIsAdding(true);
    setAddError(null);

    try {
      await addExecutor(newHost.trim());
      setNewHost("");
    } catch (err) {
      setAddError(
        err instanceof Error ? err.message : t("remoteExecutorsAddFailed"),
      );
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveExecutor = async (host: string) => {
    try {
      await removeExecutor(host);
      // Clear status for removed executor
      setExecutorStatus((prev) => {
        const { [host]: _, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      console.error("Failed to remove executor:", err);
    }
  };

  const handleTestExecutor = async (host: string) => {
    setExecutorStatus((prev) => ({
      ...prev,
      [host]: { testing: true },
    }));

    try {
      const result = await testExecutor(host);
      setExecutorStatus((prev) => ({
        ...prev,
        [host]: { testing: false, result },
      }));
    } catch (err) {
      setExecutorStatus((prev) => ({
        ...prev,
        [host]: {
          testing: false,
          result: {
            success: false,
            error:
              err instanceof Error
                ? err.message
                : t("remoteExecutorsConnectionFailed"),
          },
        },
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddExecutor();
    }
  };

  return (
    <SettingsSection
      description={t("remoteExecutorsDescription")}
      scope="server"
    >
      {/* Add new executor */}
      <div className="settings-group">
        <SettingsItem
          label={t("remoteExecutorsAddTitle")}
          description={t("remoteExecutorsAddDescription")}
          className={styles.addItem}
        >
          <div className={styles.addRow}>
            <input
              type="text"
              value={newHost}
              onChange={(e) => setNewHost(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("remoteExecutorsHostPlaceholder")}
              disabled={isAdding}
              className={styles.input}
            />
            <button
              type="button"
              onClick={handleAddExecutor}
              disabled={!newHost.trim() || isAdding}
              className={styles.addButton}
            >
              {isAdding ? t("remoteExecutorsAdding") : t("remoteExecutorsAdd")}
            </button>
          </div>
          {addError && <ErrorState inline message={addError} />}
        </SettingsItem>
      </div>

      {/* Executor list */}
      <HideInSettingsSearch>
        <div className="settings-group">
          <h3>{t("remoteExecutorsConfigured")}</h3>
          {loading ? (
            <LoadingState label={t("loginLoading")} variant="compact" />
          ) : executors.length === 0 ? (
            <EmptyState compact title={t("remoteExecutorsEmpty")} />
          ) : (
            <div className={styles.list}>
              {executors.map((host) => (
                <ExecutorCard
                  key={host}
                  host={host}
                  testing={executorStatus[host]?.testing === true}
                  result={executorStatus[host]?.result}
                  onTest={() => void handleTestExecutor(host)}
                  onRemove={() => void handleRemoveExecutor(host)}
                />
              ))}
            </div>
          )}
        </div>
      </HideInSettingsSearch>

      {/* Setup checklist: open until a host exists, then folded. */}
      <HideInSettingsSearch>
        <details
          className={`settings-group ${styles.requirementsFold}`}
          open={!loading && executors.length === 0}
        >
          <summary className={styles.requirementsSummary}>
            <span>{t("remoteExecutorsSetupRequirements")}</span>
            <span className={styles.requirementsCount}>
              {t("settingsRemoteExecutorRequirementsCount", {
                count: REQUIREMENT_KEYS.length,
              })}
            </span>
          </summary>
          <ul className={styles.requirements}>
            {REQUIREMENT_KEYS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </details>
      </HideInSettingsSearch>
    </SettingsSection>
  );
}
