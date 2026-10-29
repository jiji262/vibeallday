import { ClearloopRemainingBadge } from "../components/ClearloopRemainingBadge";
import { ContextUsageIndicator } from "../components/ContextUsageIndicator";
import { Badge } from "../components/garden/Badge";
import { RowAction, Td } from "../components/garden/DataTable";
import type { ProcessInfo } from "../hooks/useProcesses";
import { useI18n } from "../i18n";
import styles from "./AgentsPage.module.css";
import { ProcessMetrics } from "./AgentsProcessMetrics";
import {
  formatUptime,
  getProviderLabel,
  getStateLabel,
  getStateTone,
} from "./agentsFormat";
import type { ProcessRowProps } from "./AgentsProcessRows";

export const EMPTY_CELL = "—";

export function ProcessStatus({ process }: { process: ProcessInfo }) {
  const { t } = useI18n();
  return (
    <span className={styles.status}>
      <Badge
        tone={getStateTone(process.state)}
        dot={process.state === "in-turn" ? "pulse" : true}
      >
        {getStateLabel(process.state, t)}
      </Badge>
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
    <RowAction
      tone="rose"
      disabled={killing}
      onClick={() => onKill(process)}
      title={t("agentsKillTitle")}
    >
      {killing ? t("agentsKilling") : t("agentsKill")}
    </RowAction>
  );
}

/** Live metrics need both an OS observation and a running process. */
function metricsCell(
  process: ProcessRowProps["process"],
  observation: ProcessRowProps["observation"],
  live: boolean,
) {
  if (!live || !observation) return EMPTY_CELL;
  return (
    <ProcessMetrics observation={observation} sessionId={process.sessionId} />
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
      <Td muted>{process.projectName}</Td>
      <Td>{getProviderLabel(process.provider, t)}</Td>
      <Td mono num>
        {process.pid ?? EMPTY_CELL}
      </Td>
      <Td mono num title={ageTitle}>
        {live
          ? formatUptime(observation?.startedAt ?? process.startedAt)
          : EMPTY_CELL}
      </Td>
      <Td>{metricsCell(process, observation, live)}</Td>
      <Td>
        <ProcessStatus process={process} />
      </Td>
      <Td actions>
        {live && onKill ? (
          <KillAction process={process} killing={killing} onKill={onKill} />
        ) : null}
      </Td>
    </>
  );
}
