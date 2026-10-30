import type { DeviceInfo } from "@vibeallday/shared";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { EmulatorNavButtons } from "../components/EmulatorNavButtons";
import { EmulatorStream } from "../components/EmulatorStream";
import { Button } from "../components/garden/Button";
import { ChevronLeftIcon } from "../components/garden/icons";
import { LoadingState } from "../components/garden/LoadingState";
import { Notice } from "../components/garden/Notice";
import {
  type EmulatorFps,
  useEmulatorSettings,
} from "../hooks/useEmulatorSettings";
import { useEmulatorStream } from "../hooks/useEmulatorStream";
import { useI18n } from "../i18n";
import styles from "./EmulatorPage.module.css";
import { deviceLabel } from "./EmulatorDeviceList";
import { StreamMeta } from "./EmulatorStreamMeta";

type NavigatorKeyboard = {
  lock?: (keyCodes?: string[]) => Promise<void>;
  unlock?: () => void;
};

function getNavigatorKeyboard(): NavigatorKeyboard | undefined {
  return (navigator as Navigator & { keyboard?: NavigatorKeyboard }).keyboard;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Tracks fullscreen state for the view and releases the keyboard lock. */
function useFullscreenSync(
  viewRef: RefObject<HTMLDivElement | null>,
  setActive: (active: boolean) => void,
) {
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isActive = document.fullscreenElement === viewRef.current;
      setActive(isActive);
      if (!isActive) getNavigatorKeyboard()?.unlock?.();
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      getNavigatorKeyboard()?.unlock?.();
    };
  }, [viewRef, setActive]);
}

/** Fullscreen plus keyboard lock, so system shortcuts reach the device. */
function useImmersiveKeyboard(
  viewRef: RefObject<HTMLDivElement | null>,
  supported: boolean,
) {
  const { t } = useI18n();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFullscreenSync(viewRef, setActive);

  const exit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      getNavigatorKeyboard()?.unlock?.();
      if (document.fullscreenElement === viewRef.current) {
        await document.exitFullscreen();
      }
      setActive(false);
    } catch (err) {
      setError(
        t("emulatorImmersiveExitFailed", { message: errorMessage(err) }),
      );
    } finally {
      setBusy(false);
    }
  }, [viewRef, t]);

  const enter = useCallback(async () => {
    const view = viewRef.current;
    if (!supported || !view) return;
    setBusy(true);
    setError(null);
    try {
      if (document.fullscreenElement !== view) await view.requestFullscreen();
      await getNavigatorKeyboard()?.lock?.();
      setActive(true);
    } catch (err) {
      getNavigatorKeyboard()?.unlock?.();
      setActive(false);
      setError(t("emulatorImmersiveFailed", { message: errorMessage(err) }));
    } finally {
      setBusy(false);
    }
  }, [supported, viewRef, t]);

  return { active, busy, error, enter, exit };
}

function supportsImmersiveKeyboard(device: DeviceInfo): boolean {
  return (
    (device.type === "emulator" || device.type === "android") &&
    document.fullscreenEnabled &&
    typeof getNavigatorKeyboard()?.lock === "function"
  );
}

type StreamState = ReturnType<typeof useEmulatorStream>;
type ImmersiveKeyboard = ReturnType<typeof useImmersiveKeyboard>;

function ImmersiveKeyboardButton({
  keyboard,
}: {
  keyboard: ImmersiveKeyboard;
}) {
  const { t } = useI18n();
  return (
    <Button
      size="sm"
      onClick={() =>
        void (keyboard.active ? keyboard.exit() : keyboard.enter())
      }
      disabled={keyboard.busy}
      title={t("emulatorImmersiveKeyboardTitle")}
    >
      {keyboard.busy
        ? t("emulatorWorking")
        : t(
            keyboard.active
              ? "emulatorImmersiveKeyboardExit"
              : "emulatorImmersiveKeyboard",
          )}
    </Button>
  );
}

function StreamHeader({
  device,
  connectionState,
  fps,
  keyboard,
  onBack,
}: {
  device: DeviceInfo;
  connectionState: StreamState["connectionState"];
  /** Frame rate of the latest adaptive profile, when one has arrived. */
  fps?: number;
  keyboard?: ImmersiveKeyboard;
  onBack: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.streamHeader}>
      <Button
        size="sm"
        variant="ghost"
        icon={<ChevronLeftIcon size={16} />}
        onClick={onBack}
      >
        {t("actionBack")}
      </Button>
      <span
        className={styles.connectionState}
        data-testid="device-connection-state"
      >
        {deviceLabel(device)} · {connectionState}
      </span>
      <div className={styles.streamHeaderActions}>
        {fps !== undefined && (
          <span className={styles.fps}>{t("emulatorStreamFps", { fps })}</span>
        )}
        {keyboard && <ImmersiveKeyboardButton keyboard={keyboard} />}
      </div>
    </div>
  );
}

function StreamPane({
  device,
  stream,
  keyboardError,
  adaptiveFps,
  maxFps,
}: {
  device: DeviceInfo;
  stream: StreamState;
  keyboardError: string | null;
  adaptiveFps: boolean;
  maxFps: EmulatorFps;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.streamPane}>
      {keyboardError && (
        <Notice tone="danger" className={styles.streamNotice}>
          {keyboardError}
        </Notice>
      )}
      {stream.error && (
        <Notice tone="danger" className={styles.streamNotice}>
          {stream.error}
        </Notice>
      )}
      {stream.connectionState === "connecting" && (
        <LoadingState variant="compact" label={t("emulatorConnecting")} />
      )}
      <div className={styles.streamContainer}>
        <div className={styles.deviceFrame}>
          <EmulatorStream
            stream={stream.remoteStream}
            dataChannel={stream.dataChannel}
            deviceType={device.type}
            peerConnection={stream.peerConnection}
            adaptiveFps={adaptiveFps}
            configuredFps={maxFps}
          />
        </div>
      </div>
      <EmulatorNavButtons
        dataChannel={stream.dataChannel}
        deviceType={device.type}
      />
    </div>
  );
}

/** Auto-connect when entering stream view. */
function useAutoConnect(stream: StreamState, device: DeviceInfo) {
  const { connect, disconnect } = stream;
  useEffect(() => {
    connect({ id: device.id, type: device.type });
    return () => disconnect();
  }, [device.id, device.type, connect, disconnect]);
}

/** Live device: stream pane with nav buttons beside a MetaGrid card. */
export function StreamView({
  device,
  onBack,
}: {
  device: DeviceInfo;
  onBack: () => void;
}) {
  const stream = useEmulatorStream();
  const { disconnect } = stream;
  const { adaptiveFps, maxFps } = useEmulatorSettings();
  const viewRef = useRef<HTMLDivElement>(null);
  const supportsImmersive = supportsImmersiveKeyboard(device);
  const keyboard = useImmersiveKeyboard(viewRef, supportsImmersive);

  useAutoConnect(stream, device);

  const handleBack = () => {
    void keyboard.exit();
    disconnect();
    onBack();
  };

  return (
    <div className={styles.streamView} ref={viewRef}>
      <StreamHeader
        device={device}
        connectionState={stream.connectionState}
        fps={stream.latestProfileEvent?.fps}
        keyboard={supportsImmersive ? keyboard : undefined}
        onBack={handleBack}
      />
      <div className={styles.streamBody}>
        <StreamPane
          device={device}
          stream={stream}
          keyboardError={keyboard.error}
          adaptiveFps={adaptiveFps}
          maxFps={maxFps}
        />
        <StreamMeta
          device={device}
          stream={stream}
          keyboard={supportsImmersive ? keyboard : undefined}
        />
      </div>
    </div>
  );
}
