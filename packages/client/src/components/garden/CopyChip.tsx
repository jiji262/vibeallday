import type { ReactNode } from "react";
import styles from "./CopyChip.module.css";
import { CheckIcon, CopyIcon } from "./icons";
import { useCopyFeedback } from "./useCopyFeedback";

const CHIP_ICON_SIZE = 14;

interface CopyChipProps {
  /** Text placed on the clipboard. */
  value: string;
  /** Accessible name and tooltip, e.g. t("copy"). */
  label: string;
  /** Announced for two seconds after a copy, e.g. t("copied"). */
  copiedLabel: string;
  /** Optional visible text beside the icon (truncates). */
  children?: ReactNode;
  className?: string;
}

/** Dashed mono chip that copies a value; Copy turns to Check for 2s. */
export function CopyChip({
  value,
  label,
  copiedLabel,
  children,
  className,
}: CopyChipProps) {
  const { copied, copy } = useCopyFeedback(value);
  const name = copied ? copiedLabel : label;
  const classes = [styles.chip, copied ? styles.copied : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={classes}
      aria-label={name}
      title={name}
      onClick={() => {
        void copy();
      }}
    >
      {copied ? (
        <CheckIcon size={CHIP_ICON_SIZE} />
      ) : (
        <CopyIcon size={CHIP_ICON_SIZE} />
      )}
      {children ? <span className={styles.text}>{children}</span> : null}
    </button>
  );
}
