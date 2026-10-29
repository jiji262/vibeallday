import { Link } from "react-router-dom";
import { useVersion } from "../../hooks/useVersion";
import { useI18n } from "../../i18n";
import { XIcon } from "../garden/icons";
import { SidebarLauncher } from "../SidebarLauncher";
import { VibeAllDayLogo } from "../VibeAllDayLogo";
import styles from "./SidebarBrand.module.css";

interface SidebarBrandProps {
  basePath: string;
  isDesktop: boolean;
  isCollapsed: boolean;
  onToggleExpanded?: () => void;
  onMinimize?: () => void;
  onClose: () => void;
  onNavigate: () => void;
}

const CLOSE_ICON_SIZE = 18;
const MINIMIZE_ICON_SIZE = 12;

/** "0.10.2" reads as "v0.10.2"; servers that already prefix keep theirs. */
export function formatVersionTag(current: string | undefined): string | null {
  if (!current) return null;
  return current.startsWith("v") ? current : `v${current}`;
}

function MinimizeButton({ onMinimize }: { onMinimize: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className={`sidebar-minimize ${styles.minimize}`}
      onClick={onMinimize}
      title={t("actionMinimizeSidebar")}
      aria-label={t("actionMinimizeSidebar")}
    >
      <svg
        width={MINIMIZE_ICON_SIZE}
        height={MINIMIZE_ICON_SIZE}
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <line x1="2" y1="10" x2="10" y2="10" />
      </svg>
    </button>
  );
}

function RailBrand({
  onToggleExpanded,
  onMinimize,
}: Pick<SidebarBrandProps, "onToggleExpanded" | "onMinimize">) {
  const { t } = useI18n();
  return (
    <div className={`sidebar-header ${styles.header} ${styles.rail}`}>
      {onToggleExpanded && (
        <SidebarLauncher
          className={styles.toggle}
          label={t("actionExpandSidebar")}
          newSessionLabel={t("sidebarNewSession")}
          onActivate={onToggleExpanded}
        />
      )}
      {onMinimize && <MinimizeButton onMinimize={onMinimize} />}
    </div>
  );
}

/**
 * Brand row: gradient tile, serif wordmark and mono version, with the
 * collapse toggle (desktop) or close button (drawer) at the far edge. The
 * collapsed rail keeps only the expand toggle and the minimize control.
 */
export function SidebarBrand({
  basePath,
  isDesktop,
  isCollapsed,
  onToggleExpanded,
  onMinimize,
  onClose,
  onNavigate,
}: SidebarBrandProps) {
  const { t } = useI18n();
  const { version } = useVersion();
  const versionTag = formatVersionTag(version?.current) ?? undefined;

  if (isDesktop && isCollapsed) {
    return (
      <RailBrand onToggleExpanded={onToggleExpanded} onMinimize={onMinimize} />
    );
  }

  return (
    <div className={`sidebar-header ${styles.header}`}>
      <Link
        to={`${basePath}/inbox`}
        className={`sidebar-brand sidebar-brand-link ${styles.brandLink}`}
        title={t("sidebarOverview")}
        onClick={isDesktop ? undefined : onNavigate}
      >
        <VibeAllDayLogo version={versionTag} />
      </Link>
      <BrandTrailingControl
        isDesktop={isDesktop}
        onToggleExpanded={onToggleExpanded}
        onClose={onClose}
      />
    </div>
  );
}

function BrandTrailingControl({
  isDesktop,
  onToggleExpanded,
  onClose,
}: Pick<SidebarBrandProps, "isDesktop" | "onToggleExpanded" | "onClose">) {
  const { t } = useI18n();
  if (!isDesktop) {
    return (
      <button
        type="button"
        className={`sidebar-close ${styles.close}`}
        onClick={onClose}
        aria-label={t("actionCloseSidebar")}
      >
        <XIcon size={CLOSE_ICON_SIZE} />
      </button>
    );
  }
  if (!onToggleExpanded) return null;
  return (
    <SidebarLauncher
      className={styles.toggle}
      label={t("actionToggleSidebar")}
      newSessionLabel={t("sidebarNewSession")}
      onActivate={onToggleExpanded}
    />
  );
}
