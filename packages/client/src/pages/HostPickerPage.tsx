/**
 * HostPickerPage - Saved hosts list and login mode selection.
 *
 * Shows:
 * - List of saved hosts with status indicators and quick connect
 * - "Add Host" section with relay/login/direct options
 */

import {
  categorizeResumeError,
  requiresResumeLogin,
} from "../lib/connection/remoteErrors";
import { getResumeError } from "../lib/connection/resumeErrors";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AuthError,
  AuthReconnecting,
  AuthShell,
} from "../components/auth/AuthShell";
import { useRemoteConnection } from "../contexts/RemoteConnectionContext";
import { signInRequiredState } from "../hooks/useSignInRequiredNotice";
import { useI18n } from "../i18n";
import { loadSavedHosts, removeHost, type SavedHost } from "../lib/hostStorage";
import { relayEndpoints } from "../lib/connection/relayEndpoints";
import { type HostStatus, HostRow, ModeOption } from "./HostPickerRows";
import styles from "./HostPickerPage.module.css";

interface HostStatusMap {
  [hostId: string]: HostStatus;
}

function relayLoginPath(host: SavedHost): string {
  const params = new URLSearchParams();
  if (host.relayUsername) {
    params.set("u", host.relayUsername);
  }
  if (host.relayUrl) {
    params.set("r", host.relayUrl);
  }
  const query = params.toString();
  return `/login/relay${query ? `?${query}` : ""}`;
}

export function HostPickerPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const {
    isAutoResuming,
    connectViaRelay,
    connect,
    currentHostId,
    setCurrentHostId,
  } = useRemoteConnection();
  const [hosts, setHosts] = useState<SavedHost[]>([]);
  const [hostStatuses, setHostStatuses] = useState<HostStatusMap>({});
  const [connectingHostId, setConnectingHostId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load hosts on mount
  useEffect(() => {
    const data = loadSavedHosts();
    setHosts(data.hosts);
  }, []);

  // Check if a relay host's server is online via the relay's HTTP API
  const checkRelayHostStatus = useCallback(
    async (host: SavedHost): Promise<HostStatus> => {
      if (!host.relayUrl || !host.relayUsername) return "unknown";

      try {
        const endpoints = relayEndpoints(host.relayUrl);
        if (!endpoints) return "offline";
        const res = await fetch(
          new URL(
            `online/${encodeURIComponent(host.relayUsername)}`,
            endpoints.httpBaseUrl,
          ),
          { signal: AbortSignal.timeout(5000) },
        );
        if (!res.ok) return "offline";
        const data = await res.json();
        return data.online ? "online" : "offline";
      } catch {
        return "offline";
      }
    },
    [],
  );

  // Check status for relay hosts
  useEffect(() => {
    const relayHosts = hosts.filter((h) => h.mode === "relay");
    if (relayHosts.length === 0) return;

    // Mark all as checking
    setHostStatuses((prev) => {
      const next = { ...prev };
      for (const host of relayHosts) {
        if (!next[host.id]) {
          next[host.id] = "checking";
        }
      }
      return next;
    });

    // Check each relay host status
    for (const host of relayHosts) {
      checkRelayHostStatus(host).then((status) => {
        setHostStatuses((prev) => ({ ...prev, [host.id]: status }));
      });
    }
  }, [checkRelayHostStatus, hosts]);

  // Connect to a saved host
  const handleConnectHost = useCallback(
    async (host: SavedHost) => {
      setConnectingHostId(host.id);
      setError(null);

      try {
        if (host.mode === "relay") {
          if (!host.relayUrl || !host.relayUsername) {
            throw new Error(t("hostPickerMissingRelayConfiguration"));
          }

          // If host has a session, try to use it for auto-resume
          // Otherwise, navigate to relay login pre-filled
          if (host.session) {
            // Set current host ID before connecting so ConnectionGate knows where to redirect
            setCurrentHostId(host.id);
            await connectViaRelay({
              relayUrl: host.relayUrl,
              relayUsername: host.relayUsername,
              srpUsername: host.srpUsername,
              srpPassword: "", // Ignored when session is provided
              rememberMe: true,
              onStatusChange: () => {},
              session: host.session,
            });
            // ConnectionGate redirects to the host's canonical relay projects route.
          } else {
            // No session - go to relay login pre-filled
            navigate(relayLoginPath(host));
          }
        } else {
          // Direct mode
          if (!host.wsUrl) {
            throw new Error(t("hostPickerMissingWebSocketUrl"));
          }

          if (host.session) {
            await connect(host.wsUrl, host.srpUsername, "", true);
            // Success - land on Now (direct mode doesn't use username URLs)
            navigate("/inbox");
          } else {
            // No session - go to direct login pre-filled
            navigate("/login/direct");
          }
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : t("hostPickerErrorConnectionFailed");
        const reason = categorizeResumeError(err);
        if (requiresResumeLogin(reason)) {
          // A received refusal requires fresh login under the existing policy.
          // The transport owns retirement of the exact attempted session.
          navigate(
            host.mode === "relay" ? relayLoginPath(host) : "/login/direct",
            { state: signInRequiredState(reason) },
          );
          return;
        }
        // Transport/proof failures keep the session and leave retry to the user.
        setError(getResumeError(err)?.message ?? message);
      } finally {
        setConnectingHostId(null);
      }
    },
    [connectViaRelay, connect, navigate, setCurrentHostId, t],
  );

  // Delete a host
  const handleDeleteHost = useCallback(
    async (hostId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm(t("hostPickerRemoveConfirm"))) {
        await removeHost(hostId);
        setHosts((prev) => prev.filter((h) => h.id !== hostId));
      }
    },
    [t],
  );

  // Format last connected time
  const formatLastConnected = (isoString?: string): string => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return t("hostPickerLastConnectedJustNow");
      if (diffMins < 60)
        return t("hostPickerLastConnectedMinutes", { count: diffMins });
      if (diffHours < 24)
        return t("hostPickerLastConnectedHours", { count: diffHours });
      if (diffDays < 7)
        return t("hostPickerLastConnectedDays", { count: diffDays });
      return date.toLocaleDateString();
    } catch {
      return "";
    }
  };

  // If auto-resume is in progress, show a loading screen
  if (isAutoResuming) {
    return <AuthReconnecting />;
  }

  return (
    <AuthShell
      title={t("hostPickerTitle")}
      subtitle={
        hosts.length === 0
          ? t("hostPickerHowToConnect")
          : t("hostPickerChooseSubtitle")
      }
      footer={
        hosts.length > 0 ? t("hostPickerSavedHint") : t("hostPickerEmptyHint")
      }
    >
      {hosts.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t("hostPickerSavedHosts")}</h2>
            <span className={styles.sectionCount}>
              {t("hostPickerSavedCount", { count: hosts.length })}
            </span>
          </div>
          <ul className={styles.list} data-testid="saved-hosts-list">
            {hosts.map((host) => (
              <HostRow
                key={host.id}
                host={host}
                status={hostStatuses[host.id] ?? "unknown"}
                current={host.id === currentHostId}
                connecting={connectingHostId === host.id}
                lastConnected={formatLastConnected(host.lastConnected)}
                onConnect={() => handleConnectHost(host)}
                onRemove={(e) => handleDeleteHost(host.id, e)}
              />
            ))}
          </ul>
          {error && (
            <AuthError data-testid="host-picker-error">{error}</AuthError>
          )}
        </section>
      )}

      <section className={styles.section}>
        {hosts.length > 0 && (
          <h2 className={styles.sectionTitle}>
            {t("hostPickerConnectNewHost")}
          </h2>
        )}
        <div className={styles.options}>
          <ModeOption
            title={t("hostPickerRelayTitle")}
            description={t("hostPickerRelayDescription")}
            onClick={() => navigate("/login/relay")}
            testId="relay-mode-button"
          />
          <ModeOption
            title={t("hostPickerDirectTitle")}
            description={t("hostPickerDirectDescription")}
            onClick={() => navigate("/login/direct")}
            testId="direct-mode-button"
          />
        </div>
      </section>
    </AuthShell>
  );
}
