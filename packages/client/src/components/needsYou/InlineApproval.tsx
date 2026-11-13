import { type ReactNode, useMemo } from "react";
import { useI18n } from "../../i18n";
import { Button } from "../garden/Button";
import { Kbd } from "../garden/Kbd";
import { DenyReasonForm } from "./DenyReasonForm";
import styles from "./NeedsYouInline.module.css";
import { approvalPreview, type InlineAsk } from "./pendingInputModel";
import type { InputResponse, RespondOptions } from "./usePendingInput";

type ApprovalAsk = Extract<InlineAsk, { kind: "approval" }>;

/** Triage asks for a reason before denying; Inbox denies at once. */
export interface DenyReasonControl {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface InlineApprovalProps {
  ask: ApprovalAsk;
  projectPath?: string;
  armed: boolean;
  submitting: boolean;
  onRespond: (
    response: InputResponse,
    options?: RespondOptions,
  ) => Promise<boolean>;
  reason?: DenyReasonControl;
  /** Show the A / D keys beside their buttons. */
  keyHints?: boolean;
  /** Phones decide from a page bar instead (Triage). */
  phoneDock?: boolean;
  trailing?: ReactNode;
}

function KeyHint({ show, label }: { show: boolean; label: string }) {
  if (!show) return null;
  return (
    <span className={styles.kbd} aria-hidden="true">
      <Kbd>{label}</Kbd>
    </span>
  );
}

/** The command (or target) being approved, with the agent's reason. */
export function ApprovalPreviewBlock({
  ask,
  projectPath,
}: {
  ask: ApprovalAsk;
  projectPath?: string;
}) {
  const preview = useMemo(
    () => approvalPreview(ask.request, projectPath),
    [ask.request, projectPath],
  );
  return (
    <>
      {preview.caption && <p className={styles.caption}>{preview.caption}</p>}
      {preview.code && <pre className={styles.code}>{preview.code}</pre>}
    </>
  );
}

/**
 * Approve once, allow edits for the session (edit tools only, as in the
 * session panel), or deny, without leaving the list.
 */
export function InlineApproval(props: InlineApprovalProps) {
  const { t } = useI18n();
  const { ask, armed, submitting, onRespond, reason, keyHints = false } = props;
  const disabled = !armed || submitting;
  const docked = props.phoneDock ? styles.phoneDocked : undefined;
  const reasonOpen = !!reason?.open;
  const deny = () =>
    reason ? reason.onOpenChange(true) : void onRespond("deny");
  return (
    <div className={styles.root}>
      <ApprovalPreviewBlock ask={ask} projectPath={props.projectPath} />
      <div className={styles.actions}>
        <Button
          variant="primary"
          size="sm"
          className={docked}
          disabled={disabled}
          onClick={() => void onRespond("approve")}
          aria-keyshortcuts={keyHints ? "A" : undefined}
        >
          {t("needsYouApproveOnce")}
          <KeyHint show={keyHints} label="A" />
        </Button>
        {ask.canAlwaysAllow && (
          <Button
            size="sm"
            disabled={disabled}
            onClick={() => void onRespond("approve_accept_edits")}
          >
            {t("needsYouAllowEditsForSession")}
          </Button>
        )}
        {!reasonOpen && (
          <Button
            variant={reason ? "secondary" : "ghost"}
            size="sm"
            className={docked}
            disabled={disabled}
            onClick={deny}
            aria-keyshortcuts={keyHints ? "D" : undefined}
          >
            {reason ? t("needsYouDenyWithReason") : t("needsYouDeny")}
            <KeyHint show={keyHints} label="D" />
          </Button>
        )}
        {props.trailing && (
          <span className={`${styles.trailing} ${docked ?? ""}`}>
            {props.trailing}
          </span>
        )}
      </div>
      {reason && reasonOpen && (
        <DenyReasonForm
          sessionId={reason.sessionId}
          disabled={disabled}
          onCancel={() => reason.onOpenChange(false)}
          onSubmit={async (feedback) => {
            const sent = await onRespond("deny", { feedback });
            if (sent) reason.onOpenChange(false);
            return sent;
          }}
        />
      )}
    </div>
  );
}
