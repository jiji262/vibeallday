import { useCallback, useEffect, useRef, useState } from "react";

/** Starts this far below the fold so the next page is ready before it shows. */
const PREFETCH_MARGIN = "400px 0px";

/**
 * Reveal a long list a page at a time: `visible` grows by `pageSize` whenever
 * the sentinel scrolls near view, and returns to one page when `resetKey`
 * changes (a new filter or order starts from the top). Without
 * IntersectionObserver the sentinel's own button still pages.
 */
export function useIncrementalReveal(
  total: number,
  pageSize: number,
  resetKey: string,
) {
  const [state, setState] = useState({ key: resetKey, count: pageSize });
  const count = state.key === resetKey ? state.count : pageSize;
  const visible = Math.min(count, total);
  const hasMore = visible < total;
  const showMore = useCallback(
    () =>
      setState((previous) => ({
        key: resetKey,
        count:
          (previous.key === resetKey ? previous.count : pageSize) + pageSize,
      })),
    [resetKey, pageSize],
  );
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Each revealed page must re-observe a sentinel that remains intersecting.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || typeof IntersectionObserver === "undefined")
      return;
    // Recreated per page, so a sentinel still in view after a page lands
    // reports again and keeps paging until the list fills past the fold.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) showMore();
      },
      { rootMargin: PREFETCH_MARGIN },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, showMore, visible]);
  return { visible, hasMore, showMore, sentinelRef };
}
