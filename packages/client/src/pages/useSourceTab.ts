import { useCallback } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import type { SourceTab, SourceViewTab } from "./SourceModeTabs";

/** The tab strip (topic: source-review-to-session): history and review views. */
export const SOURCE_VIEW_TABS: readonly SourceViewTab[] = [
  "changes",
  "history",
  "files",
  "review",
];

/** `history=0` keeps Changes on the working tree despite the clean landing. */
const HISTORY_SUPPRESSED = "0";

export interface SourceTabOptions {
  reviewsEnabled?: boolean;
  /** The tree is clean and the clean landing opens the latest commit. */
  cleanLatestLanding?: boolean;
}

/** Body mode from `?tab=`; `reviews` only exists behind the review opt-in. */
function bodyTab(param: string | null, reviewsEnabled: boolean): SourceTab {
  if (param === "files" || param === "comments") return param;
  if (param === "reviews" && reviewsEnabled) return "reviews";
  return "changes";
}

/**
 * Whether the Changes mode shows commit history with its revision list:
 * an explicit `history=1`, the legacy `tab=commits`, or the clean landing.
 */
export function isHistoryListOpen(
  params: URLSearchParams,
  cleanLatestLanding: boolean,
): boolean {
  if (params.get("history") === "1" || params.get("tab") === "commits") {
    return true;
  }
  return (
    cleanLatestLanding &&
    params.get("history") !== HISTORY_SUPPRESSED &&
    !params.has("rev") &&
    !params.has("worktreeFile")
  );
}

function viewTab(
  tab: SourceTab,
  params: URLSearchParams,
  cleanLatestLanding: boolean,
): SourceViewTab {
  if (tab === "comments" || tab === "reviews") return "review";
  if (tab === "files") return "files";
  return params.has("rev") || isHistoryListOpen(params, cleanLatestLanding)
    ? "history"
    : "changes";
}

/** URL edit for a tab click; a real history step so Back returns. */
function applyViewTab(
  prev: URLSearchParams,
  next: SourceViewTab,
  options: Required<SourceTabOptions>,
): URLSearchParams {
  const params = new URLSearchParams(prev);
  params.delete("history");
  params.delete("rev");
  if (next === "changes" || next === "history") params.delete("tab");
  else if (next === "files") params.set("tab", "files");
  else if (!(params.get("tab") === "reviews" && options.reviewsEnabled)) {
    params.set("tab", "comments");
  }
  if (next === "history") params.set("history", "1");
  if (next === "changes" && options.cleanLatestLanding) {
    params.set("history", HISTORY_SUPPRESSED);
  }
  if (params.get("tab") !== "reviews") params.delete("submission");
  return params;
}

/**
 * Source-mode tab state, derived from the URL. `tab` is the body mode
 * (`?tab=`), `view` the selected strip tab. Shared by the page intro's tabs,
 * the repository status bar, and the page body, so they drive one URL state.
 */
export function useSourceTab(options: SourceTabOptions = {}): {
  tab: SourceTab;
  view: SourceViewTab;
  setTab: (next: SourceTab) => void;
  setView: (next: SourceViewTab) => void;
} {
  const reviewsEnabled = options.reviewsEnabled ?? false;
  const cleanLatestLanding = options.cleanLatestLanding ?? false;
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const tab = bodyTab(searchParams.get("tab"), reviewsEnabled);
  const view = viewTab(tab, searchParams, cleanLatestLanding);
  const setView = useCallback(
    (next: SourceViewTab) => {
      setSearchParams(
        (prev) =>
          applyViewTab(prev, next, { reviewsEnabled, cleanLatestLanding }),
        { state: location.state },
      );
    },
    [cleanLatestLanding, location.state, reviewsEnabled, setSearchParams],
  );
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
  return { tab, view, setTab, setView };
}
