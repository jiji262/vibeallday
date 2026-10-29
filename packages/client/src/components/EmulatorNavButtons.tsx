import type { DeviceType } from "@vibeallday/shared";
import { useI18n } from "../i18n";
import styles from "./EmulatorNavButtons.module.css";

interface EmulatorNavButtonsProps {
  /** WebRTC DataChannel for sending key events */
  dataChannel: RTCDataChannel | null;
  /** Device type for platform-specific controls */
  deviceType?: DeviceType;
}

/**
 * Device navigation buttons sent via WebRTC DataChannel.
 */
export function EmulatorNavButtons({
  dataChannel,
  deviceType,
}: EmulatorNavButtonsProps) {
  const { t } = useI18n();
  const showAndroidNav = deviceType === "emulator" || deviceType === "android";
  const showIOSHome = deviceType === "ios-simulator";

  if (!showAndroidNav && !showIOSHome) {
    return null;
  }

  const sendKey = (key: string) => {
    if (dataChannel?.readyState !== "open") return;
    dataChannel.send(JSON.stringify({ type: "key", key }));
  };

  const disabled = dataChannel?.readyState !== "open";

  return (
    <div
      className={styles.root}
      role="group"
      aria-label={t("emulatorDeviceNavigation")}
    >
      {showAndroidNav && (
        <button
          type="button"
          className={styles.button}
          onClick={() => sendKey("GoBack")}
          disabled={disabled}
          title={t("emulatorNavBack")}
          aria-label={t("emulatorNavBack")}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
      <button
        type="button"
        className={styles.button}
        onClick={() => sendKey("GoHome")}
        disabled={disabled}
        title={t("emulatorNavHome")}
        aria-label={t("emulatorNavHome")}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
        </svg>
      </button>
      {showAndroidNav && (
        <button
          type="button"
          className={styles.button}
          onClick={() => sendKey("AppSwitch")}
          disabled={disabled}
          title={t("emulatorNavRecents")}
          aria-label={t("emulatorNavRecents")}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </button>
      )}
    </div>
  );
}
