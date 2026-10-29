import type { DeviceInfo } from "@vibeallday/shared";
import { Card, CardHeader } from "../components/garden/Card";
import { MetaDivider, MetaField, MetaGrid } from "../components/garden/Meta";
import type {
  EmulatorConnectionState,
  useEmulatorStream,
} from "../hooks/useEmulatorStream";
import { type MessageKey, useI18n } from "../i18n";
import styles from "./EmulatorPage.module.css";
import { DeviceStateBadge, deviceLabel } from "./EmulatorDeviceList";

const BITS_PER_KILOBIT = 1000;
const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};

type StreamState = ReturnType<typeof useEmulatorStream>;

const CONNECTION_LABEL: Record<EmulatorConnectionState, MessageKey> = {
  idle: "emulatorConnectionIdle",
  connecting: "emulatorConnectionConnecting",
  connected: "emulatorConnectionConnected",
  disconnected: "emulatorConnectionDisconnected",
  failed: "emulatorConnectionFailed",
};

function ProfileTimeline({
  events,
}: {
  events: StreamState["profileEventHistory"];
}) {
  const { t } = useI18n();
  if (events.length === 0) return null;
  return (
    <ol className={styles.profileTimeline} data-testid="profile-timeline">
      {events.map((event, index) => (
        <li
          key={`${event.receivedAt}-${event.direction}-${event.tier}-${index}`}
          className={
            index === 0
              ? `${styles.profileTimelineItem} ${styles.latest}`
              : styles.profileTimelineItem
          }
        >
          <time className={styles.profileTimelineTime}>
            {new Date(event.receivedAt).toLocaleTimeString([], TIME_FORMAT)}
          </time>
          <span className={styles.profileTimelineDetail}>
            {t("emulatorProfileTimelineValue", {
              direction: event.direction,
              tier: event.tier,
              total: event.totalTiers,
              width: event.width,
              height: event.height,
              fps: event.fps,
            })}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ProfileField({
  profile,
}: {
  profile: NonNullable<StreamState["latestProfileEvent"]>;
}) {
  const { t } = useI18n();
  return (
    <>
      <MetaDivider />
      <MetaField
        label={t("emulatorMetaProfile")}
        mono
        value={t("emulatorProfileValue", {
          direction: profile.direction,
          tier: profile.tier,
          total: profile.totalTiers,
          width: profile.width,
          height: profile.height,
          fps: profile.fps,
          kbps: Math.round(profile.bitrate / BITS_PER_KILOBIT),
        })}
      />
    </>
  );
}

/** Device facts, keyboard mode and the adaptive profile history. */
export function StreamMeta({
  device,
  stream,
  keyboard,
}: {
  device: DeviceInfo;
  stream: StreamState;
  keyboard?: { active: boolean };
}) {
  const { t } = useI18n();
  const profile = stream.latestProfileEvent;
  return (
    <Card as="section" className={styles.metaCard}>
      <CardHeader
        title={t("emulatorStreamDetails")}
        meta={t(CONNECTION_LABEL[stream.connectionState])}
      />
      <MetaGrid className={styles.metaGrid}>
        <MetaField
          label={t("emulatorMetaDevice")}
          value={deviceLabel(device)}
        />
        <MetaField label={t("emulatorMetaId")} value={device.id} mono />
        <MetaField
          label={t("emulatorMetaState")}
          value={<DeviceStateBadge state={device.state} />}
        />
        {keyboard && (
          <MetaField
            label={t("emulatorMetaKeyboard")}
            value={t(
              keyboard.active
                ? "emulatorKeyboardImmersive"
                : "emulatorKeyboardStandard",
            )}
          />
        )}
        {profile && <ProfileField profile={profile} />}
      </MetaGrid>
      <ProfileTimeline events={stream.profileEventHistory} />
    </Card>
  );
}
