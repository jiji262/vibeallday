/**
 * ConnectionBar - A labelled bar at the top of the screen while the source
 * transport needs attention (design auth/Connection).
 *
 * Uses the current source transport as the single source of truth:
 * - attn (pulsing dot): reconnecting, with the client's attempt count
 * - err: disconnected
 * Both states name the host, show when it last answered and offer Retry now.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { useCurrentSourceRuntime } from "../contexts/SourceRuntimeContext";
import { useActivityBusState } from "../hooks/useActivityBusState";
import { useI18n } from "../i18n";
import type { SourceTransportStatusSnapshot } from "../lib/transport";
import styles from "./ConnectionBar.module.css";
import { Button } from "./garden/Button";

/** Routes where we don't show the connection bar */
const LOGIN_ROUTES = ["/login", "/login/direct", "/login/relay"];

/** Highest reconnect attempt any channel reports; 0 when none is retrying. */
function reconnectAttempts(snapshot: SourceTransportStatusSnapshot): number {
  let attempts = 0;
  for (const channel of snapshot.channels) {
    attempts = Math.max(attempts, channel.reconnectAttempts ?? 0);
  }
  return attempts;
}

function useReconnectAttempts(): number {
  const { transport } = useCurrentSourceRuntime();
  const read = () => reconnectAttempts(transport.status.getSnapshot());
  return useSyncExternalStore(
    (listener) => transport.status.subscribe(listener),
    read,
    read,
  );
}

/**
 * When the connection was last known good: null while connected and before
 * this page has ever been connected (there is no last response to show).
 */
function useLostAt(connected: boolean): number | null {
  const [lostAt, setLostAt] = useState<number | null>(null);
  const seenConnected = useRef(connected);
  useEffect(() => {
    if (connected) {
      seenConnected.current = true;
      setLostAt(null);
      return;
    }
    if (seenConnected.current) {
      setLostAt((previous) => previous ?? Date.now());
    }
  }, [connected]);
  return lostAt;
}

function isLoginRoute(pathname: string): boolean {
  return LOGIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

interface ConnectionBarProps {
  /** Display name of the host being reached, when the client knows it. */
  hostName?: string | null;
}

export function ConnectionBar({ hostName }: ConnectionBarProps) {
  const location = useLocation();
  const { connectionState } = useActivityBusState();
  const connected = connectionState === "connected";
  const lostAt = useLostAt(connected);

  // Network loss is ordinary feedback, independent of developer diagnostics.
  if (connected || isLoginRoute(location.pathname)) {
    return null;
  }
  return (
    <ConnectionBarContent
      status={
        connectionState === "reconnecting" ? "connecting" : "disconnected"
      }
      hostName={hostName}
      lostAt={lostAt}
    />
  );
}

function ConnectionBarContent({
  status,
  hostName,
  lostAt,
}: {
  status: "connecting" | "disconnected";
  hostName?: string | null;
  lostAt: number | null;
}) {
  const { t } = useI18n();
  const { transport } = useCurrentSourceRuntime();
  const attempts = useReconnectAttempts();
  const connecting = status === "connecting";
  const title = connecting
    ? hostName
      ? t("connectionBarReconnectingHost", { host: hostName })
      : t("connectionBarReconnecting")
    : hostName
      ? t("connectionBarDisconnectedHost", { host: hostName })
      : t("connectionBarDisconnected");

  return (
    <div
      className={`${styles.root} ${connecting ? styles.connecting : styles.disconnected}`}
      role="status"
      data-connection-status={status}
    >
      <span className={styles.pulse} aria-hidden="true" />
      <span className={styles.title}>
        {title}
        {connecting && attempts > 0
          ? ` ${t("connectionBarAttempt", { count: attempts })}`
          : null}
      </span>
      {lostAt !== null ? (
        <span className={styles.meta}>
          {t("connectionBarLastSeen", {
            time: new Date(lostAt).toLocaleTimeString(),
          })}
        </span>
      ) : null}
      <Button
        size="sm"
        variant="secondary"
        className={styles.retry}
        onClick={() => {
          void transport.reconnect().catch(() => {
            // The transport reports the failure through its status.
          });
        }}
      >
        {t("connectionBarRetryNow")}
      </Button>
    </div>
  );
}
