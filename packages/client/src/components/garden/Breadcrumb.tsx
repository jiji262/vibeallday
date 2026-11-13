import type { ReactNode } from "react";
import styles from "./Breadcrumb.module.css";

export interface Crumb {
  label: ReactNode;
  /** Destination; the last crumb never links. */
  to?: string;
  /** Full text when the label truncates. */
  title?: string;
}

export interface CrumbLinkProps {
  to: string;
  className: string;
  title?: string;
  children: ReactNode;
}

interface BreadcrumbProps {
  items: readonly Crumb[];
  /** Names the navigation landmark, e.g. t("breadcrumbLabel"). */
  label: string;
  /** Draws a link; pass a router Link here. Defaults to a plain anchor. */
  renderLink?: (props: CrumbLinkProps) => ReactNode;
  className?: string;
}

const PHONE_VISIBLE_CRUMBS = 2;

function defaultLink({ to, className, title, children }: CrumbLinkProps) {
  return (
    <a href={to} className={className} title={title}>
      {children}
    </a>
  );
}

/** Path of places; phones keep only the last two crumbs. */
export function Breadcrumb({
  items,
  label,
  renderLink = defaultLink,
  className,
}: BreadcrumbProps) {
  const lastIndex = items.length - 1;
  return (
    <nav
      aria-label={label}
      className={className ? `${styles.nav} ${className}` : styles.nav}
    >
      <ol className={styles.list}>
        {items.map((item, index) => {
          const isLast = index === lastIndex;
          const early = index < items.length - PHONE_VISIBLE_CRUMBS;
          const itemClass = early
            ? `${styles.item} ${styles.early}`
            : styles.item;
          return (
            <li key={index} className={itemClass}>
              {index > 0 ? (
                <span className={styles.separator} aria-hidden="true">
                  /
                </span>
              ) : null}
              {renderCrumb(item, isLast, renderLink)}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function renderCrumb(
  item: Crumb,
  isLast: boolean,
  renderLink: (props: CrumbLinkProps) => ReactNode,
) {
  if (isLast || !item.to) {
    return (
      <span
        className={`${styles.crumb}${isLast ? ` ${styles.current}` : ""}`}
        title={item.title}
        aria-current={isLast ? "page" : undefined}
      >
        {item.label}
      </span>
    );
  }
  return renderLink({
    to: item.to,
    className: `${styles.crumb} ${styles.link}`,
    title: item.title,
    children: item.label,
  });
}
