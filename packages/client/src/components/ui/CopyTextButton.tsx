import { memo, type MouseEvent as ReactMouseEvent, useCallback } from "react";
import { useI18n } from "../../i18n";
import { CheckIcon, CopyIcon } from "../garden/icons";
import { useCopyFeedback } from "../garden/useCopyFeedback";
import styles from "./CopyTextButton.module.css";

const COPIED_RESET_MS = 1800;
const ICON_SIZE = 14;

interface Props {
  text: string;
  label: string;
  className: string;
  copiedClassName?: string;
  copiedLabel?: string;
  showTextLabel?: boolean;
  onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}

/** Visible text label; only text-label callers need the i18n provider. */
function CopyTextLabel({ copied }: { copied: boolean }) {
  const { t } = useI18n();
  return <span className={styles.label}>{t(copied ? "copied" : "copy")}</span>;
}

export const CopyTextButton = memo(function CopyTextButton({
  text,
  label,
  className,
  copiedClassName = "copied",
  copiedLabel = "Copied message text",
  showTextLabel = false,
  onClick,
}: Props) {
  const { copied, copy } = useCopyFeedback(text, COPIED_RESET_MS);

  const handleCopy = useCallback(
    async (event: ReactMouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (!(await copy())) {
        console.error(`Failed to copy text for ${label}`);
      }
    },
    [copy, label, onClick],
  );

  return (
    <button
      type="button"
      className={`${className}${copied ? ` ${copiedClassName}` : ""}`}
      onClick={handleCopy}
      aria-label={copied ? copiedLabel : label}
      title={copied ? copiedLabel : label}
    >
      {copied ? <CheckIcon size={ICON_SIZE} /> : <CopyIcon size={ICON_SIZE} />}
      {showTextLabel && <CopyTextLabel copied={copied} />}
    </button>
  );
});
