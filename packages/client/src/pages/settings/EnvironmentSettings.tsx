import { useEffect, useMemo, useState } from "react";
import { Count, Notice, ScopeTag, Tag } from "../../components/garden";
import { EmptyState } from "../../components/garden/EmptyState";
import { LoadingState } from "../../components/garden/LoadingState";
import { api, type EnvSettingEntry } from "../../api/client";
import { useI18n } from "../../i18n";
import styles from "./EnvironmentSettings.module.css";
import { SettingsItem } from "./SettingsItem";
import { useSettingsPaneTitle } from "./SettingsPaneTitleContext";
import {
  HideInSettingsSearch,
  useSettingsSearchScope,
} from "./SettingsSearchContext";
import { SettingsSection } from "./SettingsSection";

interface EnvGroup {
  group: string;
  entries: EnvSettingEntry[];
}

/** Preserve server registry order; group by `group` as groups first appear. */
function groupEntries(entries: EnvSettingEntry[]): EnvGroup[] {
  const groups: EnvGroup[] = [];
  const byName = new Map<string, EnvGroup>();
  for (const entry of entries) {
    let group = byName.get(entry.group);
    if (!group) {
      group = { group: entry.group, entries: [] };
      byName.set(entry.group, group);
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}

export function EnvironmentSettings() {
  const { t } = useI18n();
  useSettingsPaneTitle(t("environmentSectionTitle"));
  const [entries, setEntries] = useState<EnvSettingEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const searchScope = useSettingsSearchScope();

  useEffect(() => {
    let cancelled = false;
    api
      .getEnvSettings()
      .then((report) => {
        if (!cancelled) setEntries(report.entries);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleEntries = useMemo(
    () => entries?.filter((entry) => searchScope || showAll || entry.set) ?? [],
    [entries, searchScope, showAll],
  );
  const groups = useMemo(() => groupEntries(visibleEntries), [visibleEntries]);
  const setCount = entries?.filter((entry) => entry.set).length ?? 0;
  const hasSetSecret = entries?.some((entry) => entry.secret && entry.set);

  return (
    <SettingsSection description={t("environmentSectionDescription")}>
      <HideInSettingsSearch>
        {error && (
          <p className="settings-warning">{t("environmentLoadError")}</p>
        )}
        {!error && entries === null && (
          <LoadingState label={t("environmentLoading")} variant="compact" />
        )}

        {!error && entries && (
          <label className={styles.filter}>
            <span>{t("environmentShowLabel")}</span>
            <select
              className="settings-select"
              value={showAll ? "all" : "set"}
              onChange={(event) => setShowAll(event.target.value === "all")}
            >
              <option value="set">
                {t("environmentShowSet", { count: setCount })}
              </option>
              <option value="all">
                {t("environmentShowAll", { count: entries.length })}
              </option>
            </select>
          </label>
        )}

        {!error && entries && !showAll && groups.length === 0 && (
          <EmptyState compact title={t("environmentEmptySet")} />
        )}
      </HideInSettingsSearch>
      {hasSetSecret && (
        <HideInSettingsSearch>
          <Notice tone="neutral" className={styles.secretNote}>
            {t("environmentSecretNote")}
          </Notice>
        </HideInSettingsSearch>
      )}
      {groups.map((group) => (
        <section key={group.group} className={styles.groupSection}>
          <HideInSettingsSearch>
            <h3 className={styles.groupTitle}>
              <span>{group.group}</span>
              <Count>{group.entries.length}</Count>
              <span className={styles.groupMeta}>
                {t("environmentGroupSetCount", {
                  count: group.entries.filter((entry) => entry.set).length,
                })}
              </span>
            </h3>
          </HideInSettingsSearch>
          <div className={`settings-group ${styles.group}`}>
            {group.entries.map((entry) => (
              <EnvVarRow key={entry.name} entry={entry} />
            ))}
          </div>
        </section>
      ))}
    </SettingsSection>
  );
}

function EnvVarRow({ entry }: { entry: EnvSettingEntry }) {
  const { t } = useI18n();
  return (
    <SettingsItem
      label={entry.name}
      description={entry.description}
      keywords={[entry.group, entry.note].filter(
        (value): value is string => !!value,
      )}
      valueText={envValueText(entry, t)}
      layout="custom"
      baseClassName={styles.row}
      className={entry.set ? undefined : styles.unset}
    >
      <div className={styles.head}>
        <code className={styles.name}>{entry.name}</code>
        {entry.secret && <Tag tone="attn">{t("environmentSecretBadge")}</Tag>}
        <span aria-hidden="true">
          <ScopeTag scope="server" />
        </span>
        <EnvVarValue entry={entry} />
      </div>
      <p className={styles.description}>{entry.description}</p>
      {entry.note && <p className={styles.note}>{entry.note}</p>}
    </SettingsItem>
  );
}

type Translate = ReturnType<typeof useI18n>["t"];

/** Search value text; a secret never exposes even its redacted preview. */
function envValueText(entry: EnvSettingEntry, t: Translate): string {
  if (!entry.set) return t("environmentValueNotSet");
  if (entry.value === "") return t("environmentValueEmpty");
  return entry.secret ? t("environmentSecretBadge") : (entry.value ?? "");
}

function EnvVarValue({ entry }: { entry: EnvSettingEntry }) {
  const { t } = useI18n();
  if (!entry.set) {
    return (
      <span className={`${styles.value} ${styles.valueUnset}`}>
        {t("environmentValueNotSet")}
      </span>
    );
  }
  if (entry.value === "") {
    return (
      <span className={`${styles.value} ${styles.valueUnset}`}>
        {t("environmentValueEmpty")}
      </span>
    );
  }
  if (entry.secret) {
    return <SecretEnvValue name={entry.name} preview={entry.value ?? ""} />;
  }
  return <code className={styles.value}>{entry.value}</code>;
}

const SECRET_MASK = "••••••••";

/** Masked secret; the button reveals the server's redacted tail preview. */
function SecretEnvValue({ name, preview }: { name: string; preview: string }) {
  const { t } = useI18n();
  const [revealed, setRevealed] = useState(false);
  return (
    <span className={`${styles.value} ${styles.secretValue}`}>
      <code className={styles.mask}>{revealed ? preview : SECRET_MASK}</code>
      <button
        type="button"
        className={styles.reveal}
        aria-pressed={revealed}
        aria-label={t(
          revealed ? "environmentHideLabel" : "environmentRevealLabel",
          { name },
        )}
        onClick={() => setRevealed((current) => !current)}
      >
        {t(revealed ? "environmentHidePreview" : "environmentRevealPreview")}
      </button>
    </span>
  );
}
