import { useEffect, useState } from "react";
import {
  readComposerHistory,
  subscribeComposerHistory,
} from "../lib/composerHistory";

export interface RecentComposerPrompt {
  text: string;
  at: number;
}

const NONE: RecentComposerPrompt[] = [];

/** The newest prompts this account sent from this browser, newest first. */
export function useRecentComposerPrompts(
  scope: string | null,
  limit: number,
): RecentComposerPrompt[] {
  const [loaded, setLoaded] = useState<{
    scope: string;
    prompts: RecentComposerPrompt[];
  } | null>(null);
  useEffect(() => {
    if (!scope) return;
    let active = true;
    const load = () => {
      void readComposerHistory(scope)
        .then((history) => {
          if (active) {
            setLoaded({ scope, prompts: history.prompts.slice(0, limit) });
          }
        })
        // History is a convenience: an unreadable store shows no prompts.
        .catch(() => undefined);
    };
    load();
    const unsubscribe = subscribeComposerHistory(scope, load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [scope, limit]);
  return loaded?.scope === scope ? loaded.prompts : NONE;
}
