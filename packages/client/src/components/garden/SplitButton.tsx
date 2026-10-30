import { type ReactNode, useCallback, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import type { ModalAnchorRect } from "../ui/Modal";
import { Button, type ButtonSize, type ButtonVariant } from "./Button";
import { ChevronDownIcon } from "./icons";
import { ActionSheet, type ActionSheetItem } from "./Sheet";
import styles from "./SplitButton.module.css";

interface SplitButtonProps {
  /** The main action's label. */
  children: ReactNode;
  onClick: () => void;
  /** Alternatives in the attached menu. */
  items: ActionSheetItem[];
  /** Accessible name of the menu button; defaults to "More options". */
  menuLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

function anchorFor(element: HTMLElement | null): ModalAnchorRect | null {
  if (!element) return null;
  const { top, right, bottom, left, width, height } =
    element.getBoundingClientRect();
  return { top, right, bottom, left, width, height };
}

/**
 * Primary action plus a menu button (design .split). The menu is an
 * ActionSheet: anchored popover on desktop, bottom sheet on phones. Escape or
 * a choice closes it and returns focus to the menu button.
 */
export function SplitButton({
  children,
  onClick,
  items,
  menuLabel,
  variant = "primary",
  size = "md",
  icon,
  disabled = false,
  loading = false,
  className,
}: SplitButtonProps) {
  const { t } = useI18n();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<ModalAnchorRect | null>(null);
  const label = menuLabel ?? t("gardenSplitButtonMore");
  const open = anchor !== null;
  const close = useCallback(() => {
    setAnchor(null);
    toggleRef.current?.focus();
  }, []);
  return (
    <span className={className ? `${styles.split} ${className}` : styles.split}>
      <Button
        variant={variant}
        size={size}
        icon={icon}
        disabled={disabled}
        loading={loading}
        className={styles.main}
        onClick={onClick}
      >
        {children}
      </Button>
      <Button
        ref={toggleRef}
        variant={variant}
        size={size}
        disabled={disabled || loading || items.length === 0}
        className={styles.toggle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setAnchor(open ? null : anchorFor(toggleRef.current))}
      >
        <ChevronDownIcon size={16} />
      </Button>
      {open ? (
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
