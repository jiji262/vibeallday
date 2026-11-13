import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { useOptionalNavigationLayout } from "../layouts/NavigationLayout";
import { truncateText } from "../lib/text";
import {
  Breadcrumb,
  type Crumb,
  type CrumbLinkProps,
} from "./garden/Breadcrumb";
import { Eyebrow } from "./garden/Eyebrow";
import { ChevronLeftIcon } from "./garden/icons";
import { HostChip, HostIdentityMarker } from "./HostIdentityMarker";
import styles from "./PageHeader.module.css";
import { SearchTrigger } from "./shell/SearchTrigger";
import { SidebarLauncher } from "./SidebarLauncher";

/** Titles longer than this keep their full text in a tooltip. */
const TITLE_TOOLTIP_LENGTH = 60;
const BACK_ICON_SIZE = 18;

interface PageHeaderProps {
  title: string;
  /** Short page guidance shown under the header intro title. */
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
  /** Right-aligned top-bar actions, before the search trigger. */
  actions?: ReactNode;
  /** Top-bar path; defaults to a single crumb holding `title`. */
  breadcrumbs?: readonly Crumb[];
  /**
   * "header" draws the compact page title under the top bar (unmigrated
   * pages). "content" leaves the title to a `PageIntro` in the page body.
   */
  intro?: "header" | "content";
  /** Mono context line above the header intro title. */
  eyebrow?: ReactNode[];
  /** Phone host chip; off where the page itself presents the host. */
  hostChip?: boolean;
}

function crumbLink({ to, className, title, children }: CrumbLinkProps) {
  return (
    <Link to={to} className={className} title={title}>
      {children}
    </Link>
  );
}

function LeadingControl({
  onBack,
  onOpen,
}: {
  onBack?: () => void;
  onOpen?: () => void;
}) {
  const { t } = useI18n();
  if (onBack) {
    return (
      <button
        type="button"
        className={`sidebar-toggle ${styles.control}`}
        onClick={onBack}
        title={t("actionBack")}
        aria-label={t("actionBack")}
      >
        <ChevronLeftIcon size={BACK_ICON_SIZE} />
      </button>
    );
  }
  if (!onOpen) return null;
  return (
    <SidebarLauncher
      label={t("actionOpenSidebar")}
      newSessionLabel={t("sidebarNewSession")}
      onActivate={onOpen}
      className={styles.control}
    />
  );
}

interface IntroProps {
  title: string;
  description?: string;
  titleElement?: ReactNode;
  onTitleClick?: () => void;
  eyebrow?: ReactNode[];
}

function HeaderIntro({
  title,
  description,
  titleElement,
  onTitleClick,
  eyebrow,
}: IntroProps) {
  const tooltip = title.length > TITLE_TOOLTIP_LENGTH ? title : undefined;
  const titleClass = `session-title ${styles.title}`;
  return (
    <div className={styles.intro}>
      {eyebrow && eyebrow.length > 0 ? (
        <Eyebrow parts={eyebrow} className={styles.eyebrow} />
      ) : null}
      {titleElement ??
        (onTitleClick ? (
          <button
            type="button"
            className={titleClass}
            onClick={onTitleClick}
            title={tooltip}
          >
            {truncateText(title)}
          </button>
        ) : (
          <h1 className={titleClass} title={tooltip}>
            {truncateText(title)}
          </h1>
        ))}
      {description && <p className={styles.description}>{description}</p>}
    </div>
  );
}

/**
 * The page top bar: leading control, breadcrumb, actions and the search
 * trigger, with an optional compact intro row for pages that have not moved
 * their title into a `PageIntro`. Phones draw it as one sticky row: back
 * button, the title (header intro or last crumb), host chip and actions.
 */
export function PageHeader({
  title,
  isWideScreen = false,
  showBack = false,
  onBack,
  onOpenSidebar,
  actions,
  breadcrumbs,
  intro = "header",
  hostChip = true,
  ...introProps
}: PageHeaderProps) {
  const { t } = useI18n();
  // Desktop keeps the toggle inside the sidebar itself, whether expanded or
  // collapsed to the icon rail, and phone tab-bar routes navigate by the tab
  // bar. Only the remaining overlay case opens the sidebar from here.
  // 页面没传 isWideScreen 时以布局上下文为准，避免宽屏多出侧栏按钮。
  const layout = useOptionalNavigationLayout();
  const hideSidebarToggle =
    isWideScreen || layout?.isWideScreen || layout?.tabBarNavigation;
  const openSidebar = hideSidebarToggle ? undefined : onOpenSidebar;
  const back = showBack ? onBack : undefined;
  const crumbs = breadcrumbs ?? [{ label: title, title }];
  const headerIntro = intro === "header";

  return (
    <header
      className={`session-header ${styles.header}`}
      data-intro={intro}
      data-default-crumbs={breadcrumbs ? undefined : ""}
      data-back={back ? "" : undefined}
    >
      <div className={`session-header-inner ${styles.inner}`}>
        <div className={`session-header-left ${styles.lead}`}>
          <LeadingControl onBack={back} onOpen={openSidebar} />
          <HostIdentityMarker />
          <Breadcrumb
            items={crumbs}
            label={t("breadcrumbLabel")}
            renderLink={crumbLink}
            className={styles.crumbs}
          />
        </div>
        <div className={`session-header-actions ${styles.tools}`}>
          {hostChip ? <HostChip className={styles.hostChip} /> : null}
          {actions}
          <SearchTrigger />
        </div>
        {headerIntro ? <HeaderIntro title={title} {...introProps} /> : null}
      </div>
    </header>
  );
}
