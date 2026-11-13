import type { HostAgentProcessObservation } from "@vibeallday/shared";
import { StatCard, StatGrid } from "../components/garden/StatCard";
import type { ProcessInfo } from "../hooks/useProcesses";
import { useI18n } from "../i18n";
import styles from "./AgentsPage.module.css";
import { formatCpu, formatMemory, meterPercent } from "./agentsFormat";

export interface ProcessStats {
  live: number;
  active: number;
  idle: number;
  /** Summed process-tree CPU; null until the host has sampled one. */
  cpuPercent: number | null;
  /** Summed process-tree RSS; null without host observations. */
  memoryBytes: number | null;
  /** Host-observed external processes; null when host metrics are off. */
  external: number | null;
}

interface StatsInput {
  processes: readonly ProcessInfo[];
  observations: readonly HostAgentProcessObservation[];
  hostMetrics: boolean;
}

function isActive(process: ProcessInfo): boolean {
  return process.state === "in-turn" || process.state === "waiting-input";
}

/** Page totals over the unfiltered lists, so search never moves them. */
export function computeProcessStats({
  processes,
  observations,
  hostMetrics,
}: StatsInput): ProcessStats {
  const liveIds = new Set(processes.map((process) => process.id));
  const supervised = observations.filter(
    (observation) =>
      observation.supervision === "vibeallday" &&
      observation.supervisorProcessId !== undefined &&
      liveIds.has(observation.supervisorProcessId),
  );
  const sampled = supervised.filter((observation) => observation.cpu);
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  return {
    live: processes.length,
    active: processes.filter(isActive).length,
    idle: processes.filter((process) => process.state === "idle").length,
    cpuPercent:
      sampled.length > 0
        ? sum(sampled.map((observation) => observation.cpu?.treePercent ?? 0))
        : null,
    memoryBytes:
      supervised.length > 0
        ? sum(supervised.map((observation) => observation.memory.treeRssBytes))
        : null,
    external: hostMetrics
      ? observations.filter(
          (observation) => observation.supervision === "external",
        ).length
      : null,
  };
}

function CpuStat({ percent }: { percent: number }) {
  const { t } = useI18n();
  const value = formatCpu(percent);
  return (
    <StatCard
      label={t("agentsColumnCpu")}
      value={value}
      foot={
        <span
          className={`${styles.meter} ${styles.statMeter}`}
          role="img"
          aria-label={t("agentsStatCpuLabel", { percent: value })}
        >
          <span
            className={styles.meterFill}
            style={{ width: `${meterPercent(percent)}%` }}
          />
        </span>
      }
    />
  );
}

/** Count, CPU and memory totals, and the external count, above the lists. */
export function ProcessStatsStrip({ stats }: { stats: ProcessStats }) {
  const { t } = useI18n();
  return (
    <StatGrid label={t("agentsStatsLabel")} className={styles.stats}>
      <StatCard
        label={t("agentsStatProcesses")}
        value={stats.live}
        foot={t("agentsStatBreakdown", {
          active: stats.active,
          idle: stats.idle,
        })}
      />
      {stats.cpuPercent !== null && <CpuStat percent={stats.cpuPercent} />}
      {stats.memoryBytes !== null && (
        <StatCard
          label={t("agentsColumnMemory")}
          value={formatMemory(stats.memoryBytes)}
          foot={t("agentsStatMemoryFoot")}
        />
      )}
      {stats.external !== null && (
        <StatCard
          label={t("agentsStatExternal")}
          value={stats.external}
          foot={t("agentsStatExternalFoot")}
        />
      )}
    </StatGrid>
  );
}
