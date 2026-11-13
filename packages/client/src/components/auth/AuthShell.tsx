import type { InputHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n";
import { CopyChip } from "../garden/CopyChip";
import { ChevronLeftIcon } from "../garden/icons";
import { Spinner } from "../garden/Spinner";
import { AuthBrandColumn } from "./AuthBrandColumn";
import styles from "./AuthShell.module.css";

const BACK_ICON_SIZE = 16;

interface AuthShellProps {
  /** Card title: the page's only h1. */
  title: string;
  subtitle?: string;
  /** A quiet "back" link above the logo. */
  back?: { to: string; label?: string };
  /** Quiet guidance under the form, after a divider. */
  footer?: ReactNode;
  /** Controls drawn under the title, before the page's form. */
  controls?: ReactNode;
  /** Sit near the top instead of the middle, for a sheet that opens over it. */
  top?: boolean;
  children?: ReactNode;
}

/**
 * The shell shared by sign-in, host picker and reconnect screens: a brand
 * column beside one form card, stacking into a single column when narrow.
 */
export function AuthShell({
  title,
  subtitle,
  back,
  footer,
  controls,
  top = false,
  children,
}: AuthShellProps) {
  const { t } = useI18n();
  return (
    <div className={top ? `${styles.page} ${styles.top}` : styles.page}>
      <div className={styles.layout}>
        <AuthBrandColumn />
        <main className={styles.card}>
          {back ? (
            <Link to={back.to} className={styles.back}>
              <ChevronLeftIcon size={BACK_ICON_SIZE} />
              {back.label ?? t("actionBack")}
            </Link>
          ) : null}
          <div className={styles.heading}>
            <h1 className={styles.title}>{title}</h1>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
          {controls}
          {children}
          {footer ? <div className={styles.footer}>{footer}</div> : null}
        </main>
      </div>
    </div>
  );
}

/** The screen shown while a saved session resumes. */
export function AuthReconnecting() {
  const { t } = useI18n();
  return (
    <AuthShell title={t("reconnecting")}>
      <div
        className={styles.loading}
        role="status"
        data-testid="auto-resume-loading"
      >
        <Spinner size={24} />
      </div>
    </AuthShell>
  );
}

/** A form column: fields, an error and the primary action. */
export function AuthForm({
  children,
  ...rest
}: {
  children: ReactNode;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  "data-testid"?: string;
}) {
  return (
    <form className={styles.form} {...rest}>
      {children}
    </form>
  );
}

/** A label above a field (pass `inputClassName()`), with an optional hint. */
export function AuthField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
}

/** Checkbox row with a 44px target. */
export function AuthCheck({
  children,
  hint,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> & {
  children: ReactNode;
  hint?: string;
  "data-testid"?: string;
}) {
  return (
    <div className={styles.check}>
      <label>
        <input type="checkbox" {...input} />
        <span>{children}</span>
      </label>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
}

/** A small mono line of context between the fields and the action. */
export function AuthNote({
  children,
  ...rest
}: {
  children: ReactNode;
  "data-testid"?: string;
}) {
  return (
    <p className={styles.note} {...rest}>
      {children}
    </p>
  );
}

export function AuthError({
  children,
  ...rest
}: {
  children: ReactNode;
  "data-testid"?: string;
}) {
  return (
    <div className={styles.error} role="alert" {...rest}>
      {children}
    </div>
  );
}

/** Spinner and a line of progress text. */
export function AuthStatus({
  children,
  ...rest
}: {
  children: ReactNode;
  "data-testid"?: string;
}) {
  return (
    <div className={styles.status} role="status" {...rest}>
      <Spinner size={16} />
      <span>{children}</span>
    </div>
  );
}

/** A quiet text button, for options that stay out of the way. */
export function AuthLinkButton({
  children,
  ...rest
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className={styles.linkButton} {...rest}>
      {children}
    </button>
  );
}

/** A shell command the user runs on the host, with a copy button. */
export function AuthCommand({
  command,
  copyLabel,
}: {
  command: string;
  copyLabel: string;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.command}>
      <code className={styles.commandText}>{command}</code>
      <CopyChip value={command} label={copyLabel} copiedLabel={t("copied")} />
    </div>
  );
}
