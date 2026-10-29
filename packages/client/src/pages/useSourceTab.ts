import { useCallback } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import type { SourceTab } from "./SourceModeTabs";

/** Source-control modes with a built body (topic: source-review-to-session). */
export const SOURCE_TABS: readonly SourceTab[] = [
  "changes",
  "files",
  "comments",
];
export const SOURCE_TABS_WITH_REVIEWS: readonly SourceTab[] = [
  ...SOURCE_TABS,
  "reviews",
];

/**
 * Source-mode tab state, derived from the `?tab=` URL param. Shared by the
 * page intro's mode tabs, the repository status bar, and the page body, so
 * they all drive the same URL state.
 */
export function useSourceTab(reviewsEnabled = false): {
  tab: SourceTab;
  setTab: (next: SourceTab) => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const tabParam = searchParams.get("tab");
  const tab: SourceTab =
    tabParam === "files"
      ? "files"
      : tabParam === "comments"
        ? "comments"
        : tabParam === "reviews" && reviewsEnabled
          ? "reviews"
          : "changes";
  const setTab = useCallback(
    (next: SourceTab) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === "changes") params.delete("tab");
          else params.set("tab", next);
          params.delete("history");
          params.delete("rev");
          if (next !== "reviews") params.delete("submission");
          return params;
        },
        { state: location.state },
      );
    },
    [location.state, setSearchParams],
  );
  return { tab, setTab };
}
