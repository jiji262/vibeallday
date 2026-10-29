import type { ReactNode } from "react";
import { Button } from "./Button";
import styles from "./ErrorState.module.css";
import { Notice } from "./Notice";

type RetryProps =
  | { onRetry: () => void; retryLabel: string }
  | { onRetry?: undefined; retryLabel?: undefined };

type ErrorStateProps = RetryProps & {
  title?: ReactNode;
  message: ReactNode;
  /** Mono lead such as t("errorTag"); omitted when not given. */
  tag?: ReactNode;
  /** Single-row danger notice instead of the rose block. */
  inline?: boolean;
  className?: string;
};

/** A failed load or action: what went wrong and, when possible, a retry. */
export function ErrorState({
  title,
  message,
  tag,
  inline = false,
  onRetry,
  retryLabel,
  className,
}: ErrorStateProps) {
  const retry = onRetry ? (
    <Button size="sm" variant="secondary" onClick={onRetry}>
      {retryLabel}
    </Button>
  ) : null;
  if (inline) {
    return (
      <Notice
        tone="danger"
        tag={tag}
        actions={retry}
        role="alert"
        className={className}
      >
        {title ? <strong>{title} </strong> : null}
        {message}
      </Notice>
    );
  }
  return (
    <div
      className={className ? `${styles.block} ${className}` : styles.block}
      role="alert"
    >
      {tag ? <p className={styles.tag}>{tag}</p> : null}
      {title ? <h2 className={styles.title}>{title}</h2> : null}
      <p className={styles.message}>{message}</p>
      {retry ? <div className={styles.retry}>{retry}</div> : null}
    </div>
  );
}
