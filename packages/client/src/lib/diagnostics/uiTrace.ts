import { clientLogCollector, isClientLogCollectionActive } from "./index";
import type { ClientLogRecorder } from "./ClientLogCollector";
import type { ClientSummarySourceKey } from "../clientSummaryStore";

type TraceDetails = Record<string, unknown>;

const HIGH_CHURN_TRACE_FLUSH_MS = 1_000;
const SESSION_UI_TRACE_PREFIX = "[SessionUITrace]";

interface HighChurnTraceBatch {
  recorder: ClientLogRecorder;
  timer: ReturnType<typeof setTimeout> | null;
  startedAt: number;
  total: number;
  counts: Record<string, number>;
  sessionId?: unknown;
  firstEventId?: unknown;
  lastEventId?: unknown;
}

let highChurnTraceBatch: HighChurnTraceBatch | null = null;

function safeStringify(details: TraceDetails): string {
  try {
    return JSON.stringify(details);
  } catch {
    return JSON.stringify({ unserializable: true });
  }
}

function getHighChurnTraceKey(
  event: string,
  details: TraceDetails,
): string | null {
  if (event === "session-stream-event") {
    const eventType = details.eventType;
    const sdkType = details.sdkType;
    if (eventType === "message" && sdkType === "stream_event") {
      return "stream:message:stream_event";
    }
    if (eventType === "pending" || eventType === "markdown-augment") {
      return `stream:${String(eventType)}`;
    }
  }

  if (event === "session-stream-dispatch") {
    const eventType = details.eventType;
    const sdkType = details.sdkType;
    if (eventType === "message" && sdkType === "stream_event") {
      return "dispatch:message:stream_event";
    }
    if (eventType === "pending" || eventType === "markdown-augment") {
      return `dispatch:${String(eventType)}`;
    }
  }

  return null;
}

function recordSessionTrace(
  details: TraceDetails,
  recorder: Pick<ClientLogRecorder, "record">,
): void {
  recorder.record(
    "log",
    SESSION_UI_TRACE_PREFIX,
    `${SESSION_UI_TRACE_PREFIX} ${safeStringify(details)}`,
  );
}

function flushHighChurnTraceBatch(): void {
  const batch = highChurnTraceBatch;
  if (!batch) return;
  highChurnTraceBatch = null;
  if (batch.timer) {
    clearTimeout(batch.timer);
  }
  recordSessionTrace(
    {
      event: "session-ui-trace-batch",
      sessionId: batch.sessionId,
      total: batch.total,
      counts: batch.counts,
      windowMs: Date.now() - batch.startedAt,
      firstEventId: batch.firstEventId ?? null,
      lastEventId: batch.lastEventId ?? null,
    },
    batch.recorder,
  );
}

function recordHighChurnTrace(
  key: string,
  details: TraceDetails,
  recorder: ClientLogRecorder,
): void {
  if (
    highChurnTraceBatch &&
    (highChurnTraceBatch.recorder.key !== recorder.key ||
      highChurnTraceBatch.recorder.generation !== recorder.generation)
  )
    flushHighChurnTraceBatch();
  if (!highChurnTraceBatch) {
    highChurnTraceBatch = {
      recorder,
      timer: null,
      startedAt: Date.now(),
      total: 0,
      counts: {},
      sessionId: details.sessionId,
      firstEventId: details.eventId,
    };
    highChurnTraceBatch.timer = setTimeout(
      flushHighChurnTraceBatch,
      HIGH_CHURN_TRACE_FLUSH_MS,
    );
  }
  highChurnTraceBatch.total += 1;
  highChurnTraceBatch.counts[key] = (highChurnTraceBatch.counts[key] ?? 0) + 1;
  highChurnTraceBatch.lastEventId = details.eventId;
}

export function logSessionUiTrace(
  event: string,
  details: TraceDetails = {},
  recorder = clientLogCollector.captureRecorder(),
): void {
  if (!isClientLogCollectionActive() || !recorder) return;
  const highChurnKey = getHighChurnTraceKey(event, details);
  if (highChurnKey) {
    recordHighChurnTrace(highChurnKey, details, recorder);
    return;
  }
  recordSessionTrace(
    {
      event,
      ...details,
    },
    recorder,
  );
}

export function createSessionUiTrace(recorder: ClientLogRecorder | null) {
  return (event: string, details: TraceDetails = {}) =>
    logSessionUiTrace(event, details, recorder);
}

export function createSourceSessionUiTrace(
  sourceKey: ClientSummarySourceKey,
  destination: string | null,
) {
  return (event: string, details: TraceDetails = {}) => {
    const recorder = clientLogCollector.captureRecorder(sourceKey);
    if (recorder?.key !== destination) return;
    logSessionUiTrace(event, details, recorder);
  };
}
