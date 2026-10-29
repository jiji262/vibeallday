import { useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";

/** React Router's key for the first entry of a fresh history stack. */
const INITIAL_HISTORY_KEY = "default";

/**
 * Back affordance for routes opened from a session (`?from=session`, R1):
 * return through history when this tab navigated here, otherwise fall back to
 * the session list. Returns `undefined` when the route was not opened from a
 * session, so callers can pass it straight to `PageHeader`'s `onBack`.
 */
export function useReturnToSession(): (() => void) | undefined {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const basePath = useRemoteBasePath();
  const fromSession = searchParams.get("from") === "session";
  const canGoBack = location.key !== INITIAL_HISTORY_KEY;
  const back = useCallback(() => {
    if (canGoBack) navigate(-1);
    else navigate(`${basePath}/sessions`);
  }, [basePath, canGoBack, navigate]);
  return fromSession ? back : undefined;
}
