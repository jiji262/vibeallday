import { useI18n } from "../../i18n";
import styles from "./ScopeTag.module.css";

/** Where a setting is stored: this browser, or the server for every device. */
export type SettingScope = "local" | "server";

const SCOPE_KEYS = {
  local: { label: "gardenScopeLocal", hint: "gardenScopeLocalHint" },
  server: { label: "gardenScopeServer", hint: "gardenScopeServerHint" },
} as const;

/** Small mono tag after a setting title: 本机 / 服务器 (design .scope). */
export function ScopeTag({
  scope,
  className,
}: {
  scope: SettingScope;
  className?: string;
}) {
  const { t } = useI18n();
  const keys = SCOPE_KEYS[scope];
  return (
    <span
      className={className ? `${styles.scope} ${className}` : styles.scope}
      data-scope={scope}
      title={t(keys.hint)}
    >
      {t(keys.label)}
    </span>
  );
}
