import type { ReactNode } from "react";
import { useI18n } from "../i18n";
import { useOptionalNavigationLayout } from "../layouts/NavigationLayout";
import { truncateText } from "../lib/text";
import { HostIdentityMarker } from "./HostIdentityMarker";
import styles from "./PageHeader.module.css";
import sessionHeaderStyles from "./SessionHeader.module.css";
import { SidebarLauncher } from "./SidebarLauncher";

interface PageHeaderProps {
  title: string;
  /** Short page guidance; session workspace headers keep their compact owner. */
  description?: string;
  /** Optional custom element to render instead of the default title */
  titleElement?: ReactNode;
  /** Optional action for clicking the default title text */
  onTitleClick?: () => void;
  /** Mobile/overlay: opens the sidebar overlay */
  onOpenSidebar?: () => void;
  /** Whether we're in desktop mode (wide screen), where the sidebar owns its toggle */
  isWideScreen?: boolean;
  /** Show a back button instead of sidebar toggle */
  showBack?: boolean;
  /** Callback when back button is clicked */
  onBack?: () => void;
  /** Right-aligned header actions (same row as the title) */
  actions?: ReactNode;
}

const BackIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export function PageHeader({
  title,
  description,
  titleElement,
  onTitleClick,
  onOpenSidebar,
  isWideScreen = false,
  showBack = false,
  onBack,
  actions,
}: PageHeaderProps) {
  const { t } = useI18n();
  // Desktop keeps the toggle inside the sidebar itself, whether expanded or
  // collapsed to the icon rail, and phone tab-bar routes navigate by the tab
  // bar. Only the remaining overlay case opens the sidebar from here.
  const tabBarNavigation = useOptionalNavigationLayout()?.tabBarNavigation;
  const handleToggle =
    isWideScreen || tabBarNavigation ? undefined : onOpenSidebar;
  const toggleTitle = t("actionOpenSidebar");
  const hasLeadingControl = Boolean((showBack && onBack) || handleToggle);

  return (
    <header className={`session-header ${styles.header}`}>
      <div
        className={`session-header-inner ${sessionHeaderStyles.row} ${styles.row}${hasLeadingControl ? "" : ` ${sessionHeaderStyles.noLeadingControl}`}`}
      >
        <div className="session-header-left">
          {showBack && onBack ? (
            <button
              type="button"
              className="sidebar-toggle"
              onClick={onBack}
              title={t("actionBack")}
              aria-label={t("actionBack")}
            >
              <BackIcon />
            </button>
          ) : (
            handleToggle && (
              <SidebarLauncher
                label={toggleTitle}
                newSessionLabel={t("sidebarNewSession")}
                onActivate={handleToggle}
              />
            )
          )}
          <HostIdentityMarker />
          <div className={styles.identity}>
            {titleElement ??
              (onTitleClick ? (
                <button
                  type="button"
                  className={`session-title ${styles.title}`}
                  onClick={onTitleClick}
                  title={title.length > 60 ? title : undefined}
                >
                  {truncateText(title)}
                </button>
              ) : (
                <h1
                  className={`session-title ${styles.title}`}
                  title={title.length > 60 ? title : undefined}
                >
                  {truncateText(title)}
                </h1>
              ))}
            {description && <p className={styles.description}>{description}</p>}
          </div>
        </div>
        {actions && <div className="session-header-actions">{actions}</div>}
      </div>
    </header>
  );
}
