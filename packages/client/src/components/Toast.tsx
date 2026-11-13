import type { CSSProperties } from "react";
import { getToastDurationMs, type Toast as ToastType } from "../hooks/useToast";
import { AlertIcon, CheckIcon, InfoIcon } from "./garden/icons";
import styles from "./Toast.module.css";

const TOAST_ICON_SIZE = 16;

const TOAST_ICON = {
  error: AlertIcon,
  success: CheckIcon,
  info: InfoIcon,
} satisfies Record<ToastType["type"], unknown>;

interface Props {
  toasts: ToastType[];
  onDismiss: (id: string) => void;
}

const TOAST_TYPE_CLASS = {
  error: styles.error!,
  success: styles.success!,
  info: styles.info!,
} satisfies Record<ToastType["type"], string>;

export function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${TOAST_TYPE_CLASS[toast.type]}`}
          style={
            {
              "--toast-fade-duration": `${getToastDurationMs(toast) / 1000}s`,
            } as CSSProperties
          }
          onClick={() => onDismiss(toast.id)}
          onKeyDown={(e) => e.key === "Enter" && onDismiss(toast.id)}
          role="alert"
        >
          <ToastIcon type={toast.type} />
          <span className={styles.message}>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className={styles.action}
              onClick={(e) => {
                e.stopPropagation();
                toast.action?.onClick();
                onDismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function ToastIcon({ type }: { type: ToastType["type"] }) {
  const Icon = TOAST_ICON[type];
  return (
    <span className={styles.icon} aria-hidden="true">
      <Icon size={TOAST_ICON_SIZE} />
    </span>
  );
}
