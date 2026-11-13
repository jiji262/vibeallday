import type { BrowserProfileInfo } from "@vibeallday/shared";
import { useBrowserProfiles } from "../../hooks/useBrowserProfiles";
import { EmptyState } from "../../components/garden/EmptyState";
import { LoadingState } from "../../components/garden/LoadingState";
import { ScopeTag } from "../../components/garden/ScopeTag";
import { Status, StatusDot } from "../../components/garden/StatusDot";
import { useConnectedDevices } from "../../hooks/useConnectedDevices";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { useI18n } from "../../i18n";
import styles from "./DevicesSettings.module.css";
import { useSettingsPaneTitle } from "./SettingsPaneTitleContext";
import { HideInSettingsSearch } from "./SettingsSearchContext";
import { SettingsSection } from "./SettingsSection";
import { parseUserAgent } from "../../lib/deviceDetection";

type Translate = ReturnType<typeof useI18n>["t"];

const MS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const PROFILE_ID_PREVIEW_LENGTH = 8;

/**
 * Format a date for display with relative time.
 */
function formatDate(isoDate: string, t: Translate): string {
  const date = new Date(isoDate);
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / MS_PER_MINUTE);
  const diffHours = Math.floor(diffMinutes / MINUTES_PER_HOUR);
  const diffDays = Math.floor(diffHours / HOURS_PER_DAY);

  if (diffMinutes < 1) return t("devicesJustNow");
  if (diffMinutes < MINUTES_PER_HOUR) {
    return t("devicesMinutesAgo", {
      count: diffMinutes,
      suffix: diffMinutes === 1 ? "" : "s",
    });
  }
  if (diffHours < HOURS_PER_DAY) {
    return t("devicesHoursAgo", {
      count: diffHours,
      suffix: diffHours === 1 ? "" : "s",
    });
  }
  if (diffDays === 1) return t("devicesYesterday");
  if (diffDays < DAYS_PER_WEEK) return t("devicesDaysAgo", { count: diffDays });
  return date.toLocaleDateString();
}

function profileName(profile: BrowserProfileInfo): string {
  return (
    profile.deviceName ||
    `${profile.browserProfileId.slice(0, PROFILE_ID_PREVIEW_LENGTH)}...`
  );
}

function OriginList({ profile }: { profile: BrowserProfileInfo }) {
  const { t } = useI18n();
  return (
    <div className={`device-origins ${styles.origins}`}>
      {profile.origins.map((origin) => {
        const { browser, os } = parseUserAgent(origin.userAgent);
        return (
          <div key={origin.origin} className={`device-origin ${styles.origin}`}>
            <code className="device-origin-url">{origin.origin}</code>
            <span className="device-origin-details">
              {browser} · {os}
            </span>
            <span className={`device-origin-time ${styles.originTime}`}>
              {t("devicesLastSeen", { date: formatDate(origin.lastSeen, t) })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface ProfileCardProps {
  profile: BrowserProfileInfo;
  isConnected: boolean;
  /** Present only for this browser: its push subscription state. */
  pushSubscribed?: boolean;
  onForget: (browserProfileId: string) => void;
}

function ProfileCard({
  profile,
  isConnected,
  pushSubscribed,
  onForget,
}: ProfileCardProps) {
  const { t } = useI18n();
  const isCurrent = pushSubscribed !== undefined;
  const connection = isConnected
    ? t("devicesConnected")
    : t("devicesDisconnected");
  return (
    <div
      className={`device-list-item device-profile-item ${styles.profile}`}
      data-current-device={isCurrent || undefined}
    >
      <div className={`device-list-info ${styles.info}`}>
        <div className={styles.head}>
          <StatusDot state={isConnected ? "ok" : "idle"} label={connection} />
          <strong className={styles.name}>{profileName(profile)}</strong>
          {isCurrent && (
            <span className={`device-current-badge ${styles.currentTag}`}>
              {t("devicesThisDevice")}
            </span>
          )}
          {isCurrent && (
            <Status state={pushSubscribed ? "ok" : "idle"} plain>
              {t(pushSubscribed ? "devicesPushOn" : "devicesPushOff")}
            </Status>
          )}
        </div>
        <OriginList profile={profile} />
        <p className={`device-profile-meta ${styles.meta}`}>
          {t("devicesFirstSeen", { date: formatDate(profile.createdAt, t) })}
          {" · "}
          {t("devicesOriginCount", { count: profile.origins.length })}
        </p>
      </div>
      <button
        type="button"
        className="settings-button settings-button-danger-subtle"
        onClick={() => onForget(profile.browserProfileId)}
        title={t("devicesForgetThisDevice")}
      >
        {t("devicesForget")}
      </button>
    </div>
  );
}

/**
 * Devices settings page: this browser's profile card first, then every other
 * browser profile with its connection origin history.
 */
export function DevicesSettings() {
  const { t } = useI18n();
  useSettingsPaneTitle(t("devicesProfilesTitle"));
  const { profiles, isLoading, error, deleteProfile } = useBrowserProfiles();
  const { browserProfileId: currentBrowserProfileId, isSubscribed } =
    usePushNotifications();
  const { connections } = useConnectedDevices();
  const current = profiles.find(
    (profile) => profile.browserProfileId === currentBrowserProfileId,
  );
  const others = profiles.filter((profile) => profile !== current);

  return (
    <SettingsSection description={t("devicesProfilesDescription")}>
      <HideInSettingsSearch>
        {error && <p className="form-error">{error}</p>}
        {isLoading ? (
          <div className="settings-group">
            <LoadingState
              label={t("devicesLoadingProfiles")}
              variant="compact"
            />
          </div>
        ) : profiles.length === 0 ? (
          <div className="settings-group">
            <EmptyState compact title={t("devicesEmpty")} />
          </div>
        ) : (
          <>
            <h2 className={styles.sectionTitle}>
              {t("devicesThisBrowserSection")}
            </h2>
            <div className={`settings-group ${styles.currentCard}`}>
              {current ? (
                <ProfileCard
                  profile={current}
                  isConnected={connections.has(current.browserProfileId)}
                  pushSubscribed={isSubscribed}
                  onForget={deleteProfile}
                />
              ) : (
                <p className={styles.empty}>{t("devicesThisBrowserMissing")}</p>
              )}
            </div>
            <h2 className={styles.sectionTitle}>
              {t("devicesOtherSection")}
              <span className={styles.count}>{others.length}</span>
              <ScopeTag scope="server" />
            </h2>
            <div className="settings-group">
              {others.length === 0 ? (
                <p className={styles.empty}>{t("devicesOtherEmpty")}</p>
              ) : (
                <div className={`device-list ${styles.list}`}>
                  {others.map((profile) => (
                    <ProfileCard
                      key={profile.browserProfileId}
                      profile={profile}
                      isConnected={connections.has(profile.browserProfileId)}
                      onForget={deleteProfile}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </HideInSettingsSearch>
    </SettingsSection>
  );
}
