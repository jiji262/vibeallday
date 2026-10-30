import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import type { InboxItem } from "../../contexts/InboxContext";
import { useOptionalToastContext } from "../../contexts/ToastContext";
import { type MessageKey, useI18n } from "../../i18n";
import type { InputRequest, UserQuestionAnswers } from "../../types";

export type InputResponse = "approve" | "approve_accept_edits" | "deny";

export interface RespondOptions {
  answers?: UserQuestionAnswers;
  feedback?: string;
}

export interface PendingInput {
  request: InputRequest | null;
  /** The last answer was accepted and nothing new is pending yet. */
  answered: boolean;
  submitting: boolean;
  respond: (
    response: InputResponse,
    options?: RespondOptions,
  ) => Promise<boolean>;
}

interface Loaded {
  sessionId: string | null;
  request: InputRequest | null;
  answered: boolean;
}

const EMPTY: Loaded = { sessionId: null, request: null, answered: false };
const HTTP_BAD_REQUEST = 400;
const ASKING_TYPES: ReadonlySet<string> = new Set([
  "tool-approval",
  "user-question",
]);

/** Refetch whenever the summary reports a change in what the row waits on. */
function fetchKey(item: InboxItem | undefined): string | null {
  if (!item?.pendingInputType || !ASKING_TYPES.has(item.pendingInputType)) {
    return null;
  }
  return [item.sessionId, item.pendingInputType, item.updatedAt].join("\n");
}

function failureKey(
  response: InputResponse,
  options: RespondOptions,
): MessageKey {
  if (options.answers) return "sessionAnswerFailed";
  if (options.feedback) return "sessionFeedbackFailed";
  return response === "deny" ? "sessionDenyFailed" : "sessionApproveFailed";
}

/**
 * The pending approval or question behind a needs-you row, read from the
 * same endpoint the session page uses, so a card can answer it in place
 * without loading the transcript. Rows the session summary does not mark
 * as asking make no request.
 */
export function usePendingInput(item: InboxItem | undefined): PendingInput {
  const { t } = useI18n();
  const showToast = useOptionalToastContext()?.showToast;
  const sessionId = item?.sessionId ?? null;
  const key = fetchKey(item);
  const [loaded, setLoaded] = useState<Loaded>(EMPTY);
  const [submittingFor, setSubmittingFor] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const fetchToken = key ? `${key}\n${reloads}` : null;

  useEffect(() => {
    if (!fetchToken || !sessionId) return;
    let cancelled = false;
    api.getPendingInputRequest(sessionId).then(
      (result) => {
        if (cancelled) return;
        setLoaded({
          sessionId,
          request: result.request ?? null,
          answered: false,
        });
      },
      () => {
        if (!cancelled)
          setLoaded({ sessionId, request: null, answered: false });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fetchToken, sessionId]);

  // Until a refetch lands, keep the session's last request on screen.
  const current = loaded.sessionId === sessionId ? loaded : EMPTY;
  const request = key ? current.request : null;
  const latest = useRef({ request, sessionId });
  latest.current = { request, sessionId };

  const respond = useCallback(
    async (response: InputResponse, options: RespondOptions = {}) => {
      const { request: target, sessionId: id } = latest.current;
      if (!target || !id) return false;
      setSubmittingFor(id);
      try {
        const result = await api.respondToInput(
          id,
          target.id,
          response,
          options.answers,
          options.feedback,
        );
        const next = result.pendingInputRequest ?? null;
        setLoaded({ sessionId: id, request: next, answered: !next });
        return true;
      } catch (err) {
        const status = (err as { status?: number }).status;
        const fallback = t(failureKey(response, options));
        showToast?.(status ? `Error ${status}` : fallback, "error");
        if (status === HTTP_BAD_REQUEST) setReloads((n) => n + 1);
        return false;
      } finally {
        setSubmittingFor(null);
      }
    },
    [showToast, t],
  );

  return {
    request,
    answered: !!key && current.answered,
    submitting: !!sessionId && submittingFor === sessionId,
    respond,
  };
}
