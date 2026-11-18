import { generateUUID } from "../uuid";
import { getSessionTranscriptMemoryStats } from "../sessionDetail/sessionDetailStore";

export function clientTelemetryMessage(includePath: boolean): string {
  const perf = window.performance as Performance & {
    memory?: {
      jsHeapSizeLimit?: number;
      totalJSHeapSize?: number;
      usedJSHeapSize?: number;
    };
  };
  const memory = perf.memory;
  const payload = {
    path: includePath ? window.location.pathname : undefined,
    visibility:
      typeof document !== "undefined" ? document.visibilityState : "unknown",
    memory: memory
      ? {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
        }
      : null,
    dom:
      typeof document !== "undefined"
        ? {
            nodes: document.getElementsByTagName("*").length,
            messageRows: document.querySelectorAll(".message-render-row")
              .length,
            streamingBlocks:
              document.querySelectorAll(".streaming-block").length,
            toolRows: document.querySelectorAll(".tool-row").length,
          }
        : null,
    // Attributes multi-day heap growth to transcript-store retention vs
    // DOM/other without needing a live heap snapshot from the device.
    transcriptMemory: getSessionTranscriptMemoryStats(),
  };
  return `[ClientTelemetry] ${JSON.stringify(payload)}`;
}

const DEVICE_ID_KEY = "vibeallday-device-id";
const TAB_ID_KEY = "vibeallday-tab-id";

function getDeviceId(): string | undefined {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = generateUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

/**
 * Session storage is per tab and survives that tab's reloads, which is exactly
 * the identity a growth curve needs: one series per window, continuous across
 * a reload the reader performed.
 */
function getTabId(): string | undefined {
  try {
    let id = sessionStorage.getItem(TAB_ID_KEY);
    if (!id) {
      id = generateUUID();
      sessionStorage.setItem(TAB_ID_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

export function clientLogIdentity() {
  return { deviceId: getDeviceId(), tabId: getTabId() };
}
