import type { MouseEvent } from "react";
import { Link } from "react-router-dom";
import type { InboxItem } from "../../contexts/InboxContext";
import { useI18n } from "../../i18n";
import { Button } from "../garden/Button";
import { Kbd } from "../garden/Kbd";
import { StatusDot } from "../garden/StatusDot";
import type { DenyReasonControl } from "../needsYou/InlineApproval";
import {
  hasInlineActions,
  NeedsYouActions,
  OpenSessionLink,
} from "../needsYou/NeedsYouActions";
import { inlineAsk, projectPathOf } from "../needsYou/pendingInputModel";
import type { PendingInput } from "../needsYou/usePendingInput";
import { inboxRowModel } from "../now/inboxSections";
import { SessionListTime } from "../SessionListTime";
import styles from "./TriageCard.module.css";
import { triageReasonKey, triageTitle } from "./triageItem";

export interface TriageCardProps {
  item: InboxItem;
  href: string;
  /** Open the session; the page records progress before leaving. */
  onOpen: (item: InboxItem) => void;
  onSkip: () => void;
  /** Skipping makes sense only when another item can come up. */
  canSkip: boolean;
  /** The item's pending approval or question, answered in place. */
  pending: PendingInput;
  armed: boolean;
  reason: DenyReasonControl;
}

/** Plain left clicks go through `onOpen`; modified clicks keep the link. */
export function openOnPlainClick(
  event: MouseEvent<HTMLAnchorElement>,
  open: () => void,
) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) {
    return;
  }
  event.preventDefault();
  open();
}

function SkipButton({ onSkip }: { onSkip: () => void }) {
  const { t } = useI18n();
  return (
    <Button
      variant="ghost"
      size="sm"
      className={styles.skip}
      onClick={onSkip}
      aria-keyshortcuts="S"
    >
      {t("inboxTriageSkip")}
      <span className={styles.hint} aria-hidden="true">
        <Kbd>S</Kbd>
      </span>
    </Button>
  );
}

function CardHead({ item, toolName }: { item: InboxItem; toolName?: string }) {
  const { t } = useI18n();
  return (
    <div className={styles.head}>
      <StatusDot state="attn" />
      <span className={styles.reason}>{t(triageReasonKey(item))}</span>
      <span className={styles.age}>
        {toolName && <span className={styles.tool}>{toolName}</span>}
        {item.updatedAt && <SessionListTime timestamp={item.updatedAt} />}
      </span>
    </div>
  );
}

/**
 * The current needs-you item. An approval or a one-tap question is
 * answered on the card; anything else hands the decision to the session.
 */
export function TriageCard(props: TriageCardProps) {
  const { t } = useI18n();
  const { item, href, onOpen, onSkip, canSkip, pending } = props;
  const titleId = `triage-card-${item.sessionId}`;
  const model = inboxRowModel(item);
  const open = () => onOpen(item);
  const onOpenLink = (event: MouseEvent<HTMLAnchorElement>) =>
    openOnPlainClick(event, open);
  const inline = hasInlineActions(pending);
  const ask = inlineAsk(pending.request);
  const skip = canSkip ? <SkipButton onSkip={onSkip} /> : undefined;
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <CardHead item={item} toolName={pending.request?.toolName} />
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <div className={styles.titleBlock}>
            <Link
              id={titleId}
              className={styles.title}
              to={href}
              onClick={onOpenLink}
            >
              {triageTitle(item)}
            </Link>
            <span className={styles.meta}>
              {[item.projectName, model].filter(Boolean).join(" · ")}
            </span>
          </div>
          {inline && (
            <OpenSessionLink
              href={href}
              onClick={onOpenLink}
              className={styles.titleOpen}
            />
          )}
        </div>
        {inline && (
          <NeedsYouActions
            pending={pending}
            armed={props.armed}
            sessionHref={href}
            projectPath={projectPathOf(item.projectId)}
            onOpenSession={onOpenLink}
            reason={props.reason}
            keyHints
            hideOpenLink
            phoneDock
            trailing={skip}
          />
        )}
        {ask.kind !== "approval" && (
          <div className={styles.actions}>
            {ask.kind !== "question" && (
              <Button variant="primary" onClick={open}>
                {t("inboxTriageOpen")}
              </Button>
            )}
            {skip}
          </div>
        )}
      </div>
    </section>
  );
}
