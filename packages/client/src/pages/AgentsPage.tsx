import type { HostAgentProcessObservation } from "@vibeallday/shared";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { api } from "../api/client";
import { ErrorState } from "../components/garden/ErrorState";
import { SearchField } from "../components/garden/Field";
import { ListToolbar } from "../components/garden/ListToolbar";
import { LoadingState } from "../components/garden/LoadingState";
import { Notice } from "../components/garden/Notice";
import { PageHeader } from "../components/PageHeader";
import { PageIntro } from "../components/shell/PageIntro";
import { pageWidthClass } from "../components/shell/pageWidth";
import { useHostAgentProcesses } from "../hooks/useHostAgentProcesses";
import { type ProcessInfo, useProcesses } from "../hooks/useProcesses";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useI18n } from "../i18n";
import { MainContent, useNavigationLayout } from "../layouts";
import styles from "./AgentsPage.module.css";
import { ExternalProcessRow, ProcessRow } from "./AgentsProcessRows";
import {
  ProcessesEmpty,
  ProcessSection,
  ProcessSectionEmpty,
} from "./AgentsProcessSection";
import { computeProcessStats, ProcessStatsStrip } from "./AgentsProcessStats";
import {
  AgentsStateFilter,
  countShown,
  effectiveStateFilter,
  type ProcessStateFilter,
  sectionCounts,
  showsSection,
} from "./AgentsStateFilter";
import { observationMatchesQuery, processMatchesQuery } from "./agentsFormat";

/** Process, PID, status, CPU, memory, uptime, actions. */
const PROCESS_COLUMNS = 7;

type Translate = ReturnType<typeof useI18n>["t"];

interface KillFeedback {
  tone: "success" | "danger";
  message: string;
}

async function killProcess(
  process: ProcessInfo,
  t: Translate,
): Promise<KillFeedback> {
  try {
    // Explicit Kill also persists a VIBEALLDAY-owned auto-resume exemption.
    // The provider transcript remains available for deliberate continuation.
    const result = await api.abortProcess(process.id, { blockResume: true });
    const stopped =
      result.pid === undefined
        ? t("agentsKillVerified")
        : t("agentsKillVerifiedPid", { pid: result.pid });
    const exemption = result.resumeExemption;
    if (exemption?.error || exemption?.autoResumeDisabled === false) {
      const message = exemption.error ?? t("agentsKillResumeBlockUnknown");
      return {
        tone: "danger",
        message: `${stopped} ${t("agentsKillResumeBlockFailed", { message })}`,
      };
    }
    const blocked = exemption?.autoResumeDisabled
      ? ` ${t("agentsKillResumeBlocked")}`
      : "";
    return { tone: "success", message: `${stopped}${blocked}` };
  } catch (error) {
    return {
      tone: "danger",
      message: t("agentsKillFailed", {
        message: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}

/**
 * Forcibly abort a live (hung or otherwise) process. This is the manual
 * escape hatch for orphans the automatic stale sweep can't confirm dead
 * (e.g. a Codex hang with no liveness signal).
 */
function useKill(refetch: () => Promise<unknown>) {
  const { t } = useI18n();
  const [killingIds, setKillingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [feedback, setFeedback] = useState<KillFeedback | null>(null);
  const kill = useCallback(
    async (process: ProcessInfo) => {
      const title = process.sessionTitle || t("agentsUntitled");
      if (!window.confirm(t("agentsKillConfirm", { title }))) return;
      setKillingIds((prev) => new Set(prev).add(process.id));
      setFeedback(null);
      setFeedback(await killProcess(process, t));
      await refetch();
      setKillingIds((prev) => {
        const next = new Set(prev);
        next.delete(process.id);
        return next;
      });
    },
    [refetch, t],
  );
  return { killingIds, feedback, kill };
}

function supervisedObservations(
  observations: readonly HostAgentProcessObservation[],
) {
  const bySupervisor = new Map<string, HostAgentProcessObservation>();
  for (const observation of observations) {
    if (observation.supervisorProcessId !== undefined) {
      bySupervisor.set(observation.supervisorProcessId, observation);
    }
  }
  return bySupervisor;
}

/** Splits and filters every group with the deferred query. */
function useProcessGroups(query: string) {
  const { processes, terminatedProcesses, loading, error, refetch } =
    useProcesses();
  const host = useHostAgentProcesses();
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const keep = (process: ProcessInfo) =>
      needle === "" || processMatchesQuery(process, needle);
    const external = host.observations.filter(
      (observation) =>
        observation.supervision === "external" &&
        (needle === "" || observationMatchesQuery(observation, needle)),
    );
    return {
      active: processes.filter(
        (p) =>
          (p.state === "in-turn" || p.state === "waiting-input") && keep(p),
      ),
      idle: processes.filter((p) => p.state === "idle" && keep(p)),
      stopped: terminatedProcesses.filter(keep),
      external,
      bySupervisor: supervisedObservations(host.observations),
    };
  }, [processes, terminatedProcesses, host.observations, query]);
  const externalTotal = host.observations.filter(
    (observation) => observation.supervision === "external",
  ).length;
  const total = processes.length + terminatedProcesses.length + externalTotal;
  const hostMetrics = host.enabled && host.supported !== false && !host.error;
  const stats = useMemo(
    () =>
      computeProcessStats({
        processes,
        observations: host.observations,
        hostMetrics,
      }),
    [processes, host.observations, hostMetrics],
  );
  return { groups, host, stats, total, loading, error, refetch };
}

function ExternalEmpty({
  host,
  filtered,
}: {
  host: ReturnType<typeof useHostAgentProcesses>;
  filtered: boolean;
}) {
  const { t } = useI18n();
  if (host.loading) {
    return (
      <div className={styles.inlineState}>
        <LoadingState variant="compact" label={t("agentsExternalLoading")} />
      </div>
    );
  }
  if (host.supported === false) {
    return (
      <ProcessSectionEmpty>
        {t("agentsExternalUnsupported")}
      </ProcessSectionEmpty>
    );
  }
  if (host.error) {
    return (
      <ProcessSectionEmpty>
        {t("agentsExternalUnavailable")}
      </ProcessSectionEmpty>
    );
  }
  return (
    <ProcessSectionEmpty>
      {filtered ? t("agentsNoMatches") : t("agentsEmptyExternal")}
    </ProcessSectionEmpty>
  );
}

type ProcessGroups = ReturnType<typeof useProcessGroups>["groups"];

/** Why the host-observed list is empty, when that is the notable part. */
function processesEmptyHint(
  host: ReturnType<typeof useHostAgentProcesses>,
  t: Translate,
): string {
  if (host.enabled && host.supported === false) {
    return t("agentsExternalUnsupported");
  }
  if (host.enabled && host.error) return t("agentsExternalUnavailable");
  return t("agentsEmptyAllHint");
}

interface ProcessGroupsViewProps {
  groups: ProcessGroups;
  host: ReturnType<typeof useHostAgentProcesses>;
  filtered: boolean;
  stateFilter: ProcessStateFilter;
  kill: (process: ProcessInfo) => void;
  killingIds: ReadonlySet<string>;
}

function ProcessGroupsView({
  groups,
  host,
  filtered,
  stateFilter,
  kill,
  killingIds,
}: ProcessGroupsViewProps) {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  if (
    !filtered &&
    !host.loading &&
    countShown("all", sectionCounts(groups)) === 0
  ) {
    return <ProcessesEmpty hint={processesEmptyHint(host, t)} />;
  }
  const empty = (key: Parameters<Translate>[0]) => (
    <ProcessSectionEmpty>
      {filtered ? t("agentsNoMatches") : t(key)}
    </ProcessSectionEmpty>
  );
  const ownedRow = (process: ProcessInfo) => (
    <ProcessRow
      key={process.id}
      process={process}
      observation={groups.bySupervisor.get(process.id)}
      basePath={basePath}
      onKill={kill}
      killing={killingIds.has(process.id)}
    />
  );
  return (
    <div className={styles.sections}>
      {showsSection(stateFilter, "active") && (
        <ProcessSection
          title={t("agentsSectionActive")}
          count={groups.active.length}
          empty={empty("agentsEmptyActive")}
        >
          {groups.active.map(ownedRow)}
        </ProcessSection>
      )}
      {host.enabled && showsSection(stateFilter, "external") && (
        <ProcessSection
          title={t("agentsSectionExternal")}
          count={groups.external.length}
          empty={<ExternalEmpty host={host} filtered={filtered} />}
        >
          {groups.external.map((observation) => (
            <ExternalProcessRow
              key={observation.observationId}
              observation={observation}
              basePath={basePath}
            />
          ))}
        </ProcessSection>
      )}
      {showsSection(stateFilter, "idle") && (
        <ProcessSection
          title={t("agentsSectionIdle")}
          count={groups.idle.length}
          empty={empty("agentsEmptyIdle")}
        >
          {groups.idle.map(ownedRow)}
        </ProcessSection>
      )}
      {showsSection(stateFilter, "stopped") && (
        <ProcessSection
          title={t("agentsSectionStopped")}
          count={groups.stopped.length}
          empty={empty("agentsEmptyStopped")}
        >
          {groups.stopped.map((process) => (
            <ProcessRow
              key={process.id}
              process={process}
              basePath={basePath}
              terminated
            />
          ))}
        </ProcessSection>
      )}
    </div>
  );
}

/** Processes: supervised and host-observed agent processes, by state. */
export function AgentsPage() {
  const { t } = useI18n();
  const { openSidebar, isWideScreen } = useNavigationLayout();
  const [query, setQuery] = useState("");
  const [chosenFilter, setStateFilter] = useState<ProcessStateFilter>("all");
  // The field echoes `query` at once; filtering follows the deferred copy.
  const deferredQuery = useDeferredValue(query);
  const { groups, host, stats, total, loading, error, refetch } =
    useProcessGroups(deferredQuery);
  const stateFilter = effectiveStateFilter(chosenFilter, host.enabled);
  const counts = sectionCounts(groups);
  const { killingIds, feedback, kill } = useKill(refetch);
  return (
    <MainContent isWideScreen={isWideScreen}>
      <PageHeader
        title={t("agentsTitle")}
        intro="content"
        onOpenSidebar={openSidebar}
        isWideScreen={isWideScreen}
      />
      <main className="page-scroll-container">
        <div className={`page-content-inner ${pageWidthClass("wide")}`}>
          <PageIntro
            eyebrow={[t("sidebarGroupTools")]}
            title={t("agentsTitle")}
            lede={t("consoleAgentsDescription")}
          />
          {!loading && !error && <ProcessStatsStrip stats={stats} />}
          <ListToolbar
            label={t("agentsSearchLabel")}
            search={
              <SearchField
                label={t("agentsSearchLabel")}
                placeholder={t("agentsSearchPlaceholder")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            }
            filters={
              <AgentsStateFilter
                value={stateFilter}
                onChange={setStateFilter}
                counts={counts}
                external={host.enabled}
              />
            }
            count={t("agentsCount", {
              shown: countShown(stateFilter, counts),
              total,
            })}
          />
          {feedback && (
            <Notice
              tone={feedback.tone}
              role={feedback.tone === "danger" ? "alert" : "status"}
              className={styles.feedback}
            >
              {feedback.message}
            </Notice>
          )}
          {loading && (
            <LoadingState
              variant="table"
              columns={PROCESS_COLUMNS}
              label={t("agentsLoading")}
            />
          )}
          {error && (
            <ErrorState
              tag={t("errorTag")}
              message={t("agentsError", { message: error.message })}
              onRetry={() => void refetch()}
              retryLabel={t("retry")}
            />
          )}
          {!loading && !error && (
            <ProcessGroupsView
              groups={groups}
              host={host}
              filtered={deferredQuery.trim() !== ""}
              stateFilter={stateFilter}
              kill={kill}
              killingIds={killingIds}
            />
          )}
          {!loading && !error && (
            <p className={styles.footnote}>{t("agentsFootnote")}</p>
          )}
        </div>
      </main>
    </MainContent>
  );
}
