import {
  HOST_AGENT_PROCESS_OBSERVABILITY_CAPABILITY,
  serverHasCapability,
} from "@vibeallday/shared";
import { ErrorState } from "../../components/garden/ErrorState";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CommittedRangeInput } from "../../components/ui/CommittedRangeInput";
import { useSessionLoadingProgress } from "../../hooks/useSessionLoadingProgress";
import { useServerSettings } from "../../hooks/useServerSettings";
import {
  getLastSessionTranscriptBytes,
  getSessionTranscriptMemoryStats,
  DEFAULT_REVERSE_SEARCH_PAGES_PER_ATTEMPT,
  DEFAULT_SESSION_INITIAL_HISTORY_COMPACTIONS,
  MAX_REVERSE_SEARCH_PAGES_PER_ATTEMPT,
  MAX_SESSION_INITIAL_HISTORY_COMPACTIONS,
  TRANSCRIPT_CACHE_BUDGET_MB_STOPS,
  TRANSCRIPT_CACHE_TTL_HOUR_STOPS,
  TYPICAL_SESSION_TRANSCRIPT_BYTES,
  useSessionPerformanceSettings,
} from "../../hooks/useSessionPerformanceSettings";
import { useStableToolPreviewRendering } from "../../hooks/useStableToolPreviewRendering";
import { useLiveToolOutputEnabled } from "../../hooks/useLiveToolOutputEnabled";
import { useStreamingEnabled } from "../../hooks/useStreamingEnabled";
import {
  DEFAULT_SEARCH_CONCURRENCY,
  MAX_SEARCH_CONCURRENCY,
  useSearchConcurrency,
} from "../../hooks/useSearchConcurrency";
import { useVersion } from "../../hooks/useVersion";
import { useI18n } from "../../i18n";
import {
  ScopedRowTitle,
  ToggleSettingRow,
  PerformanceValueControl,
} from "./PerformanceSettings.controls";
import { SettingsItem } from "./SettingsItem";
import { useSettingsPaneTitle } from "./SettingsPaneTitleContext";
import { SettingsSection } from "./SettingsSection";
import { useSettingsUndoBaseline } from "./SettingsUndoContext";

function nearestStopIndex(stops: readonly number[], value: number): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  stops.forEach((stop, index) => {
    const distance = Math.abs(stop - value);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

const HOURS_PER_DAY = 24;

type Translate = ReturnType<typeof useI18n>["t"];

function formatTtl(hours: number, t: Translate): string {
  return hours < HOURS_PER_DAY
    ? t("performanceTranscriptCacheTtlHoursValue", { count: hours })
    : t("performanceTranscriptCacheTtlDaysValue", {
        count: Math.round(hours / HOURS_PER_DAY),
      });
}

function formatMemoryMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb < 10 ? mb.toFixed(1) : String(Math.round(mb));
}

export function PerformanceSettings() {
  const { t } = useI18n();
  useSettingsPaneTitle(t("performanceSectionTitle"));
  const { streamingEnabled, setStreamingEnabled } = useStreamingEnabled();
  const { liveToolOutputEnabled, setLiveToolOutputEnabled } =
    useLiveToolOutputEnabled();
  const { searchConcurrency, setSearchConcurrency } = useSearchConcurrency();
  const { sessionLoadingProgressEnabled, setSessionLoadingProgressEnabled } =
    useSessionLoadingProgress();
  const {
    sessionDomLingerEnabled,
    sessionActiveWindowTrimEnabled,
    sessionInitialHistoryCompactions,
    reverseSearchMaxPagesPerAttempt,
    sessionTranscriptCacheBudgetMb,
    sessionTranscriptCacheTtlHours,
    setSessionDomLingerEnabled,
    setSessionActiveWindowTrimEnabled,
    setSessionInitialHistoryCompactions,
    setReverseSearchMaxPagesPerAttempt,
    setSessionTranscriptCacheBudgetMb,
    setSessionTranscriptCacheTtlHours,
  } = useSessionPerformanceSettings();
  const { stableToolPreviewRendering, setStableToolPreviewRendering } =
    useStableToolPreviewRendering();
  const { version } = useVersion();
  const {
    settings: serverSettings,
    isLoading: serverSettingsLoading,
    error: serverSettingsError,
    updateSetting: updateServerSetting,
  } = useServerSettings();
  const hostProcessObservabilitySupported = serverHasCapability(
    version,
    HOST_AGENT_PROCESS_OBSERVABILITY_CAPABILITY,
  );
  const hostProcessObservabilityEnabled =
    serverSettings?.hostProcessObservabilityEnabled ?? true;
  const [savingHostProcessObservability, setSavingHostProcessObservability] =
    useState(false);

  const [historyDraftIndex, setHistoryDraftIndex] = useState<number | null>(
    null,
  );
  const [budgetDraftIndex, setBudgetDraftIndex] = useState<number | null>(null);
  const [ttlDraftIndex, setTtlDraftIndex] = useState<number | null>(null);
  const [reverseSearchPageLimitDraft, setReverseSearchPageLimitDraft] =
    useState(String(reverseSearchMaxPagesPerAttempt));

  useEffect(() => {
    setReverseSearchPageLimitDraft(String(reverseSearchMaxPagesPerAttempt));
  }, [reverseSearchMaxPagesPerAttempt]);

  const historyIndex =
    historyDraftIndex ??
    (sessionInitialHistoryCompactions === null
      ? MAX_SESSION_INITIAL_HISTORY_COMPACTIONS
      : sessionInitialHistoryCompactions - 1);
  const historyCompactions =
    historyIndex === MAX_SESSION_INITIAL_HISTORY_COMPACTIONS
      ? null
      : historyIndex + 1;
  const budgetIndex =
    budgetDraftIndex ??
    nearestStopIndex(
      TRANSCRIPT_CACHE_BUDGET_MB_STOPS,
      sessionTranscriptCacheBudgetMb,
    );
  const ttlIndex =
    ttlDraftIndex ??
    nearestStopIndex(
      TRANSCRIPT_CACHE_TTL_HOUR_STOPS,
      sessionTranscriptCacheTtlHours,
    );
  const budgetMb = TRANSCRIPT_CACHE_BUDGET_MB_STOPS[budgetIndex] ?? 0;
  const ttlHours = TRANSCRIPT_CACHE_TTL_HOUR_STOPS[ttlIndex] ?? 1;

  const historyLabel =
    historyCompactions === null
      ? t("performanceInitialHistoryUnlimitedValue")
      : t(
          historyCompactions === 1
            ? "performanceInitialHistoryCompactionValue"
            : "performanceInitialHistoryCompactionsValue",
          { count: historyCompactions },
        );
  const budgetLabel =
    budgetMb === 0
      ? t("commonOff")
      : t("performanceTranscriptCacheMbValue", { count: budgetMb });
  const ttlLabel = formatTtl(ttlHours, t);

  const budgetEquivalent = useMemo(() => {
    if (budgetMb === 0) {
      return null;
    }
    const lastBytes = getLastSessionTranscriptBytes();
    const perSession = lastBytes ?? TYPICAL_SESSION_TRANSCRIPT_BYTES;
    const count = Math.max(
      1,
      Math.floor((budgetMb * 1024 * 1024) / perSession),
    );
    const size = (perSession / (1024 * 1024)).toFixed(1);
    return t(
      lastBytes !== null
        ? "performanceTranscriptCacheEquivalentLast"
        : "performanceTranscriptCacheEquivalentTypical",
      { count, size },
    );
  }, [budgetMb, t]);
  const transcriptMemoryStats = getSessionTranscriptMemoryStats();
  const cacheMemoryUsage =
    transcriptMemoryStats.totalBytes > 0
      ? t("performanceTranscriptCacheCurrentUsage", {
          warmSize: formatMemoryMb(transcriptMemoryStats.warmCacheBytes),
          liveSize: formatMemoryMb(transcriptMemoryStats.liveRetainedBytes),
        })
      : null;

  const commitHistory = useCallback(
    (index: number) => {
      setHistoryDraftIndex(null);
      setSessionInitialHistoryCompactions(
        index === MAX_SESSION_INITIAL_HISTORY_COMPACTIONS ? null : index + 1,
      );
    },
    [setSessionInitialHistoryCompactions],
  );
  const commitBudget = useCallback(
    (index: number) => {
      setBudgetDraftIndex(null);
      const stop = TRANSCRIPT_CACHE_BUDGET_MB_STOPS[index];
      if (stop !== undefined) {
        setSessionTranscriptCacheBudgetMb(stop);
      }
    },
    [setSessionTranscriptCacheBudgetMb],
  );
  const commitTtl = useCallback(
    (index: number) => {
      setTtlDraftIndex(null);
      const stop = TRANSCRIPT_CACHE_TTL_HOUR_STOPS[index];
      if (stop !== undefined) {
        setSessionTranscriptCacheTtlHours(stop);
      }
    },
    [setSessionTranscriptCacheTtlHours],
  );
  const commitReverseSearchPageLimit = useCallback(() => {
    const parsed = Number(reverseSearchPageLimitDraft);
    if (!Number.isFinite(parsed)) {
      setReverseSearchPageLimitDraft(String(reverseSearchMaxPagesPerAttempt));
      return;
    }
    const normalized = Math.min(
      MAX_REVERSE_SEARCH_PAGES_PER_ATTEMPT,
      Math.max(1, Math.round(parsed)),
    );
    setReverseSearchPageLimitDraft(String(normalized));
    setReverseSearchMaxPagesPerAttempt(normalized);
  }, [
    reverseSearchMaxPagesPerAttempt,
    reverseSearchPageLimitDraft,
    setReverseSearchMaxPagesPerAttempt,
  ]);
  const setHostProcessObservability = useCallback(
    async (enabled: boolean) => {
      setSavingHostProcessObservability(true);
      try {
        await updateServerSetting("hostProcessObservabilityEnabled", enabled);
      } catch {
        // useServerSettings retains the actionable error for this pane.
      } finally {
        setSavingHostProcessObservability(false);
      }
    },
    [updateServerSetting],
  );

  const undoState = useMemo(
    () => ({
      streamingEnabled,
      liveToolOutputEnabled,
      searchConcurrency,
      sessionLoadingProgressEnabled,
      sessionDomLingerEnabled,
      sessionActiveWindowTrimEnabled,
      sessionInitialHistoryCompactions,
      reverseSearchMaxPagesPerAttempt,
      sessionTranscriptCacheBudgetMb,
      sessionTranscriptCacheTtlHours,
      stableToolPreviewRendering,
      hostProcessObservabilityEnabled,
    }),
    [
      streamingEnabled,
      liveToolOutputEnabled,
      searchConcurrency,
      sessionLoadingProgressEnabled,
      sessionDomLingerEnabled,
      sessionActiveWindowTrimEnabled,
      sessionInitialHistoryCompactions,
      reverseSearchMaxPagesPerAttempt,
      sessionTranscriptCacheBudgetMb,
      sessionTranscriptCacheTtlHours,
      stableToolPreviewRendering,
      hostProcessObservabilityEnabled,
    ],
  );
  const restoreUndoState = useCallback(
    (snapshot: typeof undoState) => {
      setStreamingEnabled(snapshot.streamingEnabled);
      setLiveToolOutputEnabled(snapshot.liveToolOutputEnabled);
      setSearchConcurrency(snapshot.searchConcurrency);
      setSessionLoadingProgressEnabled(snapshot.sessionLoadingProgressEnabled);
      setSessionDomLingerEnabled(snapshot.sessionDomLingerEnabled);
      setSessionActiveWindowTrimEnabled(
        snapshot.sessionActiveWindowTrimEnabled,
      );
      setSessionInitialHistoryCompactions(
        snapshot.sessionInitialHistoryCompactions,
      );
      setReverseSearchMaxPagesPerAttempt(
        snapshot.reverseSearchMaxPagesPerAttempt,
      );
      setSessionTranscriptCacheBudgetMb(
        snapshot.sessionTranscriptCacheBudgetMb,
      );
      setSessionTranscriptCacheTtlHours(
        snapshot.sessionTranscriptCacheTtlHours,
      );
      setStableToolPreviewRendering(snapshot.stableToolPreviewRendering);
      if (
        hostProcessObservabilitySupported &&
        snapshot.hostProcessObservabilityEnabled !==
          hostProcessObservabilityEnabled
      ) {
        void setHostProcessObservability(
          snapshot.hostProcessObservabilityEnabled,
        );
      }
    },
    [
      setStreamingEnabled,
      setLiveToolOutputEnabled,
      setSearchConcurrency,
      setSessionLoadingProgressEnabled,
      setSessionDomLingerEnabled,
      setSessionActiveWindowTrimEnabled,
      setSessionInitialHistoryCompactions,
      setReverseSearchMaxPagesPerAttempt,
      setSessionTranscriptCacheBudgetMb,
      setSessionTranscriptCacheTtlHours,
      setStableToolPreviewRendering,
      hostProcessObservabilityEnabled,
      hostProcessObservabilitySupported,
      setHostProcessObservability,
    ],
  );
  useSettingsUndoBaseline(undoState, restoreUndoState);

  const historyHint = t("performanceHintHistory", {
    max: MAX_SESSION_INITIAL_HISTORY_COMPACTIONS,
    value: DEFAULT_SESSION_INITIAL_HISTORY_COMPACTIONS,
  });
  // Both stop lists start at their hook defaults (cache off, one hour).
  const budgetHint = t("performanceHintRange", {
    min: t("commonOff"),
    max: t("performanceTranscriptCacheMbValue", {
      count: TRANSCRIPT_CACHE_BUDGET_MB_STOPS.at(-1) ?? 0,
    }),
    value: t("commonOff"),
  });
  const ttlHint = t("performanceHintRange", {
    min: formatTtl(TRANSCRIPT_CACHE_TTL_HOUR_STOPS[0], t),
    max: formatTtl(TRANSCRIPT_CACHE_TTL_HOUR_STOPS.at(-1) ?? 1, t),
    value: formatTtl(TRANSCRIPT_CACHE_TTL_HOUR_STOPS[0], t),
  });

  return (
    <SettingsSection description={t("performanceSectionDescription")}>
      <SettingsSection title={t("performanceSectionRendering")} scope="local">
        <div className="settings-group">
          <ToggleSettingRow
            label={t("appearanceStreamingTitle")}
            description={t("appearanceStreamingDescription")}
            checked={streamingEnabled}
            onChange={setStreamingEnabled}
          />
          <ToggleSettingRow
            label={t("appearanceLiveToolOutputTitle")}
            description={t("appearanceLiveToolOutputDescription")}
            checked={liveToolOutputEnabled}
            onChange={setLiveToolOutputEnabled}
          />
          <ToggleSettingRow
            label={t("appearanceSessionLoadingProgressTitle")}
            description={t("appearanceSessionLoadingProgressDescription")}
            checked={sessionLoadingProgressEnabled}
            onChange={setSessionLoadingProgressEnabled}
          />
          <ToggleSettingRow
            label={t("appearanceStableToolPreviewTitle")}
            description={t("appearanceStableToolPreviewDescription")}
            checked={stableToolPreviewRendering}
            onChange={setStableToolPreviewRendering}
          />
        </div>
      </SettingsSection>

      <SettingsSection title={t("performanceSectionMemory")} scope="local">
        <div className="settings-group">
          <ToggleSettingRow
            label={t("performanceKeepRecentSessionMountedTitle")}
            description={t("performanceKeepRecentSessionMountedDescription")}
            checked={sessionDomLingerEnabled}
            onChange={setSessionDomLingerEnabled}
          />
          <ToggleSettingRow
            label={t("performanceActiveWindowTrimTitle")}
            description={t("performanceActiveWindowTrimDescription")}
            checked={sessionActiveWindowTrimEnabled}
            onChange={setSessionActiveWindowTrimEnabled}
          />
          <SettingsItem
            label={t("performanceInitialHistoryTitle")}
            description={t("performanceInitialHistoryDescription")}
            valueText={historyLabel}
            className="settings-item--wide-control"
          >
            <PerformanceValueControl value={historyLabel} hint={historyHint}>
              <CommittedRangeInput
                min={0}
                max={MAX_SESSION_INITIAL_HISTORY_COMPACTIONS}
                step={1}
                value={historyIndex}
                onDraftChange={setHistoryDraftIndex}
                onCommit={commitHistory}
                aria-label={t("performanceInitialHistoryTitle")}
              />
            </PerformanceValueControl>
          </SettingsItem>
          <SettingsItem
            label={t("performanceTranscriptCacheTitle")}
            description={t("performanceTranscriptCacheDescription")}
            valueText={budgetLabel}
            className="settings-item--wide-control"
            info={
              <>
                <ScopedRowTitle
                  label={t("performanceTranscriptCacheTitle")}
                  scope="local"
                />
                <p>{t("performanceTranscriptCacheDescription")}</p>
                {budgetEquivalent ? <p>{budgetEquivalent}</p> : null}
                {cacheMemoryUsage ? <p>{cacheMemoryUsage}</p> : null}
              </>
            }
          >
            <PerformanceValueControl value={budgetLabel} hint={budgetHint}>
              <CommittedRangeInput
                min={0}
                max={TRANSCRIPT_CACHE_BUDGET_MB_STOPS.length - 1}
                step={1}
                value={budgetIndex}
                onDraftChange={setBudgetDraftIndex}
                onCommit={commitBudget}
                aria-label={t("performanceTranscriptCacheTitle")}
              />
            </PerformanceValueControl>
          </SettingsItem>
          <SettingsItem
            label={t("performanceTranscriptCacheTtlTitle")}
            description={t("performanceTranscriptCacheTtlDescription")}
            valueText={ttlLabel}
            className="settings-item--wide-control"
          >
            <PerformanceValueControl value={ttlLabel} hint={ttlHint}>
              <CommittedRangeInput
                min={0}
                max={TRANSCRIPT_CACHE_TTL_HOUR_STOPS.length - 1}
                step={1}
                value={ttlIndex}
                onDraftChange={setTtlDraftIndex}
                onCommit={commitTtl}
                disabled={budgetMb === 0}
                aria-label={t("performanceTranscriptCacheTtlTitle")}
              />
            </PerformanceValueControl>
          </SettingsItem>
        </div>
      </SettingsSection>

      <SettingsSection title={t("performanceSectionSearch")} scope="local">
        <div className="settings-group">
          <SettingsItem
            label={t("performanceSearchConcurrencyTitle")}
            description={t("performanceSearchConcurrencyDescription")}
            valueText={t("performanceSearchConcurrencyValue", {
              count: searchConcurrency,
            })}
            className="settings-item--wide-control"
          >
            <PerformanceValueControl
              value={t("performanceSearchConcurrencyValue", {
                count: searchConcurrency,
              })}
              hint={t("performanceHintRange", {
                min: 1,
                max: MAX_SEARCH_CONCURRENCY,
                value: DEFAULT_SEARCH_CONCURRENCY,
              })}
            >
              <CommittedRangeInput
                min={1}
                max={MAX_SEARCH_CONCURRENCY}
                step={1}
                value={searchConcurrency}
                onCommit={setSearchConcurrency}
                aria-label={t("performanceSearchConcurrencyTitle")}
              />
            </PerformanceValueControl>
          </SettingsItem>
          <SettingsItem
            label={t("performanceReverseSearchPageLimitTitle")}
            description={t("performanceReverseSearchPageLimitDescription")}
            descriptionLayout="full-width-on-narrow"
            valueText={t("performanceReverseSearchPageLimitValue", {
              count: reverseSearchMaxPagesPerAttempt,
            })}
          >
            <PerformanceValueControl
              hint={t("performanceHintRange", {
                min: 1,
                max: MAX_REVERSE_SEARCH_PAGES_PER_ATTEMPT,
                value: DEFAULT_REVERSE_SEARCH_PAGES_PER_ATTEMPT,
              })}
            >
              <span className="settings-input-unit">
                <input
                  type="number"
                  className="settings-input-small"
                  min={1}
                  max={MAX_REVERSE_SEARCH_PAGES_PER_ATTEMPT}
                  step={1}
                  value={reverseSearchPageLimitDraft}
                  onChange={(event) =>
                    setReverseSearchPageLimitDraft(event.target.value)
                  }
                  onBlur={commitReverseSearchPageLimit}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitReverseSearchPageLimit();
                      event.currentTarget.blur();
                    }
                  }}
                  aria-label={t("performanceReverseSearchPageLimitTitle")}
                />
                {t("performanceReverseSearchPageLimitUnit")}
              </span>
            </PerformanceValueControl>
          </SettingsItem>
          {hostProcessObservabilitySupported && (
            <ToggleSettingRow
              label={t("performanceHostProcessObservabilityTitle")}
              description={t("performanceHostProcessObservabilityDescription")}
              scope="server"
              keywords={["Agents", "CPU", "memory", "external processes"]}
              checked={hostProcessObservabilityEnabled}
              disabled={serverSettingsLoading || savingHostProcessObservability}
              onChange={(enabled) => void setHostProcessObservability(enabled)}
              after={
                serverSettingsError ? (
                  <ErrorState inline message={serverSettingsError} />
                ) : null
              }
            />
          )}
        </div>
      </SettingsSection>
    </SettingsSection>
  );
}
