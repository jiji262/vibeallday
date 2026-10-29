import type { DeviceInfo } from "@vibeallday/shared";
import { useMemo } from "react";
import { Badge } from "../components/garden/Badge";
import { Button } from "../components/garden/Button";
import { Card } from "../components/garden/Card";
import { type MessageKey, useI18n } from "../i18n";
import styles from "./EmulatorPage.module.css";

export const DEVICE_TYPE_ORDER: DeviceInfo["type"][] = [
  "emulator",
  "android",
  "chromeos",
  "ios-simulator",
];

const DEVICE_TYPE_LABELS: Record<DeviceInfo["type"], MessageKey> = {
  emulator: "emulatorGroupEmulators",
  android: "emulatorGroupAndroid",
  chromeos: "emulatorGroupChromeOs",
  "ios-simulator": "emulatorGroupIosSimulators",
};

export function deviceLabel(device: DeviceInfo): string {
  return device.label || device.avd || device.id;
}

export function hasAction(
  device: DeviceInfo,
  action: "stream" | "start" | "stop",
) {
  if (device.actions?.length) return device.actions.includes(action);
  const stopped = device.state === "stopped";
  if (action === "stream") return !stopped;
  if (action === "start") return device.type === "emulator" && stopped;
  return device.type === "emulator" && !stopped;
}

export function firstStreamableDevice(
  devices: DeviceInfo[],
): DeviceInfo | undefined {
  for (const type of DEVICE_TYPE_ORDER) {
    const device = devices.find(
      (candidate) => candidate.type === type && hasAction(candidate, "stream"),
    );
    if (device) return device;
  }
  return devices.find((device) => hasAction(device, "stream"));
}

const DEVICE_STATES: Record<
  DeviceInfo["state"],
  { label: MessageKey; live: boolean }
> = {
  running: { label: "emulatorDeviceRunning", live: true },
  connected: { label: "emulatorDeviceConnected", live: true },
  booted: { label: "emulatorDeviceBooted", live: true },
  stopped: { label: "emulatorDeviceStopped", live: false },
  disconnected: { label: "emulatorDeviceDisconnected", live: false },
};

/** Live devices read mint, stopped or disconnected ones grey. */
export function DeviceStateBadge({ state }: { state: DeviceInfo["state"] }) {
  const { t } = useI18n();
  const known = DEVICE_STATES[state];
  if (!known) return <Badge tone="sand">{state}</Badge>;
  return (
    <Badge tone={known.live ? "mint" : "grey"} dot>
      {t(known.label)}
    </Badge>
  );
}

interface DeviceHandlers {
  onConnect: (device: DeviceInfo) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
}

function DeviceActions({
  device,
  onConnect,
  onStart,
  onStop,
}: DeviceHandlers & { device: DeviceInfo }) {
  const { t } = useI18n();
  const canConnect = hasAction(device, "stream");
  const canStart = hasAction(device, "start");
  const canStop = hasAction(device, "stop");
  if (!canConnect && !canStop && !canStart) {
    return <span className={styles.noActions}>{t("emulatorNoActions")}</span>;
  }
  return (
    <>
      {canConnect && (
        <Button variant="primary" size="sm" onClick={() => onConnect(device)}>
          {t("emulatorConnect")}
        </Button>
      )}
      {canStop && (
        <Button size="sm" onClick={() => onStop(device.id)}>
          {t("emulatorStop")}
        </Button>
      )}
      {!canStop && canStart && (
        <Button size="sm" onClick={() => onStart(device.id)}>
          {t("emulatorStart")}
        </Button>
      )}
    </>
  );
}

function DeviceRow(props: DeviceHandlers & { device: DeviceInfo }) {
  const { device } = props;
  const label = deviceLabel(device);
  return (
    <li className={styles.item} data-testid="device-row">
      <div className={styles.itemInfo}>
        <span className={styles.itemName}>{label}</span>
        {label !== device.id && (
          <span className={styles.itemId}>{device.id}</span>
        )}
      </div>
      <DeviceStateBadge state={device.state} />
      <div className={styles.itemActions}>
        <DeviceActions {...props} />
      </div>
    </li>
  );
}

function groupDevices(devices: DeviceInfo[]) {
  const groups = new Map<DeviceInfo["type"], DeviceInfo[]>();
  for (const type of DEVICE_TYPE_ORDER) groups.set(type, []);
  for (const device of devices) {
    const bucket = groups.get(device.type);
    if (bucket) bucket.push(device);
    else groups.set(device.type, [device]);
  }
  return groups;
}

/** One card per device class; each row carries its state and actions. */
export function DeviceList({
  devices,
  ...handlers
}: DeviceHandlers & { devices: DeviceInfo[] }) {
  const { t } = useI18n();
  const grouped = useMemo(() => groupDevices(devices), [devices]);
  return (
    <div className={styles.list}>
      {Array.from(grouped.entries()).map(([type, entries]) => {
        if (entries.length === 0) return null;
        const labelKey = DEVICE_TYPE_LABELS[type];
        return (
          <Card as="section" flush key={type} data-testid="device-group">
            <div className={styles.groupHeader}>
              <h2
                className={styles.groupTitle}
                data-testid="device-group-title"
              >
                {labelKey ? t(labelKey) : t("emulatorGroupOther")}
              </h2>
              <span className={styles.groupCount}>{entries.length}</span>
            </div>
            <ul className={styles.rows}>
              {entries.map((device) => (
                <DeviceRow key={device.id} device={device} {...handlers} />
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
