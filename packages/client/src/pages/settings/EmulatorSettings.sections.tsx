import type { DeviceInfo, DeviceState } from "@vibeallday/shared";
import { EmptyState } from "../../components/garden/EmptyState";
import { ErrorState } from "../../components/garden/ErrorState";
import { LoadingState } from "../../components/garden/LoadingState";
import { Status, type StatusState } from "../../components/garden/StatusDot";
import {
  EMULATOR_FPS_OPTIONS,
  EMULATOR_WIDTH_OPTIONS,
  type EmulatorFps,
  type EmulatorQuality,
  type EmulatorWidth,
  getQualityLabel,
} from "../../hooks/useEmulatorSettings";
import { useI18n } from "../../i18n";
import styles from "./EmulatorSettings.module.css";
import { HideInSettingsSearch } from "./SettingsSearchContext";
import { SettingsItem } from "./SettingsItem";
import { SettingsSection } from "./SettingsSection";

const QUALITY_OPTIONS: EmulatorQuality[] = ["high", "medium", "low"];

const DEVICE_STATUS: Record<DeviceState, StatusState> = {
  running: "ok",
  booted: "ok",
  connected: "ok",
  stopped: "idle",
  disconnected: "idle",
};

function canStartDevice(device: DeviceInfo): boolean {
  if (device.actions?.length) return device.actions.includes("start");
  return device.type === "emulator" && device.state === "stopped";
}

function canStopDevice(device: DeviceInfo): boolean {
  if (device.actions?.length) return device.actions.includes("stop");
  return device.type === "emulator" && device.state !== "stopped";
}

interface DeviceCardProps {
  device: DeviceInfo;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
}

function DeviceCard({ device, onStart, onStop }: DeviceCardProps) {
  const { t } = useI18n();
  const action = canStopDevice(device)
    ? { label: t("emulatorStop"), run: onStop }
    : canStartDevice(device)
      ? { label: t("emulatorStart"), run: onStart }
      : null;
  return (
    <article className={styles.deviceCard} data-device-id={device.id}>
      <div className={styles.deviceHead}>
        <strong className={styles.deviceName}>
          {device.label || device.avd || device.id}
        </strong>
        <Status state={DEVICE_STATUS[device.state] ?? "idle"}>
          {device.state}
        </Status>
      </div>
      <span className={styles.deviceMeta}>
        {t("emulatorDeviceSummary", {
          type: device.type,
          id: device.id,
          state: device.state,
        })}
      </span>
      {action ? (
        <button
          type="button"
          className={`settings-button ${styles.deviceAction}`}
          onClick={() => action.run(device.id)}
        >
          {action.label}
        </button>
      ) : null}
    </article>
  );
}

/** Discovered devices as cards, first so the live state is visible. */
export function EmulatorDeviceCards({
  devices,
  loading,
  error,
  onStart,
  onStop,
}: {
  devices: readonly DeviceInfo[];
  loading: boolean;
  error: string | null;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <HideInSettingsSearch>
      <section className="settings-section">
        <h2>{t("emulatorDiscoveredDevicesTitle")}</h2>
        {loading && (
          <LoadingState label={t("emulatorLoadingDevices")} variant="compact" />
        )}
        {error && <ErrorState inline message={error} />}
        {!loading && devices.length === 0 ? (
          <div className="settings-group">
            <EmptyState compact title={t("emulatorNoDevicesFound")} />
          </div>
        ) : (
          <div className={styles.deviceGrid}>
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onStart={onStart}
                onStop={onStop}
              />
            ))}
          </div>
        )}
      </section>
    </HideInSettingsSearch>
  );
}

interface SegmentedChoiceProps<T extends string | number> {
  options: readonly T[];
  value: T;
  label: string;
  format: (option: T) => string;
  onChange: (option: T) => void;
}

function SegmentedChoice<T extends string | number>({
  options,
  value,
  label,
  format,
  onChange,
}: SegmentedChoiceProps<T>) {
  return (
    <div className="font-size-selector" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={`font-size-option ${value === option ? "active" : ""}`}
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {format(option)}
        </button>
      ))}
    </div>
  );
}

export interface EmulatorStreamQualityProps {
  maxFps: EmulatorFps;
  setMaxFps: (fps: EmulatorFps) => void;
  maxWidth: EmulatorWidth;
  setMaxWidth: (width: EmulatorWidth) => void;
  quality: EmulatorQuality;
  setQuality: (quality: EmulatorQuality) => void;
  adaptiveFps: boolean;
  setAdaptiveFps: (enabled: boolean) => void;
}

/** Stream quality: stored in this browser, applied on the next connection. */
export function EmulatorStreamQuality(props: EmulatorStreamQualityProps) {
  const { t } = useI18n();
  const formatFps = (fps: EmulatorFps) => `${fps} fps`;
  const formatWidth = (width: EmulatorWidth) => `${width}p`;
  return (
    <SettingsSection
      title={t("emulatorStreamQualityTitle")}
      description={t("emulatorStreamQualityDescription")}
      scope="local"
    >
      <div className="settings-group">
        <SettingsItem
          label={t("emulatorFrameRateTitle")}
          description={t("emulatorFrameRateDescription")}
          valueText={formatFps(props.maxFps)}
        >
          <SegmentedChoice
            options={EMULATOR_FPS_OPTIONS}
            value={props.maxFps}
            label={t("emulatorFrameRateTitle")}
            format={formatFps}
            onChange={props.setMaxFps}
          />
        </SettingsItem>
        <SettingsItem
          label={t("emulatorResolutionTitle")}
          description={t("emulatorResolutionDescription")}
          valueText={formatWidth(props.maxWidth)}
        >
          <SegmentedChoice
            options={EMULATOR_WIDTH_OPTIONS}
            value={props.maxWidth}
            label={t("emulatorResolutionTitle")}
            format={formatWidth}
            onChange={props.setMaxWidth}
          />
        </SettingsItem>
        <SettingsItem
          label={t("emulatorQualityTitle")}
          description={t("emulatorQualityDescription")}
          valueText={getQualityLabel(props.quality)}
        >
          <SegmentedChoice
            options={QUALITY_OPTIONS}
            value={props.quality}
            label={t("emulatorQualityTitle")}
            format={getQualityLabel}
            onChange={props.setQuality}
          />
        </SettingsItem>
        <SettingsItem
          label={t("emulatorAdaptiveFpsTitle")}
          description={t("emulatorAdaptiveFpsDescription")}
          valueText={t(props.adaptiveFps ? "commonOn" : "commonOff")}
        >
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={props.adaptiveFps}
              onChange={(e) => props.setAdaptiveFps(e.target.checked)}
              aria-label={t("emulatorAdaptiveFpsTitle")}
            />
            <span className="toggle-slider" />
          </label>
        </SettingsItem>
      </div>
    </SettingsSection>
  );
}
