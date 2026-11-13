import { type ComponentType, useId } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Tag } from "../components/garden/Badge";
import { Button } from "../components/garden/Button";
import { Card } from "../components/garden/Card";
import {
  ChevronRightIcon,
  type IconProps,
  LogOutIcon,
  SwitchHostIcon,
} from "../components/garden/icons";
import { ScopeTag } from "../components/garden/ScopeTag";
import {
  Segmented,
  type SegmentedOption,
} from "../components/garden/Segmented";
import { Status, StatusDot } from "../components/garden/StatusDot";
import { PageHeader } from "../components/PageHeader";
import { useHostConnection } from "../components/shell/hostConnection";
import { PageIntro } from "../components/shell/PageIntro";
import { pageWidthClass } from "../components/shell/pageWidth";
import {
  useConnectedHost,
  switchHost,
} from "../components/sidebar/connectedHost";
import {
  type ShellDestinationGroup,
  useShellDestinations,
} from "../components/sidebar/shellDestinations";
import { useHostIdentity } from "../contexts/HostIdentityContext";
import { useActingPrincipal } from "../hooks/useActingPrincipal";
import { useGlobalActiveAgents } from "../hooks/useGlobalActiveAgents";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { type Theme, useTheme } from "../hooks/useTheme";
import { type MessageKey, useI18n } from "../i18n";
import { MainContent, useNavigationLayout } from "../layouts";
import styles from "./MorePage.module.css";

const ROW_ICON_SIZE = 18;
const CHEVRON_SIZE = 16;
const ACTION_ICON_SIZE = 16;

/** The tab bar already carries Sessions (Overview and All) and Projects. */
const TAB_BAR_KEYS: ReadonlySet<string> = new Set([
  "overview",
  "sessions",
  "projects",
]);

interface MoreItem {
  key: string;
  label: string;
  hint?: string;
  Icon: ComponentType<IconProps>;
  to?: string;
  onSelect?: () => void;
  live?: boolean;
  /** Beta tag text, as the sidebar shows it. */
  tag?: string;
}

const GROUPS: readonly { group: ShellDestinationGroup; title: MessageKey }[] = [
  { group: "work", title: "moreGroupWork" },
  { group: "tools", title: "sidebarGroupTools" },
  { group: "system", title: "sidebarGroupSystem" },
];

/** Acting as another user changes every list, so the app reloads as yourself. */
async function returnToSuperuser() {
  await api.logoutUser();
  window.location.reload();
}

/** Destinations the tab bar leaves out, plus the switched superuser's exit. */
function useMoreGroups() {
  const { t } = useI18n();
  const destinations = useShellDestinations();
  const activeAgents = useGlobalActiveAgents();
  const { principal } = useActingPrincipal();
  const byGroup = new Map<ShellDestinationGroup, MoreItem[]>();
  for (const destination of destinations) {
    if (TAB_BAR_KEYS.has(destination.key)) continue;
    const items = byGroup.get(destination.group) ?? [];
    items.push({
      key: destination.key,
      label: t(destination.labelKey),
      hint: destination.hintKey ? t(destination.hintKey) : undefined,
      Icon: destination.Icon,
      to: destination.to,
      live: destination.key === "agents" && activeAgents > 0,
      tag: destination.beta ? t("sidebarBetaTag") : undefined,
    });
    byGroup.set(destination.group, items);
  }
  if (principal.switched && principal.username) {
    byGroup.get("system")?.push({
      key: "return-to-superuser",
      label: t("sidebarReturnToSuperuser", { username: principal.username }),
      hint: t("moreReturnToSuperuserHint"),
      Icon: LogOutIcon,
      onSelect: () => void returnToSuperuser(),
    });
  }
  return GROUPS.map(({ group, title }) => ({
    group,
    title: t(title),
    items: byGroup.get(group) ?? [],
  }));
}

function MoreRow({ item, basePath }: { item: MoreItem; basePath: string }) {
  const body = (
    <>
      <span className={styles.icon} aria-hidden="true">
        <item.Icon size={ROW_ICON_SIZE} />
      </span>
      <span className={styles.text}>
        <span className={styles.label}>
          {item.label}
          {item.live ? <StatusDot state="run" /> : null}
          {item.tag ? <Tag>{item.tag}</Tag> : null}
        </span>
        {item.hint ? <span className={styles.hint}>{item.hint}</span> : null}
      </span>
      <ChevronRightIcon size={CHEVRON_SIZE} className={styles.chevron} />
    </>
  );
  if (item.to) {
    return (
      <Link to={`${basePath}${item.to}`} className={styles.row}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" className={styles.row} onClick={item.onSelect}>
      {body}
    </button>
  );
}

/** Which machine this app runs against, with host switching when remote. */
function HostCard() {
  const { t } = useI18n();
  const { remote, name, caption } = useConnectedHost();
  const { icon } = useHostIdentity();
  const connection = useHostConnection();
  const titleId = useId();
  return (
    <Card as="section" className={styles.host} aria-labelledby={titleId}>
      <div className={styles.hostHead}>
        <span className={styles.hostMark} aria-hidden="true">
          {icon ?? name.trim().charAt(0).toUpperCase()}
        </span>
        <span className={styles.text}>
          <span className={styles.hostTitle}>
            <h2 className={styles.hostName} id={titleId}>
              {name}
            </h2>
            <Status state={connection.state}>{t(connection.labelKey)}</Status>
          </span>
          <span className={styles.caption}>{caption}</span>
        </span>
      </div>
      {remote ? null : (
        <p className={styles.hostHint}>{t("moreHostSettingsHint")}</p>
      )}
      {remote ? (
        <Button
          icon={<SwitchHostIcon size={ACTION_ICON_SIZE} />}
          onClick={() => switchHost(remote)}
          title={t("moreSwitchHostHint")}
          block
        >
          {t("sidebarSwitchHost")}
        </Button>
      ) : null}
    </Card>
  );
}

const THEME_OPTION_LABELS: readonly { value: Theme; label: MessageKey }[] = [
  { value: "light", label: "settingsAppearanceThemeCeladon" },
  { value: "dark", label: "settingsAppearanceThemeNight" },
  { value: "verydark", label: "moreThemeOledShort" },
  { value: "auto", label: "settingsAppearanceThemeSystem" },
];

/** Skin picker; applies at once and is saved in this browser only. */
function AppearanceRow() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const options: SegmentedOption<Theme>[] = THEME_OPTION_LABELS.map(
    ({ value, label }) => ({ value, label: t(label) }),
  );
  const title = t("moreAppearanceTitle");
  return (
    <div className={styles.setRow}>
      <span className={styles.setTitle}>
        {title}
        <ScopeTag scope="local" />
      </span>
      <Segmented
        label={title}
        options={options}
        value={theme}
        onChange={setTheme}
        block
      />
    </div>
  );
}

/** Phone "More" tab: host, then the destinations the tab bar leaves out. */
export function MorePage() {
  const { t } = useI18n();
  const { openSidebar, isWideScreen } = useNavigationLayout();
  const basePath = useRemoteBasePath();
  const groups = useMoreGroups();

  return (
    <MainContent isWideScreen={isWideScreen}>
      <PageHeader
        title={t("tabMore")}
        onOpenSidebar={openSidebar}
        isWideScreen={isWideScreen}
        intro="content"
        hostChip={false}
      />
      <main className="page-scroll-container">
        <div className={`page-content-inner ${pageWidthClass("narrow")}`}>
          <PageIntro title={t("tabMore")} />
          <HostCard />
          {groups.map(({ group, title, items }) =>
            items.length === 0 ? null : (
              <section key={group} className={styles.group} aria-label={title}>
                <h2 className={styles.groupTitle}>{title}</h2>
                <Card flush className={styles.list}>
                  {items.map((item) => (
                    <MoreRow key={item.key} item={item} basePath={basePath} />
                  ))}
                  {group === "system" ? <AppearanceRow /> : null}
                </Card>
              </section>
            ),
          )}
        </div>
      </main>
    </MainContent>
  );
}
