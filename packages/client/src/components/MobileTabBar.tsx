import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { type MessageKey, useI18n } from "../i18n";
import { useInboxCounts } from "../lib/clientSummaryStore";
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

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const TABS: readonly TabSpec[] = [
  {
    key: "sessions",
    to: "/inbox",
    labelKey: "tabSessions",
    prefixes: ["/inbox", "/sessions"],
    icon: (
      <svg {...ICON_PROPS} aria-hidden="true">
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V16A2.5 2.5 0 0 1 4 13.5z" />
        <path d="M8.5 8.5h7M8.5 11.5h4.5" />
      </svg>
    ),
  },
  {
    key: "new",
    to: "/new-session",
    labelKey: "tabNew",
    prefixes: ["/new-session"],
    icon: (
      <svg {...ICON_PROPS} strokeWidth={2.2} aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  {
    key: "projects",
    to: "/projects",
    labelKey: "tabProjects",
    prefixes: ["/projects"],
    icon: (
      <svg {...ICON_PROPS} aria-hidden="true">
        <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      </svg>
    ),
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
    icon: (
      <svg {...ICON_PROPS} aria-hidden="true">
        <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
        <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
        <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
        <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
      </svg>
    ),
  },
];

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

/** Phone navigation shares one Sessions destination for Overview and All. */
export function MobileTabBar() {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  const { pathname } = useLocation();
  const { needsAttention } = useInboxCounts();
  const path = stripBasePath(pathname, basePath);
  // Session URLs live under Projects, but belong to the Sessions destination.
  const activeTab = /^\/projects\/[^/]+\/sessions\/[^/]+(?:\/|$)/.test(path)
    ? "sessions"
    : TABS.find((tab) =>
        tab.prefixes.some((prefix) => matchesPrefix(path, prefix)),
      )?.key;

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
            <span className={styles.iconWrap}>{tab.icon}</span>
            <span className={styles.label}>{label}</span>
            {badge > 0 ? (
              <span className={styles.badge} aria-hidden="true">
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
