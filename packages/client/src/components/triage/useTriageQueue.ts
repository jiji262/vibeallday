import { useCallback, useEffect, useMemo, useState } from "react";
import type { InboxItem } from "../../contexts/InboxContext";
import {
  mergeSeen,
  readTriageProgress,
  skipItem,
  type TriageProgress,
  triageCounts,
  triageOrder,
} from "./triageQueue";

/**
 * Triage state over the live needs-you rows. `restored` is the /triage
 * history state, so returning from a session keeps the handled count and
 * the skip order.
 */
export function useTriageQueue(items: readonly InboxItem[], restored: unknown) {
  const [progress, setProgress] = useState<TriageProgress>(() =>
    readTriageProgress(restored),
  );
  const liveIds = useMemo(() => items.map((item) => item.sessionId), [items]);
  const seen = mergeSeen(progress.seen, liveIds);
  useEffect(() => {
    if (seen === progress.seen) return;
    setProgress((prev) => ({ ...prev, seen: mergeSeen(prev.seen, liveIds) }));
  }, [seen, progress.seen, liveIds]);

  const order = useMemo(() => {
    const byId = new Map(items.map((item) => [item.sessionId, item]));
    return triageOrder(liveIds, progress.skipped).flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
  }, [items, liveIds, progress.skipped]);

  const currentId = order[0]?.sessionId;
  const skipCurrent = useCallback(() => {
    if (currentId) setProgress((prev) => skipItem(prev, currentId));
  }, [currentId]);

  return {
    progress: { ...progress, seen },
    order,
    counts: triageCounts(seen, liveIds),
    skipCurrent,
  };
}
