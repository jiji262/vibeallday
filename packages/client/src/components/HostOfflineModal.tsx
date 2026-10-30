/**
 * HostOfflineModal - Shows when auto-resume fails because host is unreachable.
 *
 * Displays a user-friendly error when the remote host cannot be reached during
 * session resumption (design auth/Connection): the reason, what the client
 * knows about the host, and retry, switch host or go to the login page.
 */

import {
  canRetryResume,
  requiresResumeLogin,
} from "../lib/connection/remoteErrors";
import type {
  AutoResumeError,
  AutoResumeErrorReason,
} from "../contexts/RemoteConnectionContext";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { AuthShell } from "./auth/AuthShell";
import { Button } from "./garden/Button";
import styles from "./HostOfflineModal.module.css";
import { Modal } from "./ui/Modal";

type Translate = ReturnType<typeof useI18n>["t"];

interface HostOfflineModalProps {
  error: AutoResumeError;
  onDismiss: () => void;
  onRetry: () => void;
  onGoToLogin: () => void;
  /** No page is mounted behind the modal: draw the paper shell there. */
  standalone?: boolean;
}

function getErrorTitle(reason: AutoResumeErrorReason, t: Translate): string {
  switch (reason) {
    case "auth_failed":
      return t("hostOfflineTitleResumeRejected");
    case "resume_timeout":
      return t("hostOfflineTitleResumeTimeout");
    case "resume_verification":
      return t("hostOfflineTitleResumeVerification");
    case "server_offline":
      return t("hostOfflineTitleServerOffline");
    case "unknown_username":
      return t("hostOfflineTitleUnknownUsername");
    case "relay_timeout":
      return t("hostOfflineTitleRelayTimeout");
    case "relay_unreachable":
      return t("hostOfflineTitleRelayUnreachable");
    case "direct_unreachable":
      return t("hostOfflineTitleDirectUnreachable");
    case "resume_incompatible":
      return t("hostOfflineTitleResumeIncompatible");
    default:
      return t("hostOfflineTitleDefault");
  }
}

function getErrorMessage(error: AutoResumeError, t: Translate): string {
  const { reason, mode, relayUsername } = error;

  switch (reason) {
    case "auth_failed":
      return t("hostOfflineMessageResumeRejected");
    case "resume_timeout":
      return t("hostOfflineMessageResumeTimeout");
    case "resume_verification":
      return t("hostOfflineMessageResumeVerification");
    case "server_offline":
      return relayUsername
        ? t("hostOfflineMessageServerOfflineNamed", { relayUsername })
        : t("hostOfflineMessageServerOffline");

    case "unknown_username":
      return relayUsername
        ? t("hostOfflineMessageUnknownUsernameNamed", { relayUsername })
        : t("hostOfflineMessageUnknownUsername");

    case "relay_timeout":
      return relayUsername
        ? t("hostOfflineMessageRelayTimeoutNamed", { relayUsername })
        : t("hostOfflineMessageRelayTimeout");

    case "relay_unreachable":
      return t("hostOfflineMessageRelayUnreachable");

    case "direct_unreachable":
      return mode === "direct"
        ? t("hostOfflineMessageDirectUnreachableDirect")
        : t("hostOfflineMessageDirectUnreachable");

    case "resume_incompatible":
      return t("hostOfflineMessageResumeIncompatible");

    default:
      return t("hostOfflineMessageDefault");
  }
}

function getHint(error: AutoResumeError, t: Translate): string {
  switch (error.reason) {
    case "auth_failed":
      return t("hostOfflineHintResumeRejected");
    case "resume_incompatible":
      return t("hostOfflineHintResumeIncompatible");
    case "resume_verification":
      return t("hostOfflineHintResumeVerification");
    default:
      return error.mode === "relay"
        ? t("hostOfflineHintRelay")
        : t("hostOfflineHintDirect");
  }
}

/** Host facts the client already holds: server name and relay URL. */
function HostFacts({ error, t }: { error: AutoResumeError; t: Translate }) {
  if (!error.relayUsername && !error.serverUrl) return null;
  return (
    <dl className={styles.facts}>
      {error.relayUsername ? (
        <>
          <dt>{t("relayLoginServerName")}</dt>
          <dd>{error.relayUsername}</dd>
        </>
      ) : null}
      {error.serverUrl ? (
        <>
          <dt>{t("relayLoginCustomRelayUrl")}</dt>
          <dd>{error.serverUrl}</dd>
        </>
      ) : null}
    </dl>
  );
}

export function HostOfflineModal({
  error,
  onDismiss,
  onRetry,
  onGoToLogin,
  standalone = false,
}: HostOfflineModalProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const title = getErrorTitle(error.reason, t);
  const message = getErrorMessage(error, t);
  const canRetry = canRetryResume(error.reason);
  const showDetail =
    requiresResumeLogin(error.reason) || error.reason === "resume_verification";

  return (
    <>
      {standalone ? (
        <AuthShell top title={error.relayUsername || t("hostPickerTitle")} />
      ) : null}
      <Modal title={title} onClose={onDismiss} variant="dialog">
        <div className={styles.content}>
          <p className={styles.message}>{message}</p>
          {showDetail && <p className={styles.detail}>{error.message}</p>}
          <HostFacts error={error} t={t} />
          <p className={styles.hint}>{getHint(error, t)}</p>

          <div className={styles.actions}>
            <Button
              variant={canRetry ? "ghost" : "primary"}
              onClick={onGoToLogin}
            >
              {t("hostOfflineGoToLogin")}
            </Button>
            <Button
              variant="secondary"
              className={styles.switchHost}
              onClick={() => navigate("/login")}
            >
              {t("hostOfflineSwitchHost")}
            </Button>
            {canRetry && (
              <Button variant="primary" onClick={onRetry}>
                {t("hostOfflineRetry")}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
