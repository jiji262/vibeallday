import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import styles from "./Button.module.css";
import { Spinner } from "./Spinner";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "danger-soft"
  | "attn"
  | "link";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<ButtonVariant, string | undefined> = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  danger: styles.danger,
  "danger-soft": styles.dangerSoft,
  attn: styles.attn,
  link: styles.link,
};

const SIZE_CLASS: Record<ButtonSize, string | undefined> = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
};

const SPINNER_SIZE = { sm: 12, md: 14, lg: 16 } as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon, 14px at `sm`, 16px otherwise. */
  icon?: ReactNode;
  block?: boolean;
  /** Shows an inline spinner in place of the icon and disables the button. */
  loading?: boolean;
}

/**
 * Design button. `primary` is the one accent action per area; destructive
 * actions use `danger-soft`, and filled `danger` only for final confirmation.
 * `attn` answers a needs-you prompt.
 */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  block = false,
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    block ? styles.block : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const leading = loading ? (
    <Spinner size={SPINNER_SIZE[size]} tone="current" />
  ) : icon ? (
    <span className={styles.icon} aria-hidden="true">
      {icon}
    </span>
  ) : null;
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {leading}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only controls need an accessible name. */
  label: string;
  children: ReactNode;
  /** `outlined` draws a surface fill with a strong line. */
  tone?: "default" | "primary" | "outlined";
  /** `md` is `--icon-btn`, `sm` 28px; both grow to 44px on touch. */
  size?: "sm" | "md";
}

/** Square icon control: `--icon-btn` (28px `sm`), 44px on coarse pointers. */
export function IconButton({
  label,
  children,
  tone = "default",
  size = "md",
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  const classes = [
    styles.iconButton,
    size === "sm" ? styles.iconButtonSm : "",
    tone === "primary" ? styles.iconButtonPrimary : "",
    tone === "outlined" ? styles.iconButtonOutlined : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type={type}
      className={classes}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  );
}
