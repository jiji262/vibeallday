import {
  getSessionDisplayTitle,
  type ProviderChildSessionSummary,
} from "@vibeallday/shared";
import { useEffect, useState } from "react";
import { api } from "../../api/client";

export interface ParentSessionInfo {
  title?: string;
  providerChildren?: ProviderChildSessionSummary[];
}

/**
 * One metadata read of a child's parent session, for its title and sibling
 * list. A failed read leaves both undefined; callers fall back to generic
 * copy and hide the sibling switcher.
 */
export function useParentSession(
  projectId: string,
  sessionId: string,
): ParentSessionInfo {
  const [info, setInfo] = useState<ParentSessionInfo>({});
  useEffect(() => {
    let cancelled = false;
    setInfo({});
    api.getSessionMetadata(projectId, sessionId).then(
      ({ session }) => {
        if (cancelled) return;
        const hasTitle = Boolean(session.customTitle ?? session.title);
        setInfo({
          title: hasTitle ? getSessionDisplayTitle(session) : undefined,
          providerChildren: session.providerChildren,
        });
      },
      () => {
        // Breadcrumb and siblings are optional context; the child still loads.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [projectId, sessionId]);
  return info;
}
