import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n";
import { ChevronRightIcon } from "../garden/icons";
import { type DenyReasonControl, InlineApproval } from "./InlineApproval";
import { InlineQuestion, InSessionNote } from "./InlineQuestion";
import styles from "./NeedsYouInline.module.css";
import { inlineAsk } from "./pendingInputModel";
import type { PendingInput } from "./usePendingInput";

const CHEVRON_SIZE = 14;

export interface NeedsYouActionsProps {
  pending: PendingInput;
  armed: boolean;
  sessionHref: string;
  projectPath?: string;
  /** Plain clicks on session links go through here (Triage keeps progress). */
  onOpenSession?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Triage: deny asks for a reason first. */
  reason?: DenyReasonControl;
  keyHints?: boolean;
  /** Triage shows Open session beside the title instead. */
  hideOpenLink?: boolean;
  /** Phones decide from the Triage page bar. */
  phoneDock?: boolean;
  /** Extra controls at the end of the approval row (Triage's Skip). */
  trailing?: ReactNode;
}

/** Whether the card has anything to show in place of a plain Open action. */
export function hasInlineActions(pending: PendingInput): boolean {
  return pending.answered || inlineAsk(pending.request).kind !== "none";
}

export function OpenSessionLink({
  href,
  onClick,
  className,
}: {
  href: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <Link
      to={href}
      className={`${styles.openLink} ${className ?? ""}`}
      onClick={onClick}
    >
      {t("needsYouOpenSession")}
      <ChevronRightIcon size={CHEVRON_SIZE} />
    </Link>
  );
}

/**
 * The inline body of a needs-you card: the approval or question it can
 * answer in place, a note when the answer belongs in the session, or a
 * short confirmation while the list catches up with an answer.
 */
export function NeedsYouActions(props: NeedsYouActionsProps) {
  const { t } = useI18n();
  const { pending, armed, sessionHref, onOpenSession } = props;
  const ask = inlineAsk(pending.request);
  const trailing = (
    <>
      {!props.hideOpenLink && (
        <OpenSessionLink href={sessionHref} onClick={onOpenSession} />
      )}
      {props.trailing}
    </>
  );
  if (ask.kind === "approval") {
    return (
      <InlineApproval
        ask={ask}
        projectPath={props.projectPath}
        armed={armed}
        submitting={pending.submitting}
        onRespond={pending.respond}
        reason={props.reason}
        keyHints={props.keyHints}
        phoneDock={props.phoneDock}
        trailing={trailing}
      />
    );
  }
  if (ask.kind === "question") {
    return (
      <InlineQuestion
        ask={ask}
        armed={armed}
        submitting={pending.submitting}
        onRespond={pending.respond}
        sessionHref={sessionHref}
        onOpenSession={onOpenSession}
      />
    );
  }
  if (ask.kind === "plan" || ask.kind === "questionInSession") {
    return <InSessionNote ask={ask} />;
  }
  if (pending.answered) {
    return (
      <p className={styles.note} role="status">
        {t("needsYouAnswered")}
      </p>
    );
  }
  return null;
}
