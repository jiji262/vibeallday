import { useEffect, useRef, useState } from "react";
import type { UseGlobalSessionsFeedResult } from "./useGlobalSessionsFeed";

type CatalogFeed = Pick<
  UseGlobalSessionsFeedResult,
  "loading" | "error" | "hasMore" | "loadMore"
>;

/** One settled request at a time, including when hasMore stays true for pages. */
export function useCompleteSessionCatalog(feed: CatalogFeed, rowCount: number) {
  const [page, setPage] = useState(0);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const lastAttempt = useRef<{
    loadMore: CatalogFeed["loadMore"];
    count: number;
  } | null>(null);
  useEffect(() => {
    void page;
    if (!feed.hasMore || feed.loading || feed.error) {
      lastAttempt.current = null;
      return;
    }
    if (pending.current) return;
    if (
      lastAttempt.current?.loadMore === feed.loadMore &&
      lastAttempt.current.count === rowCount
    )
      return;
    lastAttempt.current = { loadMore: feed.loadMore, count: rowCount };
    pending.current = true;
    // Pagination does not toggle loading. A settled-page render observes the
    // latest external-store rows and starts the next page only with progress.
    const settled = () => {
      pending.current = false;
      if (mounted.current) setPage((current) => current + 1);
    };
    void Promise.resolve(feed.loadMore()).then(settled, settled);
  }, [feed.hasMore, feed.loading, feed.error, feed.loadMore, page, rowCount]);
}
