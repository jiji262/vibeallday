import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useRef,
} from "react";
import { useToolApprovalFeedbackDraft } from "../../hooks/useDrafts";
import { useI18n } from "../../i18n";
import { Button } from "../garden/Button";
import { isApplePlatform } from "../shell/shortcut";
import styles from "./NeedsYouInline.module.css";

export interface DenyReasonFormProps {
  sessionId: string;
  disabled: boolean;
  onCancel: () => void;
  /** Resolves true once the denial with this reason was accepted. */
  onSubmit: (feedback: string) => Promise<boolean>;
}

/**
 * Deny with a reason the agent receives as the reply. The text shares the
 * session approval panel's draft, so it follows the user into the session.
 */
export function DenyReasonForm(props: DenyReasonFormProps) {
  const { sessionId, disabled, onCancel, onSubmit } = props;
  const { t } = useI18n();
  const id = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [feedback, setFeedback, clearFeedback] =
    useToolApprovalFeedbackDraft(sessionId);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    const text = feedback.trim();
    if (!text || disabled) return;
    if (await onSubmit(text)) clearFeedback();
  };
  const cancel = () => {
    clearFeedback();
    onCancel();
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div className={styles.reason}>
      <label htmlFor={id} className={styles.reasonLabel}>
        {t("needsYouDenyReasonLabel")}
      </label>
      <textarea
        id={id}
        ref={inputRef}
        className={styles.reasonInput}
        value={feedback}
        rows={3}
        placeholder={t("toolApprovalFeedbackPlaceholder")}
        onChange={(event) => setFeedback(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className={styles.reasonFoot}>
        <span className={styles.reasonHint} aria-hidden="true">
          {t("needsYouDenySendHint", {
            key: isApplePlatform() ? "⌘Enter" : "Ctrl+Enter",
          })}
        </span>
        <Button variant="ghost" size="sm" onClick={cancel}>
          {t("cancel")}
        </Button>
        <Button
          variant="danger-soft"
          size="sm"
          disabled={disabled || !feedback.trim()}
          onClick={() => void submit()}
        >
          {t("needsYouDenyAndSend")}
        </Button>
      </div>
    </div>
  );
}
