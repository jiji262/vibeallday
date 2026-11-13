import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { type MessageKey, useI18n } from "../i18n";
import { useInboxCounts } from "../lib/clientSummaryStore";
import {
  FolderIcon,
  InboxIcon,
  MoreHorizontalIcon,
  PlusIcon,
} from "./garden/icons";
import styles from "./MobileTabBar.module.css";

type TabKey = "sessions" | "new" | "projects" | "more";

interface TabSpec {
  key: TabKey;
  to: string;
  labelKey: MessageKey;
  /** Route prefixes (after the relay base path) that select this tab. */
  prefixes: readonly string[];
  icon: ReactNode;
}

const TAB_ICON_SIZE = 22;
const BADGE_CAP = 99;

const TABS: readonly TabSpec[] = [
  {
    key: "sessions",
    to: "/inbox",
    labelKey: "tabSessions",
    prefixes: ["/inbox", "/sessions", "/triage"],
    icon: <InboxIcon size={TAB_ICON_SIZE} />,
  },
  {
    key: "new",
    to: "/new-session",
    labelKey: "tabNew",
    prefixes: ["/new-session"],
    icon: <PlusIcon size={TAB_ICON_SIZE} strokeWidth="2.2" />,
  },
  {
    key: "projects",
    to: "/projects",
    labelKey: "tabProjects",
    prefixes: ["/projects"],
    icon: <FolderIcon size={TAB_ICON_SIZE} />,
  },
  {
    key: "more",
    to: "/more",
    labelKey: "tabMore",
    prefixes: [
      "/more",
      "/settings",
      "/agents",
      "/issues",
      "/bang-commands",
      "/devices",
      "/git-status",
    ],
    icon: <MoreHorizontalIcon size={TAB_ICON_SIZE} />,
  },
];

const SESSION_ROUTE = /^\/projects\/[^/]+\/sessions\/[^/]+(?:\/|$)/;

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** Visible-route path without the relay host prefix. */
function stripBasePath(pathname: string, basePath: string): string {
  if (basePath && pathname.startsWith(basePath)) {
    return pathname.slice(basePath.length) || "/";
  }
  return pathname;
}

/**
 * Session URLs live under Projects but belong to Sessions, and Source
 * control opened from a session (`?from=session`) keeps that context.
 */
function activeTabFor(path: string, search: string): TabKey | undefined {
  if (SESSION_ROUTE.test(path)) return "sessions";
  if (
    matchesPrefix(path, "/git-status") &&
    new URLSearchParams(search).get("from") === "session"
  ) {
    return "sessions";
  }
  return TABS.find((tab) =>
    tab.prefixes.some((prefix) => matchesPrefix(path, prefix)),
  )?.key;
}

/**
 * Phone navigation shares one Sessions destination for Overview, All and
 * Triage; New is the centre accent pill.
 */
export function MobileTabBar() {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  const { pathname, search } = useLocation();
  const { needsAttention } = useInboxCounts();
  const activeTab = activeTabFor(stripBasePath(pathname, basePath), search);

  return (
    <nav className={styles.bar} aria-label={t("tabBarLabel")}>
      {TABS.map((tab) => {
        const active = tab.key === activeTab;
        const badge = tab.key === "sessions" ? needsAttention : 0;
        const label = t(tab.labelKey);
        const classes = [
          styles.tab,
          tab.key === "new" ? styles.newTab : "",
          active ? styles.active : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <Link
            key={tab.key}
            to={`${basePath}${tab.to}`}
            className={classes}
            aria-current={active ? "page" : undefined}
            aria-label={
              badge > 0
                ? `${label}, ${t("tabNowBadge", { count: badge })}`
                : undefined
            }
            data-tab={tab.key}
          >
            <span
              className={
                tab.key === "new"
                  ? `${styles.iconWrap} ${styles.fab}`
                  : styles.iconWrap
              }
            >
              {tab.icon}
            </span>
            <span className={styles.label}>{label}</span>
            {badge > 0 ? (
              <span className={styles.badge} aria-hidden="true">
                {badge > BADGE_CAP ? `${BADGE_CAP}+` : badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
