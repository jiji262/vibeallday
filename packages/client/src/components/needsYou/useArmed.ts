import { useEffect, useState } from "react";

/** Same guard as the session approval panel. */
export const CLICK_PROTECTION_MS = 150;

/**
 * True once `requestId` has been on screen briefly, so a click or key meant
 * for the previous card cannot answer a request that just appeared.
 */
export function useArmed(requestId: string | undefined): boolean {
  const [armedId, setArmedId] = useState<string | null>(null);
  useEffect(() => {
    if (!requestId) return;
    const timer = setTimeout(() => setArmedId(requestId), CLICK_PROTECTION_MS);
    return () => clearTimeout(timer);
  }, [requestId]);
  return !!requestId && armedId === requestId;
}
