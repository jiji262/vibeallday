import { useLayoutEffect, useRef, useState } from "react";

export type SessionHeaderLayout = "full" | "compact" | "narrow";

/**
 * Header width that still leaves the title an inline-rename row (420px)
 * after the state pill and the Changes shortcut take their share.
 */
const ROOMY_HEADER_MIN_WIDTH = 1120;

/** Fixed tiers depend on the header column, including a docked sidebar/pane. */
export function useSessionHeaderLayout() {
  const headerRef = useRef<HTMLElement>(null);
  const [layout, setLayout] = useState<SessionHeaderLayout>("narrow");
  const [roomy, setRoomy] = useState(false);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () => {
      const width = header.getBoundingClientRect().width;
      setLayout(width >= 720 ? "full" : width >= 600 ? "compact" : "narrow");
      setRoomy(width >= ROOMY_HEADER_MIN_WIDTH);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  /** `roomy`: the title keeps its rename room beside the optional extras. */
  return { headerRef, layout, roomy };
}
