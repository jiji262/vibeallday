import type { ReactNode, RefObject } from "react";
import { Modal, type ModalAnchorRect } from "../ui/Modal";
import styles from "./Sheet.module.css";

interface SheetProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Header actions beside the close button. */
  actions?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Bottom sheet on phones, centered dialog on desktop. Built on Modal, so it
 * shares its focus, Escape, back-gesture and scroll-lock behavior.
 */
export function Sheet({
  title,
  onClose,
  children,
  actions,
  initialFocusRef,
}: SheetProps) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      actions={actions}
      initialFocusRef={initialFocusRef}
      variant="sheet"
      closeOnBackGesture
    >
      {children}
    </Modal>
  );
}

export interface ActionSheetItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  /** Secondary line under the label. */
  hint?: ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
  onSelect: () => void;
}

interface ActionSheetProps {
  title: ReactNode;
  items: ActionSheetItem[];
  onClose: () => void;
  /** Desktop anchors the menu to its trigger; phones always use a sheet. */
  anchorRect?: ModalAnchorRect | null;
}

/** A menu: anchored popover on desktop, bottom sheet on phones. */
export function ActionSheet({
  title,
  items,
  onClose,
  anchorRect,
}: ActionSheetProps) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      anchorRect={anchorRect}
      variant="action-sheet"
      closeOnBackGesture
    >
      <ActionList items={items} onClose={onClose} />
    </Modal>
  );
}

function ActionList({
  items,
  onClose,
}: {
  items: ActionSheetItem[];
  onClose: () => void;
}) {
  return (
    <div className={styles.list} role="menu">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          className={`${styles.item}${item.tone === "danger" ? ` ${styles.danger}` : ""}`}
          disabled={item.disabled}
          onClick={() => {
            onClose();
            item.onSelect();
          }}
        >
          {item.icon ? (
            <span className={styles.icon} aria-hidden="true">
              {item.icon}
            </span>
          ) : null}
          <span className={styles.text}>
            <span className={styles.label}>{item.label}</span>
            {item.hint ? (
              <span className={styles.hint}>{item.hint}</span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}
