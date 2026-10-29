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
  /** Group label; items sharing it render together, in first-seen order. */
  section?: string;
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

interface ActionGroup {
  section?: string;
  items: ActionSheetItem[];
}

/** Groups items by section, keeping the order each section first appears. */
export function groupActionItems(items: readonly ActionSheetItem[]) {
  const groups: ActionGroup[] = [];
  for (const item of items) {
    const group = groups.find(
      (candidate) => candidate.section === item.section,
    );
    if (group) group.items.push(item);
    else groups.push({ section: item.section, items: [item] });
  }
  return groups;
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
      {groupActionItems(items).map((group) => (
        <div
          key={group.section ?? ""}
          className={styles.group}
          role="group"
          aria-label={group.section}
        >
          {group.section ? (
            <div className={styles.groupLabel} aria-hidden="true">
              {group.section}
            </div>
          ) : null}
          {group.items.map((item) => (
            <ActionRow key={item.key} item={item} onClose={onClose} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ActionRow({
  item,
  onClose,
}: {
  item: ActionSheetItem;
  onClose: () => void;
}) {
  return (
    <button
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
        {item.hint ? <span className={styles.hint}>{item.hint}</span> : null}
      </span>
    </button>
  );
}
