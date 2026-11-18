import {
  subscribeClientSummarySourceKey,
  type ClientSummarySourceKey,
} from "../clientSummaryStore";
import type { ResumeObservation } from "../resumeDiagnostics";
import { getSourceRuntimeRegistry } from "../sourceRuntime";
import { ClientLogQueue } from "./ClientLogQueue";
import {
  captureClientLogTarget,
  isCurrentClientLogTarget,
  observationMatchesTarget,
  canCaptureConsoleForCurrentTarget,
} from "./ClientLogTarget";
import { clientLogIdentity, clientTelemetryMessage } from "./clientTelemetry";
import { consoleLogMessage } from "./scopedConsole";

export interface ClientLogRecorder {
  key: string;
  generation: number;
  record(level: string, prefix: string, message: string): void;
}

const FLUSH_DEBOUNCE_MS = 1000;
const TELEMETRY_INTERVAL_MS = 15_000;
export class ClientLogCollector {
  private _generation = 0;
  private _recorder: ClientLogRecorder | null = null;
  private _queue: ClientLogQueue | null = null;
  private _started = false;
  private _flushPromise: Promise<void> | null = null;
  private _flushAgain = false;
  private _deviceId: string | undefined;
  private _tabId: string | undefined;
  private _origLog: typeof console.log | null = null;
  private _origWarn: typeof console.warn | null = null;
  private _origError: typeof console.error | null = null;
  private _unsubscribeStatus: (() => void) | null = null;
  private _unsubscribeSourceKey: (() => void) | null = null;
  private _errorHandler: ((e: ErrorEvent) => void) | null = null;
  private _rejectionHandler: ((e: PromiseRejectionEvent) => void) | null = null;
  private _flushTimer: ReturnType<typeof setTimeout> | null = null;
  private _telemetryTimer: ReturnType<typeof setInterval> | null = null;

  async start(): Promise<void> {
    if (this._started) return;
    this._started = true;
    this._generation += 1;
    const identity = clientLogIdentity();
    this._deviceId = identity.deviceId;
    this._tabId = identity.tabId;

    const queue = new ClientLogQueue();
    this._queue = queue;
    await queue.open();
    if (!this._started || this._queue !== queue) return;

    this._wrapConsole();
    this._writeEntry(
      "info",
      "[ClientInfo]",
      `[ClientInfo] ${navigator.userAgent} | ${window.screen.width}x${window.screen.height} | dpr=${window.devicePixelRatio} | lang=${navigator.language}`,
    );
    this._writeTelemetryEntry();
    this._startTelemetry();

    this._subscribeCurrentTransportStatus();
    this._unsubscribeSourceKey = subscribeClientSummarySourceKey(() => {
      this._subscribeCurrentTransportStatus();
    });
  }

  stop(): void {
    if (!this._started) return;
    this._started = false;

    this._restoreConsole();

    this._unsubscribeStatus?.();
    this._unsubscribeStatus = null;
    this._unsubscribeSourceKey?.();
    this._unsubscribeSourceKey = null;
    this._clearScheduledFlush();
    this._stopTelemetry();
    this._queue?.close();
    this._queue = null;
  }

  record(level: string, prefix: string, message: string): void {
    if (!this._started) return;
    this._writeEntry(level, prefix, message);
  }

  captureRecorder(
    sourceKey?: ClientSummarySourceKey,
  ): ClientLogRecorder | null {
    const queue = this._queue;
    if (!this._started || !queue) return null;
    const target = captureClientLogTarget(sourceKey);
    if (!target) return null;
    if (
      this._recorder?.key === target.key &&
      this._recorder.generation === this._generation
    )
      return this._recorder;
    this._recorder = {
      key: target.key,
      generation: this._generation,
      record: (level, prefix, message) => {
        if (!this._started || this._queue !== queue) return;
        queue.add(target.key, {
          timestamp: Date.now(),
          level,
          prefix,
          message,
          tabId: this._tabId,
        });
        this._scheduleFlush();
      },
    };
    return this._recorder;
  }

  recordResumeObservation(event: ResumeObservation): void {
    const target = captureClientLogTarget();
    if (target && observationMatchesTarget(event, target.scope)) {
      this.record("info", "SrpResume", JSON.stringify(event));
    }
  }

  flush(): Promise<void> {
    this._flushAgain = true;
    this._flushPromise ??= this._flushLoop().finally(() => {
      this._flushPromise = null;
    });
    return this._flushPromise;
  }

  private async _flushLoop(): Promise<void> {
    do {
      this._flushAgain = false;
      await this._doFlush();
    } while (this._flushAgain && this._started);
  }

  private async _doFlush(): Promise<void> {
    const queue = this._queue;
    const target = captureClientLogTarget();
    if (
      !this._started ||
      !queue ||
      !target ||
      target.transport.status.getSnapshot().state !== "ready"
    )
      return;
    const batch = await queue.take(target.key);
    if (
      !batch?.entries.length ||
      !this._started ||
      this._queue !== queue ||
      !isCurrentClientLogTarget(target)
    )
      return;
    try {
      await target.fetch({
        method: "POST",
        body: JSON.stringify({
          entries: batch.entries,
          deviceId: this._deviceId,
        }),
      });
      await batch.acknowledge();
    } catch {
      /* 失败批次留在原队列，重试时仍验证目的地。 */
    }
  }

  private _writeEntry(level: string, prefix: string, message: string): void {
    this.captureRecorder()?.record(level, prefix, message);
  }

  private _scheduleFlush(): void {
    if (!this._started || !this._isCurrentTransportReady()) return;
    if (this._flushTimer) return;
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null;
      void this.flush();
    }, FLUSH_DEBOUNCE_MS);
  }

  private _clearScheduledFlush(): void {
    if (!this._flushTimer) return;
    clearTimeout(this._flushTimer);
    this._flushTimer = null;
  }

  private _startTelemetry(): void {
    this._stopTelemetry();
    this._telemetryTimer = setInterval(() => {
      this._writeTelemetryEntry();
    }, TELEMETRY_INTERVAL_MS);
  }

  private _stopTelemetry(): void {
    if (!this._telemetryTimer) return;
    clearInterval(this._telemetryTimer);
    this._telemetryTimer = null;
  }

  private _subscribeCurrentTransportStatus(): void {
    this._unsubscribeStatus?.();
    this._unsubscribeStatus = null;
    if (!this._started) return;

    const transport =
      getSourceRuntimeRegistry().getCurrentSourceRuntime().transport;
    this._unsubscribeStatus = transport.status.subscribe(() => {
      if (this._isCurrentTransportReady()) void this.flush();
    });
    if (this._isCurrentTransportReady()) void this.flush();
  }

  private _isCurrentTransportReady(): boolean {
    return (
      getSourceRuntimeRegistry()
        .getCurrentSourceRuntime()
        .transport.status.getSnapshot().state === "ready"
    );
  }

  private _writeTelemetryEntry(): void {
    if (!this._started || typeof window === "undefined") return;
    this._writeEntry(
      "info",
      "[ClientTelemetry]",
      clientTelemetryMessage(captureClientLogTarget()?.scope === null),
    );
  }

  private _wrapConsole(): void {
    this._origLog = console.log;
    this._origWarn = console.warn;
    this._origError = console.error;

    console.log = (...args: unknown[]) => {
      this._capture("log", args);
      this._origLog?.apply(console, args);
    };
    console.warn = (...args: unknown[]) => {
      this._capture("warn", args);
      this._origWarn?.apply(console, args);
    };
    console.error = (...args: unknown[]) => {
      this._capture("error", args);
      this._origError?.apply(console, args);
    };

    // Capture unhandled exceptions and promise rejections
    this._errorHandler = (e: ErrorEvent) => {
      const msg =
        e.error instanceof Error
          ? (e.error.stack ?? e.error.message)
          : e.message;
      this._capture("error", [`[UncaughtError] ${msg}`]);
    };
    this._rejectionHandler = (e: PromiseRejectionEvent) => {
      const reason =
        e.reason instanceof Error
          ? (e.reason.stack ?? e.reason.message)
          : String(e.reason);
      this._capture("error", [`[UnhandledRejection] ${reason}`]);
    };
    window.addEventListener("error", this._errorHandler);
    window.addEventListener("unhandledrejection", this._rejectionHandler);
  }

  private _restoreConsole(): void {
    if (this._origLog) console.log = this._origLog;
    if (this._origWarn) console.warn = this._origWarn;
    if (this._origError) console.error = this._origError;
    this._origLog = null;
    this._origWarn = null;
    this._origError = null;

    if (this._errorHandler) {
      window.removeEventListener("error", this._errorHandler);
      this._errorHandler = null;
    }
    if (this._rejectionHandler) {
      window.removeEventListener("unhandledrejection", this._rejectionHandler);
      this._rejectionHandler = null;
    }
  }

  /** Capture all warn/error messages unconditionally */
  private _capture(level: string, args: unknown[]): void {
    if (!canCaptureConsoleForCurrentTarget()) return;
    const entry = consoleLogMessage(args);
    if (entry) this._writeEntry(level, entry.prefix, entry.message);
  }
}
