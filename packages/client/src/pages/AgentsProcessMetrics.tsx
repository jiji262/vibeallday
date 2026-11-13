import type { HostAgentProcessObservation } from "@vibeallday/shared";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useI18n } from "../i18n";
import styles from "./AgentsPage.module.css";
import {
  formatCpu,
  formatMemory,
  formatSeconds,
  formatUptime,
  getProviderLabel,
} from "./agentsFormat";

const INTERACTIVE_SELECTOR =
  "a, button, input, select, textarea, [role='button'], [role='link']";

type Translate = ReturnType<typeof useI18n>["t"];

function metricsDetail(
  observation: HostAgentProcessObservation,
  sessionId: string | undefined,
  t: Translate,
): string {
  const { cpu, memory } = observation;
  return [
    t(
      observation.supervision === "vibeallday"
        ? "agentsMetricsManagedVibeAllDay"
        : "agentsMetricsManagedExternal",
    ),
    ...(sessionId ? [t("agentsMetricsSession", { id: sessionId })] : []),
    t("agentsMetricsProvider", {
      provider: getProviderLabel(observation.provider, t),
    }),
    t("agentsPid", { pid: observation.pid }),
    t("agentsMetricsStarted", {
      value: new Date(observation.startedAt).toLocaleString(),
    }),
    t("agentsMetricsAge", { value: formatUptime(observation.startedAt) }),
    cpu
      ? t("agentsMetricsRecentCpu", {
          percent: formatCpu(cpu.rootPercent),
          treePercent: formatCpu(cpu.treePercent),
          seconds: formatSeconds(cpu.windowMs),
        })
      : t("agentsMetricsCpuSampling"),
    t("agentsMetricsRootRss", { value: formatMemory(memory.rootRssBytes) }),
    t("agentsMetricsTreeRss", { value: formatMemory(memory.treeRssBytes) }),
    t("agentsMetricsDescendants", { count: memory.descendantCount }),
    t("agentsMetricsSampled", {
      value: new Date(observation.sampledAt).toLocaleTimeString(),
    }),
  ].join("\n");
}

/** Closes the popover on an outside pointer or Escape. */
function useDismiss({
  open,
  close,
  wrapper,
  surface,
}: {
  open: boolean;
  close: () => void;
  wrapper: RefObject<HTMLElement | null>;
  surface?: RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      const onSurface =
        event.pointerType === "touch" &&
        surface?.current?.contains(event.target);
      if (!wrapper.current?.contains(event.target) && !onSurface) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, close, wrapper, surface]);
}

/** A quiet tap on the row (not on a control) toggles the popover on touch. */
function useSurfaceToggle(
  surface: RefObject<HTMLElement | null> | undefined,
  wrapper: RefObject<HTMLElement | null>,
  toggle: () => void,
) {
  useEffect(() => {
    const element = surface?.current;
    if (!element) return;
    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || !(event.target instanceof Node)) {
        return;
      }
      if (wrapper.current?.contains(event.target)) return;
      const interactive =
        event.target instanceof Element
          ? event.target.closest(INTERACTIVE_SELECTOR)
          : null;
      if (!interactive) toggle();
    };
    element.addEventListener("pointerup", handlePointerUp);
    return () => element.removeEventListener("pointerup", handlePointerUp);
  }, [surface, wrapper, toggle]);
}

interface ProcessMetricsProps {
  observation: HostAgentProcessObservation;
  sessionId?: string;
  touchSurfaceRef?: RefObject<HTMLElement | null>;
}

/** Root RSS chip with a detail popover sampled from the host. */
export function ProcessMetrics({
  observation,
  sessionId,
  touchSurfaceRef,
}: ProcessMetricsProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((value) => !value), []);
  useDismiss({ open, close, wrapper: wrapperRef, surface: touchSurfaceRef });
  useSurfaceToggle(touchSurfaceRef, wrapperRef, toggle);
  const detail = metricsDetail(observation, sessionId, t);

  return (
    <span className={styles.metricsWrap} ref={wrapperRef}>
      <button
        type="button"
        className={styles.metrics}
        title={detail}
        aria-label={detail}
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggle();
        }}
      >
        <span>{formatMemory(observation.memory.rootRssBytes)} RSS</span>
      </button>
      {open && (
        <span className={styles.metricsPopover} role="status">
          {detail}
        </span>
      )}
    </span>
  );
}
