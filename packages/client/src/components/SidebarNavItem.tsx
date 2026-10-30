import { type ReactNode, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLongPress } from "../hooks/useLongPress";
import { Tag } from "./garden/Badge";
import styles from "./SidebarNavItem.module.css";
import { ThinkingIndicator } from "./ThinkingIndicator";

/** Navigation glyph size; the garden icon set draws on a 24px grid. */
export const SIDEBAR_ICON_SIZE = 18;

/**
 * Sidebar-only glyphs. Destination icons come from `garden/icons` through
 * `sidebar/shellDestinations`. The new-session mark is a plus in the primary
 * button's ink; its disc stays in the markup but is unfilled.
 */
export const SidebarIcons = {
  newSession: (
    <svg
      className="sidebar-new-session-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="12" fill="none" />
      <line
        x1="12"
        y1="5"
        x2="12"
        y2="19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="5"
        y1="12"
        x2="19"
        y2="12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
};

export interface SidebarNavItemProps {
  accessory?: ReactNode;
  /** Route path to navigate to */
  to: string;
  /** Icon to display */
  icon: ReactNode;
  /** Label text */
  label: string;
  /** Optional badge count (displays if > 0) */
  badge?: number;
  /** Badge visual variant */
  badgeVariant?: "default" | "projectQueue";
  /** Optional badge tooltip */
  badgeTitle?: string;
  /** Short status tag after the label, e.g. "Beta". */
  tag?: string;
  /** Called when item is clicked (e.g., to close mobile sidebar) */
  onClick?: () => void;
  /** Title tooltip */
  title?: string;
  /** Whether this item has an unsent draft */
  hasDraft?: boolean;
  /** Accessible name of the draft dot. */
  draftLabel?: string;
  /** Show pulsing activity indicator (e.g., for active agents) */
  hasActivityIndicator?: boolean;
  /** Base path prefix for relay mode (e.g., "/remote/my-server") */
  basePath?: string;
  /** Explicit aliases belonging to this destination, without a relay prefix. */
  activePaths?: readonly string[];
  /** Extra classes for the link, e.g. the new-session action. */
  className?: string;
}

function isCurrentPath(
  pathname: string,
  to: string,
  basePath: string,
  activePaths: readonly string[],
): boolean {
  const fullPath = `${basePath}${to}`;
  const fullPathname = fullPath.split(/[?#]/)[0] || fullPath;
  const targetPathname = to.split(/[?#]/)[0] || to;
  return (
    pathname === fullPathname ||
    pathname === targetPathname ||
    activePaths.some((path) => pathname === `${basePath}${path}`)
  );
}

function NavBadge({
  badge,
  variant,
  title,
}: {
  badge: number | undefined;
  variant: "default" | "projectQueue";
  title?: string;
}) {
  if (badge === undefined || badge <= 0) return null;
  const variantClass =
    variant === "projectQueue" ? styles.badgeQueue : styles.badgeNeedsYou;
  return (
    <span
      className={`sidebar-nav-badge sidebar-nav-badge--${variant} ${styles.badge} ${variantClass}`}
      title={title}
    >
      {badge}
    </span>
  );
}

/** One destination row: icon, label, then draft, activity, tag and count. */
export function SidebarNavItem({
  accessory,
  to,
  icon,
  label,
  badge,
  badgeVariant = "default",
  badgeTitle,
  tag,
  onClick,
  title,
  hasDraft,
  draftLabel,
  hasActivityIndicator,
  basePath = "",
  activePaths = [],
  className,
}: SidebarNavItemProps) {
  const location = useLocation();
  const isActive = isCurrentPath(location.pathname, to, basePath, activePaths);
  const classes = [
    "sidebar-nav-item",
    styles.item,
    isActive ? `active ${styles.current}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const link = (
    <Link
      to={`${basePath}${to}`}
      className={classes}
      aria-current={isActive ? "page" : undefined}
      onClick={onClick}
      title={title ?? label}
    >
      <span className={styles.icon}>{icon}</span>
      <span className={`sidebar-nav-text ${styles.text}`}>{label}</span>
      {hasDraft && (
        <span
          className={styles.draftDot}
          role="img"
          aria-label={draftLabel}
          title={draftLabel}
        />
      )}
      {hasActivityIndicator && <ThinkingIndicator />}
      {tag ? (
        <Tag tone="indigo" className={styles.tag}>
          {tag}
        </Tag>
      ) : null}
      <NavBadge badge={badge} variant={badgeVariant} title={badgeTitle} />
    </Link>
  );
  // The accessory is its own control beside the link, so the row draws the
  // current and hover wash across both rather than ending it at the link.
  return accessory ? (
    <div className={`${styles.row} ${isActive ? styles.rowCurrent : ""}`}>
      {link}
      <span className={styles.accessory}>{accessory}</span>
    </div>
  ) : (
    link
  );
}

export interface SidebarNavButtonProps {
  /** Icon to display */
  icon: ReactNode;
  /** Label text (also the accessible name) */
  label: string;
  /** Action invoked on click */
  onClick: () => void;
  /** Title tooltip (defaults to label) */
  title?: string;
  /** Extra class names appended to sidebar-nav-item */
  className?: string;
  /** Secondary action on right-click or a held press, given the button's rect */
  onLongPress?: (anchor: DOMRect) => void;
}

/**
 * Action variant of {@link SidebarNavItem}: emits the identical markup
 * (`sidebar-nav-item` > icon + `sidebar-nav-text` label) as a <button>
 * instead of a <Link>, so action items inherit the same styling and the
 * collapsed-rail icon-only CSS contract (`.sidebar-collapsed .sidebar-nav-text
 * { display: none }`) rather than re-implementing them with a bespoke guard.
 */
export function SidebarNavButton({
  icon,
  label,
  onClick,
  title,
  className = "",
  onLongPress,
}: SidebarNavButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const press = useLongPress(() => {
    const button = buttonRef.current;
    if (button) onLongPress?.(button.getBoundingClientRect());
  });
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`sidebar-nav-item ${styles.item} ${className}`.trim()}
      {...(onLongPress ? press.handlers : {})}
      onClick={onLongPress ? press.click(onClick) : onClick}
      aria-label={label}
      title={title ?? label}
    >
      <span className={styles.icon}>{icon}</span>
      <span className={`sidebar-nav-text ${styles.text}`}>{label}</span>
    </button>
  );
}

export interface SidebarNavSectionProps {
  children: ReactNode;
  /** Names the navigation landmark. */
  label?: string;
}

/** The navigation landmark holding every destination group. */
export function SidebarNavSection({ children, label }: SidebarNavSectionProps) {
  return (
    <nav className={`sidebar-nav-section ${styles.section}`} aria-label={label}>
      {children}
    </nav>
  );
}

/**
 * A run of destinations. Labelled groups get a mono caption, which the
 * collapsed rail draws as a dashed rule instead.
 */
export function SidebarNavGroup({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  if (!label) return <div className={styles.group}>{children}</div>;
  return (
    <div className={styles.group} role="group" aria-label={label}>
      <p className={styles.groupLabel}>
        <span className={`sidebar-nav-text ${styles.groupLabelText}`}>
          {label}
        </span>
      </p>
      {children}
    </div>
  );
}
