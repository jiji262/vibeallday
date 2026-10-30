import type { MouseEvent } from "react";
import { Link } from "react-router-dom";
import type { InboxItem } from "../../contexts/InboxContext";
import { useI18n } from "../../i18n";
import { Button } from "../garden/Button";
import { Kbd } from "../garden/Kbd";
import { StatusDot } from "../garden/StatusDot";
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

/**
 * The current needs-you item. The summary carries only why it waits, so the
 * card names the reason and hands the decision to the session page.
 */
export function TriageCard(props: TriageCardProps) {
  const { t } = useI18n();
  const { item, href, onOpen, onSkip, canSkip } = props;
  const titleId = `triage-card-${item.sessionId}`;
  const model = inboxRowModel(item);
  const open = () => onOpen(item);
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <div className={styles.head}>
        <StatusDot state="attn" />
        <span className={styles.reason}>{t(triageReasonKey(item))}</span>
        {item.updatedAt && (
          <span className={styles.age}>
            <SessionListTime timestamp={item.updatedAt} />
          </span>
        )}
      </div>
      <div className={styles.body}>
        <div className={styles.titleBlock}>
          <Link
            id={titleId}
            className={styles.title}
            to={href}
            onClick={(event) => openOnPlainClick(event, open)}
          >
            {triageTitle(item)}
          </Link>
          <span className={styles.meta}>
            {[item.projectName, model].filter(Boolean).join(" · ")}
          </span>
        </div>
        <div className={styles.actions}>
          <Button variant="primary" onClick={open}>
            {t("inboxTriageOpen")}
          </Button>
          {canSkip && (
            <Button
              variant="ghost"
              className={styles.skip}
              onClick={onSkip}
              aria-keyshortcuts="S"
            >
              {t("inboxTriageSkip")}
              <span className={styles.hint} aria-hidden="true">
                <Kbd>S</Kbd>
              </span>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
