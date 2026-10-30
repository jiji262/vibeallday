import { type ReactNode, useCallback, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { ChevronDownIcon } from "./garden/icons";
import { ActionSheet, type ActionSheetItem } from "./garden/Sheet";
import type { ModalAnchorRect } from "./ui/Modal";
import styles from "./NewSessionStartSplit.module.css";

const CHEVRON_SIZE = 16;

interface NewSessionStartSplitProps {
  /** The Start button itself; it keeps its own classes and handlers. */
  children: ReactNode;
  /** Other ways to start (Queue for project). None renders Start alone. */
  items: ActionSheetItem[];
  disabled: boolean;
}

function anchorFor(element: HTMLElement | null): ModalAnchorRect | null {
  if (!element) return null;
  const { top, right, bottom, left, width, height } =
    element.getBoundingClientRect();
  return { top, right, bottom, left, width, height };
}

/**
 * Start with a menu button beside it (design .split). The menu is an
 * ActionSheet: anchored on desktop, a bottom sheet on phones; closing it
 * returns focus to the menu button. Without items Start stands alone.
 */
export function NewSessionStartSplit({
  children,
  items,
  disabled,
}: NewSessionStartSplitProps) {
  const { t } = useI18n();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<ModalAnchorRect | null>(null);
  const close = useCallback(() => {
    setAnchor(null);
    toggleRef.current?.focus();
  }, []);
  const open = anchor !== null;
  const label = t("newSessionMoreStartOptions");
  // One wrapper whether or not a menu exists, so Start keeps its identity
  // (and focus) when Queue for project comes and goes.
  return (
    <span className={styles.split} data-has-menu={items.length > 0}>
      {children}
      {items.length > 0 ? (
        <button
          ref={toggleRef}
          type="button"
          className={styles.toggle}
          aria-label={label}
          title={label}
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setAnchor(open ? null : anchorFor(toggleRef.current))}
        >
          <ChevronDownIcon size={CHEVRON_SIZE} />
        </button>
      ) : null}
      {open && items.length > 0 ? (
        <ActionSheet
          title={label}
          items={items}
          anchorRect={anchor}
          onClose={close}
        />
      ) : null}
    </span>
  );
}
