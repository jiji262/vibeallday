import type { HostAgentProcessObservation } from "@vibeallday/shared";
import type { ProcessInfo } from "../hooks/useProcesses";
import { useI18n } from "../i18n";
import styles from "./AgentsProcessStats.module.css";
import { formatCpu, formatMemory, meterPercent } from "./agentsFormat";

const EMPTY_METRIC = "—";
const HIGH_CPU_PERCENT = 70;

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
  /** Whether host-level process telemetry is active. */
  hostMetrics: boolean;
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
    hostMetrics,
  };
}

function CpuStatCard({ percent }: { percent: number | null }) {
  const { t } = useI18n();
  const value = percent !== null ? formatCpu(percent) : EMPTY_METRIC;
  const high = percent !== null && percent >= HIGH_CPU_PERCENT;
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.label}>{t("agentsColumnCpu")}</span>
        <span
          className={`${styles.dot} ${high ? styles.dotAttn : percent !== null ? styles.dotAccent : styles.dotIdle}`}
          aria-hidden="true"
        />
      </div>
      <div className={styles.value}>{value}</div>
      <div className={styles.meterWrap}>
        {percent !== null ? (
          <span
            className={styles.meter}
            role="img"
            aria-label={t("agentsStatCpuLabel", { percent: value })}
          >
            <span
              className={`${styles.meterFill} ${high ? styles.meterFillAttn : ""}`}
              style={{ width: `${meterPercent(percent)}%` }}
            />
          </span>
        ) : (
          <span className={styles.meter} aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

/** Count, CPU and memory totals, and the external count, above the lists. */
export function ProcessStatsStrip({ stats }: { stats: ProcessStats }) {
  const { t } = useI18n();
  const showHostTelemetry =
    stats.hostMetrics ||
    stats.cpuPercent !== null ||
    stats.memoryBytes !== null;
  return (
    <section aria-label={t("agentsStatsLabel")} className={styles.grid}>
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.label}>{t("agentsStatProcesses")}</span>
          <span
            className={`${styles.dot} ${stats.active > 0 ? styles.dotRun : styles.dotIdle}`}
            aria-hidden="true"
          />
        </div>
        <div className={styles.value}>{stats.live}</div>
        <div className={styles.foot}>
          {t("agentsStatBreakdown", {
            active: stats.active,
            idle: stats.idle,
          })}
        </div>
      </div>
      {showHostTelemetry && <CpuStatCard percent={stats.cpuPercent} />}
      {showHostTelemetry && (
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.label}>{t("agentsColumnMemory")}</span>
            <span
              className={`${styles.dot} ${stats.memoryBytes !== null ? styles.dotAccent : styles.dotIdle}`}
              aria-hidden="true"
            />
          </div>
          <div className={styles.value}>
            {stats.memoryBytes !== null
              ? formatMemory(stats.memoryBytes)
              : EMPTY_METRIC}
          </div>
          <div className={styles.foot}>{t("agentsStatMemoryFoot")}</div>
        </div>
      )}
      {stats.external !== null && (
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.label}>{t("agentsStatExternal")}</span>
            <span
              className={`${styles.dot} ${stats.external > 0 ? styles.dotAttn : styles.dotIdle}`}
              aria-hidden="true"
            />
          </div>
          <div className={styles.value}>{stats.external}</div>
          <div className={styles.foot}>{t("agentsStatExternalFoot")}</div>
        </div>
      )}
    </section>
  );
}
