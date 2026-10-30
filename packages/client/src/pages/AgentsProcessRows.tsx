import type { HostAgentProcessObservation } from "@vibeallday/shared";
import { useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Tag } from "../components/garden/Badge";
import { Td, Tr } from "../components/garden/DataTable";
import { ProviderMark } from "../components/garden/ProviderMark";
import { ProviderChildNavTarget } from "../components/ProviderChildNavTarget";
import type { ProcessInfo } from "../hooks/useProcesses";
import { useI18n } from "../i18n";
import {
  providerChildSessionHref,
  providerChildTitle,
} from "../lib/providerChildSessions";
import styles from "./AgentsPage.module.css";
import { ProcessRowCells, ResourceCells } from "./AgentsProcessRowCells";
import { getProviderLabel } from "./agentsFormat";

/** Short session id shown when an external process has no title. */
const SHORT_ID_LENGTH = 8;

function sessionHref(basePath: string, projectId: string, sessionId: string) {
  return `${basePath}/projects/${projectId}/sessions/${sessionId}`;
}

/** Project, provider, permission mode, queue and stop reason on one line. */
function ProcessDetails({ process }: { process: ProcessInfo }) {
  const { t } = useI18n();
  const parts = [
    process.projectName || null,
    getProviderLabel(process.provider, t),
    process.permissionMode
      ? `${t("agentsPermissionMode")}: ${process.permissionMode}`
      : null,
    process.queueDepth > 0
      ? `${t("agentsMessagesQueued")}: ${process.queueDepth}`
      : null,
    process.terminationReason
      ? `${t("agentsStopReason")}: ${process.terminationReason}`
      : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  return <span className={styles.details}>{parts.join(" · ")}</span>;
}

function ProviderChildren({
  process,
  basePath,
}: {
  process: ProcessInfo;
  basePath: string;
}) {
  const { t } = useI18n();
  const children = process.providerChildren ?? [];
  if (children.length === 0) return null;
  const label = t(
    children.length === 1
      ? "providerChildrenCountOne"
      : "providerChildrenCountMany",
    { count: children.length },
  );
  return (
    <span className={styles.providerChildren} role="list" aria-label={label}>
      {children.map((child) => {
        const title = providerChildTitle(child, t("providerChildFallback"));
        const href = providerChildSessionHref(
          basePath,
          process.projectId,
          process.sessionId,
          child.id,
        );
        return (
          <span key={child.id} role="listitem">
            <ProviderChildNavTarget
              className={styles.providerChild}
              href={href}
            >
              <span className={styles.providerChildBranch} aria-hidden>
                ↳
              </span>
              <span className={styles.providerChildTitle}>{title}</span>
              {child.agentType && child.agentType !== title && (
                <span className={styles.providerChildType}>
                  {child.agentType}
                </span>
              )}
            </ProviderChildNavTarget>
          </span>
        );
      })}
    </span>
  );
}

export interface ProcessRowProps {
  process: ProcessInfo;
  observation?: HostAgentProcessObservation;
  basePath: string;
  onKill?: (process: ProcessInfo) => void;
  killing?: boolean;
  /** Stopped group: no age, metrics or kill action. */
  terminated?: boolean;
}

/** One VibeAllDay-supervised process. */
export function ProcessRow({
  process,
  observation,
  basePath,
  onKill,
  killing = false,
  terminated = false,
}: ProcessRowProps) {
  const { t } = useI18n();
  const live = !terminated;
  return (
    <Tr className={styles.processRow}>
      <Td className={styles.sessionCell}>
        <span className={styles.identity}>
          <ProviderMark provider={process.provider ?? "claude"} />
          <span className={styles.identityText}>
            <Link
              to={sessionHref(basePath, process.projectId, process.sessionId)}
              className={styles.sessionLink}
              title={t("agentsSessionTooltip", { id: process.sessionId })}
            >
              {process.sessionTitle || t("agentsUntitled")}
            </Link>
            <ProcessDetails process={process} />
          </span>
        </span>
        <ProviderChildren process={process} basePath={basePath} />
      </Td>
      <ProcessRowCells
        process={process}
        observation={observation}
        live={live}
        killing={killing}
        onKill={onKill}
      />
    </Tr>
  );
}

function externalTitle(
  observation: HostAgentProcessObservation,
  provider: string,
  t: ReturnType<typeof useI18n>["t"],
): string {
  // Only an exact provider record names the session; without one the row
  // stays a plain process and never guesses a title or link.
  if (observation.sessionTitle) return observation.sessionTitle;
  if (observation.sessionId) {
    return t("agentsExternalSessionTitle", {
      provider,
      id: observation.sessionId.slice(0, SHORT_ID_LENGTH),
    });
  }
  return t("agentsExternalProcessTitle", { provider });
}

/** The row's title cell: a session link when the process has one, else text. */
function ExternalSessionCell({
  basePath,
  observation,
  title,
  tooltip,
  attachRow,
}: {
  basePath: string;
  observation: HostAgentProcessObservation;
  title: string;
  tooltip?: string;
  attachRow: (node: HTMLElement | null) => void;
}) {
  const { sessionId, projectId } = observation;
  return sessionId && projectId ? (
    <Link
      ref={attachRow}
      to={sessionHref(basePath, projectId, sessionId)}
      className={styles.sessionLink}
      title={tooltip}
    >
      {title}
    </Link>
  ) : (
    <span ref={attachRow} className={styles.sessionText} title={tooltip}>
      {title}
    </span>
  );
}

interface ExternalProcessRowProps {
  observation: HostAgentProcessObservation;
  basePath: string;
}

/** A provider process running on the host outside VibeAllDay's supervision. */
export function ExternalProcessRow({
  observation,
  basePath,
}: ExternalProcessRowProps) {
  const { t } = useI18n();
  // The whole row is the quiet touch surface for the metrics popover; garden
  // `Tr` takes no ref, so the title element resolves its row once mounted.
  const rowRef = useRef<HTMLElement | null>(null);
  const attachRow = useCallback((node: HTMLElement | null) => {
    rowRef.current = node?.closest("tr") ?? null;
  }, []);
  const provider = getProviderLabel(observation.provider, t);
  const { sessionId } = observation;
  const title = externalTitle(observation, provider, t);
  const tooltip = sessionId
    ? t("agentsSessionTooltip", { id: sessionId })
    : undefined;
  return (
    <Tr className={styles.processRow}>
      <Td className={styles.sessionCell}>
        <span className={styles.identity}>
          <ProviderMark provider={observation.provider} />
          <span className={styles.identityText}>
            <ExternalSessionCell
              basePath={basePath}
              observation={observation}
              title={title}
              tooltip={tooltip}
              attachRow={attachRow}
            />
            <span className={styles.details}>{provider}</span>
          </span>
        </span>
      </Td>
      <Td mono num className={styles.cellPid} data-label={t("agentsColumnPid")}>
        {observation.pid}
      </Td>
      <Td className={styles.cellStatus}>
        <Tag tone="attn">{t("agentsOutsideVibeAllDay")}</Tag>
      </Td>
      <ResourceCells
        observation={observation}
        sessionId={sessionId}
        live
        touchSurfaceRef={rowRef}
      />
      <Td actions className={styles.cellActions} />
    </Tr>
  );
}
