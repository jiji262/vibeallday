import { useId } from "react";
import { Link } from "react-router-dom";
import { ScopeTag } from "../../components/garden/ScopeTag";
import {
  Segmented,
  type SegmentedOption,
} from "../../components/garden/Segmented";
import { Switch } from "../../components/garden/Switch";
import { UI_FONT_SCALE_PRESETS } from "../../hooks/useFontSize";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { useRemoteBasePath } from "../../hooks/useRemoteBasePath";
import type { Theme } from "../../hooks/useTheme";
import { type MessageKey, useI18n } from "../../i18n";
import styles from "./SettingsQuickControls.module.css";

const SKIN_OPTIONS: readonly { value: Theme; label: MessageKey }[] = [
  { value: "light", label: "settingsAppearanceThemeCeladon" },
  { value: "dark", label: "settingsAppearanceThemeNight" },
  { value: "verydark", label: "moreThemeOledShort" },
  { value: "auto", label: "settingsAppearanceThemeSystem" },
];

const TEXT_SIZE_PRESETS: readonly number[] = UI_FONT_SCALE_PRESETS;

function textSizeOption(value: number): SegmentedOption<string> {
  return { value: String(value), label: String(value) };
}

const TEXT_SIZE_OPTIONS = TEXT_SIZE_PRESETS.map(textSizeOption);

/**
 * The presets, plus the saved size in order when it is not one (set from
 * Appearance), so exactly one option is always selected.
 */
function textSizeOptions(current: number): readonly SegmentedOption<string>[] {
  if (TEXT_SIZE_PRESETS.includes(current)) return TEXT_SIZE_OPTIONS;
  return [...TEXT_SIZE_PRESETS, current]
    .sort((a, b) => a - b)
    .map(textSizeOption);
}

export interface SettingsQuickControlsProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  fontSizePercent: number;
  onFontSizeChange: (percent: number) => void;
  /** Desktop overview: "desktop notifications" and a link to Appearance. */
  desktop?: boolean;
}

/** This browser's notification subscription as one switch; absent where unsupported. */
function NotificationsRow({ desktop }: { desktop: boolean }) {
  const { t } = useI18n();
  const id = useId();
  const push = usePushNotifications();
  if (!push.isSupported) return null;
  const title = t(
    desktop
      ? "settingsQuickDesktopNotifications"
      : "settingsQuickPushNotifications",
  );
  const toggle = () =>
    void (push.isSubscribed ? push.unsubscribe() : push.subscribe());
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <label className={styles.title} htmlFor={id}>
          {title}
          <ScopeTag scope="local" />
        </label>
        <span className={styles.description}>
          {t("settingsQuickNotificationsDescription")}
        </span>
      </div>
      {/* Named by the title alone: the label also holds the scope tag. */}
      <Switch
        id={id}
        label={title}
        checked={push.isSubscribed}
        disabled={push.isLoading || push.permission === "denied"}
        onChange={toggle}
      />
    </div>
  );
}

/** Skin, text size and notifications; the full set lives in Appearance. */
export function SettingsQuickControls({
  theme,
  onThemeChange,
  fontSizePercent,
  onFontSizeChange,
  desktop = false,
}: SettingsQuickControlsProps) {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  const titleId = useId();
  const skinTitle = t("settingsQuickSkin");
  const sizeTitle = t("settingsQuickTextSize");
  const skins = SKIN_OPTIONS.map(({ value, label }) => ({
    value,
    label: t(label),
  }));
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <div className={styles.head}>
        <h2 className={styles.heading} id={titleId}>
          {t("settingsQuickTitle")}
        </h2>
        {desktop ? (
          <Link className={styles.more} to={`${basePath}/settings/appearance`}>
            {t("settingsQuickMoreAppearance")}
          </Link>
        ) : null}
      </div>
      <div className={styles.row}>
        <span className={styles.title}>
          {skinTitle}
          <ScopeTag scope="local" />
        </span>
        <Segmented
          label={skinTitle}
          options={skins}
          value={theme}
          onChange={onThemeChange}
          block={!desktop}
          className={styles.control}
        />
      </div>
      <div className={styles.row}>
        <span className={styles.title}>
          {sizeTitle}
          <ScopeTag scope="local" />
        </span>
        <span className={styles.detail}>{`${fontSizePercent}%`}</span>
        <Segmented
          label={sizeTitle}
          options={textSizeOptions(fontSizePercent)}
          value={String(fontSizePercent)}
          onChange={(value) => onFontSizeChange(Number(value))}
          block={!desktop}
          className={styles.control}
        />
      </div>
      <NotificationsRow desktop={desktop} />
    </section>
  );
}
