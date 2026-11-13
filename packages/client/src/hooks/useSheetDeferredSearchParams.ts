import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MODAL_HISTORY_STATE_KEY } from "../components/ui/Modal";

type ParamsUpdate = (previous: URLSearchParams) => URLSearchParams;

function currentModalEntry(): unknown {
  return window.history.state?.[MODAL_HISTORY_STATE_KEY];
}

/**
 * URL search params that a history-owning sheet can edit without forking
 * history. An open sheet sits on its own same-address entry. Replacing the
 * address there leaves the page's entry underneath with the old query, so a
 * Back-gesture close reverts every choice; and the sheet no longer recognizes
 * its entry, so a button close leaves it behind for the next Back to step
 * through. While `deferring`, writes collect in a draft that reads as the
 * current params, and once the sheet's entry is gone the draft replaces the
 * page's own address.
 */
export function useSheetDeferredSearchParams(deferring: boolean) {
  const [urlParams, setUrlParams] = useSearchParams();
  const [draft, setDraft] = useState<URLSearchParams | null>(null);
  const sheetEntry = useRef<unknown>(undefined);

  // Child effects run first, so the sheet's Modal has pushed its entry here.
  useEffect(() => {
    if (deferring) sheetEntry.current = currentModalEntry();
  }, [deferring]);

  useEffect(() => {
    if (deferring || !draft) return;
    const commit = () => {
      setUrlParams(draft, { replace: true });
      setDraft(null);
    };
    // A Back-gesture close has popped the sheet's entry already; a button or
    // Escape close pops it right after this commit.
    const entry = currentModalEntry();
    if (entry === undefined || entry !== sheetEntry.current) {
      commit();
      return;
    }
    window.addEventListener("popstate", commit, { once: true });
    return () => window.removeEventListener("popstate", commit);
  }, [deferring, draft, setUrlParams]);

  const setParams = useCallback(
    (update: ParamsUpdate) => {
      if (!deferring) {
        setUrlParams(update, { replace: true });
        return;
      }
      setDraft((previous) =>
        update(new URLSearchParams(previous ?? urlParams)),
      );
    },
    [deferring, urlParams, setUrlParams],
  );

  return [draft ?? urlParams, setParams] as const;
}
