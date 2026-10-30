import { type ReactNode, useState } from "react";
import { useI18n } from "../i18n";
import { ScopeTag } from "./garden/ScopeTag";
import { Status, type StatusState } from "./garden/StatusDot";
import { QRCode } from "./QRCode";
import styles from "./RemoteAccessSetup.module.css";

const QR_SIZE_PX = 148;

/** Legacy status classes from getStatusDisplay, drawn as design states. */
const STATUS_STATE: Record<string, StatusState> = {
  "status-success": "ok",
  "status-warning": "attn",
  "status-error": "err",
  "status-pending": "run",
  "status-disabled": "idle",
};

export interface RemoteAccessHeroProps {
  title?: string;
  description?: string;
  status: { text: string; className: string };
  /** The enable switch, owned by the setup form state. */
  toggle: ReactNode;
  errorDetail?: string;
  /** Manual-entry address (no password); null until enabled and named. */
  connectUrl: string | null;
  copied: boolean;
  onCopy: (url: string) => void;
  /** Auto-login address for the QR; null when the password is not in memory. */
  qrCodeUrl: string | null;
}

/**
 * The relay connection card (design .srm-hero): state, address, and the
 * pairing panel. The QR carries the password, so it stays behind a toggle.
 */
export function RemoteAccessHero(props: RemoteAccessHeroProps) {
  const { t } = useI18n();
  const state = STATUS_STATE[props.status.className] ?? "idle";
  return (
    <section className={`remote-access-header ${styles.hero}`}>
      <div className={styles.heroMain}>
        <div className={styles.heroHead}>
          <h3>{props.title}</h3>
          <Status state={state}>{props.status.text}</Status>
          <ScopeTag scope="server" />
          <span className={styles.heroToggle}>{props.toggle}</span>
        </div>
        {props.description && (
          <p className={styles.heroDescription}>{props.description}</p>
        )}
        {props.errorDetail && (
          <p className={styles.heroError}>{props.errorDetail}</p>
        )}
        {props.connectUrl && (
          <div className={`remote-access-connect ${styles.connect}`}>
            <span className={styles.metaLabel}>
              {t("remoteSetupConnectFrom" as never)}
            </span>
            <code className={`connect-url ${styles.connectUrl}`}>
              {props.connectUrl}
            </code>
            <div className={styles.heroActions}>
              <button
                type="button"
                className="copy-button settings-button settings-button-primary"
                onClick={() =>
                  props.connectUrl && props.onCopy(props.connectUrl)
                }
                title={t("remoteSetupCopyUrl" as never)}
              >
                {props.copied
                  ? t("remoteSetupCopied" as never)
                  : t("remoteSetupCopy" as never)}
              </button>
            </div>
          </div>
        )}
      </div>
      {props.connectUrl && <PairingPanel qrCodeUrl={props.qrCodeUrl} />}
    </section>
  );
}

function PairingPanel({ qrCodeUrl }: { qrCodeUrl: string | null }) {
  const { t } = useI18n();
  const [showQRCode, setShowQRCode] = useState(false);
  return (
    <aside className={`remote-access-qr ${styles.pairing}`}>
      <h4>{t("remoteSetupPairingTitle")}</h4>
      {qrCodeUrl ? (
        <>
          {showQRCode && (
            <div className={`qr-code-container ${styles.qr}`}>
              <QRCode value={qrCodeUrl} size={QR_SIZE_PX} />
            </div>
          )}
          <p className={styles.pairingHint}>
            {t("remoteSetupQrHint" as never)}
          </p>
          <button
            type="button"
            className="qr-toggle-button settings-button"
            onClick={() => setShowQRCode(!showQRCode)}
          >
            {showQRCode
              ? t("remoteSetupHideQr" as never)
              : t("remoteSetupShowQr" as never)}
          </button>
        </>
      ) : (
        <p className={styles.pairingHint}>{t("remoteSetupPairingFallback")}</p>
      )}
    </aside>
  );
}
