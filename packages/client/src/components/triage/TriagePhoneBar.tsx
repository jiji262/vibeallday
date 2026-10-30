import { useI18n } from "../../i18n";
import { Button } from "../garden/Button";
import type { DenyReasonControl } from "../needsYou/InlineApproval";
import type { PendingInput } from "../needsYou/usePendingInput";
import styles from "./TriagePhoneBar.module.css";

export interface TriagePhoneBarProps {
  pending: PendingInput;
  armed: boolean;
  reason: DenyReasonControl;
  /** The current item is an approval answerable on the card. */
  approval: boolean;
  onSkip?: () => void;
}

/**
 * Phone triage keeps the decision in the thumb zone: a bar pinned to the
 * bottom of the page (design Triage-Phone). Wider layouts use the card's
 * own buttons, so the bar renders nothing visible there.
 */
export function TriagePhoneBar(props: TriagePhoneBarProps) {
  const { t } = useI18n();
  const { pending, armed, reason, approval, onSkip } = props;
  if (!approval && !onSkip) return null;
  const disabled = !armed || pending.submitting;
  return (
    <div className={styles.bar}>
      {approval && !reason.open && (
        <div className={styles.row}>
          <Button
            size="lg"
            className={styles.grow}
            disabled={disabled}
            onClick={() => reason.onOpenChange(true)}
          >
            {t("inboxTriageDenyEllipsis")}
          </Button>
          <Button
            variant="primary"
            size="lg"
            className={styles.grow}
            disabled={disabled}
            onClick={() => void pending.respond("approve")}
          >
            {t("needsYouApproveOnce")}
          </Button>
        </div>
      )}
      {onSkip && (
        <Button variant="ghost" className={styles.skip} onClick={onSkip}>
          {t("inboxTriageSkipNext")}
        </Button>
      )}
    </div>
  );
}
