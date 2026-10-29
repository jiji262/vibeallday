import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.css";

function join(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

interface CardProps extends HTMLAttributes<HTMLElement> {
  /** `section` when the card has its own heading; `div` otherwise. */
  as?: "div" | "section" | "article" | "li";
  /** `danger` tints the card rose for destructive zones. */
  tone?: "default" | "danger";
  /** Transparent dashed tile for an "add new" cell. */
  dashed?: boolean;
  /** Clips children to the radius, for flush lists and tables. */
  flush?: boolean;
}

export function Card({
  as: Element = "div",
  tone = "default",
  dashed = false,
  flush = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Element
      className={join(
        styles.card,
        tone === "danger" && styles.danger,
        dashed && styles.dashed,
        flush && styles.flushCard,
        className,
      )}
      {...rest}
    >
      {children}
    </Element>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  /** Mono UPPERCASE context on the right, e.g. a count or scope. */
  meta?: ReactNode;
  actions?: ReactNode;
  description?: ReactNode;
  titleAs?: "h2" | "h3";
  titleId?: string;
  className?: string;
}

/** Serif title left, mono meta and actions right, dashed underline. */
export function CardHeader({
  title,
  meta,
  actions,
  description,
  titleAs: Title = "h2",
  titleId,
  className,
}: CardHeaderProps) {
  const hasSide = meta !== undefined || actions !== undefined;
  return (
    <div className={join(styles.header, className)}>
      <div className={styles.heading}>
        <Title className={styles.title} id={titleId}>
          {title}
        </Title>
        {description ? (
          <p className={styles.description}>{description}</p>
        ) : null}
      </div>
      {hasSide ? (
        <div className={styles.side}>
          {meta !== undefined ? (
            <span className={styles.meta}>{meta}</span>
          ) : null}
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

interface CardSectionProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Padded content; `flush` removes padding for lists and tables. */
export function CardBody({
  flush = false,
  className,
  children,
  ...rest
}: CardSectionProps & { flush?: boolean }) {
  return (
    <div
      className={join(styles.body, flush && styles.flush, className)}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Dashed-top action row; `band` is the sunken "load more" strip. */
export function CardFooter({
  band = false,
  className,
  children,
  ...rest
}: CardSectionProps & { band?: boolean }) {
  return (
    <div
      className={join(styles.footer, band && styles.band, className)}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Indigo strip at the top of a card, e.g. the bulk-selection bar. */
export function CardBand({ className, children, ...rest }: CardSectionProps) {
  return (
    <div className={join(styles.indigoBand, className)} {...rest}>
      {children}
    </div>
  );
}
