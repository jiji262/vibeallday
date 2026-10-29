import type { InputHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n";
import { ChevronLeftIcon } from "../garden/icons";
import { Spinner } from "../garden/Spinner";
import { VibeAllDayGlyph } from "../VibeAllDayLogo";
import styles from "./AuthShell.module.css";

const LOGO_SIZE = 40;
const BACK_ICON_SIZE = 16;

interface AuthShellProps {
  /** Page title, drawn in Fraunces under the logo tile. */
  title: string;
  subtitle?: string;
  /** A quiet "back" link above the logo. */
  back?: { to: string; label?: string };
  /** One quiet line of guidance under the form. */
  footer?: ReactNode;
  /** Sit near the top instead of the middle, for a sheet that opens over it. */
  top?: boolean;
  children?: ReactNode;
}

/**
 * The paper shell shared by sign-in, host picker and reconnect screens: one
 * centred card with the logo tile, a serif title, then the page's own form.
 */
export function AuthShell({
  title,
  subtitle,
  back,
  footer,
  top = false,
  children,
}: AuthShellProps) {
  const { t } = useI18n();
  return (
    <div className={top ? `${styles.page} ${styles.top}` : styles.page}>
      <main className={styles.card}>
        {back ? (
          <Link to={back.to} className={styles.back}>
            <ChevronLeftIcon size={BACK_ICON_SIZE} />
            {back.label ?? t("actionBack")}
          </Link>
        ) : null}
        <div className={styles.brand}>
          <VibeAllDayGlyph size={LOGO_SIZE} className={styles.logo} />
          <h1 className={styles.title}>{title}</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {children}
        {footer ? <p className={styles.footer}>{footer}</p> : null}
      </main>
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
