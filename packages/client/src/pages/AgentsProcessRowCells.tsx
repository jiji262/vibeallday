import type { HostAgentProcessObservation } from "@vibeallday/shared";
import { ClearloopRemainingBadge } from "../components/ClearloopRemainingBadge";
import { ContextUsageIndicator } from "../components/ContextUsageIndicator";
import { Button } from "../components/garden/Button";
import { Td } from "../components/garden/DataTable";
import { Status } from "../components/garden/StatusDot";
import type { ProcessInfo } from "../hooks/useProcesses";
import { useI18n } from "../i18n";
import styles from "./AgentsPage.module.css";
import { ProcessMetrics } from "./AgentsProcessMetrics";
import {
  formatCpu,
  formatUptime,
  getStateLabel,
  getStateStatus,
  meterPercent,
} from "./agentsFormat";
import type { ProcessRowProps } from "./AgentsProcessRows";

export const EMPTY_CELL = "—";

export function ProcessStatus({ process }: { process: ProcessInfo }) {
  const { t } = useI18n();
  return (
    <span className={styles.status}>
      <Status state={getStateStatus(process.state)}>
        {getStateLabel(process.state, t)}
      </Status>
      {process.clearloop !== undefined && (
        <ClearloopRemainingBadge badge={process.clearloop} />
      )}
      {process.contextUsage && (
        <ContextUsageIndicator usage={process.contextUsage} />
      )}
    </span>
  );
}

function KillAction({
  process,
  killing = false,
  onKill,
}: {
  process: ProcessInfo;
  killing?: boolean;
  onKill: (process: ProcessInfo) => void;
}) {
  const { t } = useI18n();
  return (
    <Button
      variant="danger-soft"
      size="sm"
      disabled={killing}
      onClick={() => onKill(process)}
      title={t("agentsKillTitle")}
    >
      {killing ? t("agentsKilling") : t("agentsKill")}
    </Button>
  );
}

/** Process-tree CPU as a small meter plus the percent. */
export function CpuMeter({
  observation,
}: {
  observation?: HostAgentProcessObservation;
}) {
  const { t } = useI18n();
  if (!observation) return <>{EMPTY_CELL}</>;
  const { cpu } = observation;
  if (!cpu) {
    return (
      <span className={styles.cpuPending}>{t("agentsMetricsCpuSampling")}</span>
    );
  }
  return (
    <span className={styles.resource}>
      <span className={styles.meter} aria-hidden="true">
        <span
          className={styles.meterFill}
          style={{ width: `${meterPercent(cpu.treePercent)}%` }}
        />
      </span>
      <span className={styles.resourceValue}>{formatCpu(cpu.treePercent)}</span>
    </span>
  );
}

export interface ResourceCellsProps {
  observation?: HostAgentProcessObservation;
  sessionId?: string;
  /** Uptime origin when no host observation dates the process. */
  fallbackStartedAt?: string;
  ageTitle?: string;
  live: boolean;
  touchSurfaceRef?: Parameters<typeof ProcessMetrics>[0]["touchSurfaceRef"];
}

/** CPU, memory and uptime cells shared by owned and external rows. */
export function ResourceCells({
  observation,
  sessionId,
  fallbackStartedAt,
  ageTitle,
  live,
  touchSurfaceRef,
}: ResourceCellsProps) {
  const { t } = useI18n();
  const shown = live ? observation : undefined;
  const startedAt = observation?.startedAt ?? fallbackStartedAt;
  return (
    <>
      <Td className={styles.cellCpu} data-label={t("agentsColumnCpu")}>
        <CpuMeter observation={shown} />
      </Td>
      <Td className={styles.cellMemory} data-label={t("agentsColumnMemory")}>
        {shown ? (
          <ProcessMetrics
            observation={shown}
            sessionId={sessionId}
            touchSurfaceRef={touchSurfaceRef}
          />
        ) : (
          EMPTY_CELL
        )}
      </Td>
      <Td
        mono
        num
        className={styles.cellUptime}
        data-label={t("agentsColumnUptime")}
        title={ageTitle}
      >
        {live && startedAt ? formatUptime(startedAt) : EMPTY_CELL}
      </Td>
    </>
  );
}

export function ProcessRowCells({
  process,
  observation,
  live,
  killing,
  onKill,
}: Pick<ProcessRowProps, "process" | "observation" | "killing" | "onKill"> & {
  live: boolean;
}) {
  const { t } = useI18n();
  // A hosted provider process outlives VIBEALLDAY restarts, so the OS process
  // age is the age; VIBEALLDAY's attach time is secondary.
  const ageTitle = observation
    ? t("agentsAgeTooltip", {
        started: new Date(observation.startedAt).toLocaleString(),
        attached: new Date(process.startedAt).toLocaleString(),
      })
    : undefined;
  return (
    <>
      <Td mono num className={styles.cellPid} data-label={t("agentsColumnPid")}>
        {process.pid ?? EMPTY_CELL}
      </Td>
      <Td className={styles.cellStatus}>
        <ProcessStatus process={process} />
      </Td>
      <ResourceCells
        observation={observation}
        sessionId={process.sessionId}
        fallbackStartedAt={process.startedAt}
        ageTitle={ageTitle}
        live={live}
      />
      <Td actions className={styles.cellActions}>
        {live && onKill ? (
          <KillAction process={process} killing={killing} onKill={onKill} />
        ) : null}
      </Td>
    </>
  );
}
