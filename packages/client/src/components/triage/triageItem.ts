import type { InboxItem } from "../../contexts/InboxContext";
import type { MessageKey } from "../../i18n";
import { getSessionDisplayTitle } from "../../utils";

/** Why the item waits on the user, from the summary's pending input type. */
export function triageReasonKey(item: InboxItem): MessageKey {
  if (item.pendingInputType === "tool-approval") {
    return "inboxTriageReasonApproval";
  }
  if (item.pendingInputType === "user-question") {
    return "inboxTriageReasonQuestion";
  }
  return "inboxTriageReasonInput";
}

/** Short status pill text, shared with the Inbox rows. */
export function triageStatusKey(item: InboxItem): MessageKey {
  if (item.pendingInputType === "tool-approval") return "inboxStatusApproval";
  if (item.pendingInputType === "user-question") return "inboxStatusQuestion";
  return "inboxStatusNeedsYou";
}

export function triageTitle(item: InboxItem): string {
  return getSessionDisplayTitle({
    customTitle: item.customTitle,
    title: item.sessionTitle,
  });
}

export function triageSessionHref(basePath: string, item: InboxItem): string {
  // Same shape as SessionListItem's plain session link.
  return `${basePath}/projects/${item.projectId}/sessions/${item.sessionId}`;
}
