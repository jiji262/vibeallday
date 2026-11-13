import type { ReactNode } from "react";
import type {
  FileAccessInfo,
  FileAccessSettings,
  NetworkBindingState,
  ServerInfo,
} from "../../api/client";
import { Status, type StatusState } from "../../components/garden/StatusDot";
import { useI18n } from "../../i18n";
import styles from "./LocalAccessSettings.module.css";

type Translate = ReturnType<typeof useI18n>["t"];

const ALL_INTERFACE_HOSTS = new Set(["0.0.0.0", "::"]);

/** A custom line that grants whole-disk read, so the UI can flag it. */
export function isWholeDiskPath(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === "/" || /^[A-Za-z]:[\\/]?$/.test(trimmed);
}

/** "Listening on host:port [and host:port]" for the status card header. */
function ListeningOn({
  serverInfo,
  binding,
}: {
  serverInfo: ServerInfo;
  binding: NetworkBindingState | null;
}) {
  const { t } = useI18n();
  const networkHost = binding?.network.host;
  const networkPort = binding?.network.port ?? serverInfo.port;
  const networkEnabled = binding?.network.enabled ?? false;
  // Bound to all interfaces on the same port: that one address says it all.
  if (
    networkEnabled &&
    networkHost &&
    ALL_INTERFACE_HOSTS.has(networkHost) &&
    networkPort === serverInfo.port
  ) {
    return (
      <>
        {t("localAccessListeningOn")}{" "}
        <code>
          {networkHost}:{networkPort}
        </code>
      </>
    );
  }
  return (
    <>
      {t("localAccessListeningOn")}{" "}
      <code>
        {serverInfo.host}:{serverInfo.port}
      </code>
      {networkEnabled && networkHost && (
        <>
          {" "}
          {t("localAccessListeningAnd")}{" "}
          <code>
            {networkHost}:{networkPort}
          </code>
        </>
      )}
    </>
  );
}

interface RiskItem {
  label: string;
  state: StatusState;
  value: string;
  hint: string;
}

interface SignInRiskInput {
  authEnabled: boolean;
  localhostOpen: boolean;
  exposed: boolean;
}

function signInRisk(t: Translate, input: SignInRiskInput): RiskItem {
  const label = t("localAccessRiskSignInLabel");
  if (input.authEnabled) {
    return {
      label,
      state: "ok",
      value: t("localAccessRiskPasswordOn"),
      hint: input.localhostOpen
        ? t("localAccessRiskLocalhostOpenHint")
        : t("localAccessRiskPasswordAllHint"),
    };
  }
  return {
    label,
    state: input.exposed ? "err" : "idle",
    value: t("localAccessRiskPasswordOff"),
    hint: input.exposed
      ? t("localAccessRiskPasswordOffExposedHint")
      : t("localAccessRiskPasswordOffLocalHint"),
  };
}

function fileRisk(
  t: Translate,
  fileAccess: FileAccessSettings,
  info: FileAccessInfo | null,
): RiskItem {
  const label = t("localAccessRiskFilesLabel");
  if (info?.envPinned) {
    return {
      label,
      state: "idle",
      value: info.envPaths.length > 0 ? info.envPaths.join(", ") : "—",
      hint: t("fileAccessSetViaEnv"),
    };
  }
  const builtIn = [
    fileAccess.projects,
    fileAccess.uploads,
    fileAccess.temp,
    fileAccess.home,
  ].filter(Boolean).length;
  const wholeDisk = fileAccess.custom.some(isWholeDiskPath);
  return {
    label,
    state: wholeDisk || fileAccess.home ? "attn" : "ok",
    value: t("localAccessRiskFilesCount", {
      folders: builtIn,
      custom: fileAccess.custom.length,
    }),
    hint: wholeDisk
      ? t("localAccessRiskFilesDisk")
      : fileAccess.home
        ? t("localAccessRiskFilesHome")
        : t("localAccessRiskFilesSafe"),
  };
}

export interface LocalAccessStatusCardProps {
  serverInfo: ServerInfo | null;
  binding: NetworkBindingState | null;
  authEnabled: boolean;
  localhostOpen: boolean;
  /** The saved file-access grant (not the unsaved draft). */
  fileAccess: FileAccessSettings;
  fileAccessInfo: FileAccessInfo | null;
}

/**
 * The applied state at a glance: who can reach this server, whether they
 * need a password, and how much of the disk the file viewer can read.
 */
export function LocalAccessStatusCard({
  serverInfo,
  binding,
  authEnabled,
  localhostOpen,
  fileAccess,
  fileAccessInfo,
}: LocalAccessStatusCardProps) {
  const { t } = useI18n();
  const exposed = Boolean(
    serverInfo?.boundToAllInterfaces || binding?.network.enabled,
  );
  const items: RiskItem[] = [
    {
      label: t("localAccessRiskNetworkLabel"),
      state: exposed ? "attn" : "ok",
      value: exposed
        ? t("localAccessRiskNetworkLan")
        : t("localAccessRiskNetworkLocal"),
      hint: exposed
        ? t("localAccessRiskNetworkLanHint")
        : t("localAccessRiskNetworkLocalHint"),
    },
    signInRisk(t, { authEnabled, localhostOpen, exposed }),
    fileRisk(t, fileAccess, fileAccessInfo),
  ];
  let listening: ReactNode = t("localAccessUnableToFetch");
  if (serverInfo) {
    listening = <ListeningOn serverInfo={serverInfo} binding={binding} />;
  }
  return (
    <section
      className={`settings-group ${styles.statusCard}`}
      aria-labelledby="local-access-status-title"
      data-local-access-status
    >
      <div className={styles.statusHead}>
        <h3 id="local-access-status-title">{t("localAccessStatusTitle")}</h3>
        <span className={styles.statusListening}>{listening}</span>
      </div>
      <div className={styles.riskItems}>
        {items.map((item) => (
          <div key={item.label} className={styles.riskItem}>
            <span className={styles.riskLabel}>{item.label}</span>
            <Status state={item.state} className={styles.riskStatus}>
              {item.value}
            </Status>
            <span className={styles.riskHint}>{item.hint}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
