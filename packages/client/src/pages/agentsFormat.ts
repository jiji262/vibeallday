import type { HostAgentProcessObservation } from "@vibeallday/shared";
import type { BadgeTone } from "../components/garden/Badge";
import type { ProcessInfo } from "../hooks/useProcesses";
import type { MessageKey } from "../i18n";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const BYTES_PER_MEBIBYTE = 1024 * 1024;
const MEBIBYTES_PER_GIBIBYTE = 1024;
/** Below this value one decimal place still carries information. */
const ONE_DECIMAL_LIMIT = 10;

type Translate = (key: MessageKey) => string;

/** Uptime from `startedAt` to now, two most significant units. */
export function formatUptime(startedAt: string): string {
  const diffMs = Date.now() - new Date(startedAt).getTime();
  const seconds = Math.floor(diffMs / MS_PER_SECOND);
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const days = Math.floor(hours / HOURS_PER_DAY);
  if (days > 0) return `${days}d ${hours % HOURS_PER_DAY}h`;
  if (hours > 0) return `${hours}h ${minutes % MINUTES_PER_HOUR}m`;
  if (minutes > 0) return `${minutes}m ${seconds % SECONDS_PER_MINUTE}s`;
  return `${seconds}s`;
}

export function formatMemory(bytes: number): string {
  const mebibytes = bytes / BYTES_PER_MEBIBYTE;
  if (mebibytes < MEBIBYTES_PER_GIBIBYTE) {
    return `${Math.round(mebibytes)} MiB`;
  }
  const gibibytes = mebibytes / MEBIBYTES_PER_GIBIBYTE;
  return `${gibibytes < ONE_DECIMAL_LIMIT ? gibibytes.toFixed(1) : Math.round(gibibytes)} GiB`;
}

export function formatCpu(percent: number): string {
  return `${percent < ONE_DECIMAL_LIMIT ? percent.toFixed(1) : Math.round(percent)}%`;
}

export function formatSeconds(ms: number): string {
  return (ms / MS_PER_SECOND).toFixed(1);
}

const STATE_LABEL_KEYS: Record<string, MessageKey> = {
  "in-turn": "agentsRunning",
  running: "agentsRunning",
  "waiting-input": "agentsNeedsInput",
  idle: "agentsIdle",
  terminated: "agentsStopped",
};

const STATE_TONES: Record<string, BadgeTone> = {
  "in-turn": "mint",
  running: "mint",
  "waiting-input": "rose",
  idle: "grey",
  terminated: "outline",
};

export function getStateLabel(state: string, t: Translate): string {
  const key = STATE_LABEL_KEYS[state];
  return key ? t(key) : state;
}

export function getStateTone(state: string): BadgeTone {
  return STATE_TONES[state] ?? "grey";
}

const PROVIDER_LABELS: Record<string, string> = {
  claude: "Claude",
  "claude-gateway": "Claude Gateway",
  "claude-ollama": "Claude + Ollama",
  codex: "Codex",
  gemini: "Gemini",
  "gemini-acp": "Gemini",
  grok: "Grok",
  opencode: "OpenCode",
  pi: "Pi",
};

export function getProviderLabel(
  provider: string | undefined,
  t: Translate,
): string {
  if (provider === "local") return t("agentsProviderLocal");
  if (provider === undefined) return PROVIDER_LABELS.claude ?? "";
  return PROVIDER_LABELS[provider] ?? provider;
}

/** Case-insensitive match on session title or id, project name, or PID. */
export function processMatchesQuery(process: ProcessInfo, query: string) {
  const fields = [
    process.sessionTitle,
    process.sessionId,
    process.projectName,
    process.pid === undefined ? undefined : String(process.pid),
  ];
  return fields.some((field) => field?.toLowerCase().includes(query));
}

export function observationMatchesQuery(
  observation: HostAgentProcessObservation,
  query: string,
) {
  const fields = [
    observation.sessionTitle,
    observation.sessionId,
    observation.provider,
    String(observation.pid),
  ];
  return fields.some((field) => field?.toLowerCase().includes(query));
}
