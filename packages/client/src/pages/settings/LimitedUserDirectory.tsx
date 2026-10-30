import type { LimitedUserSummary } from "@vibeallday/shared";
import { serverHasCapability } from "@vibeallday/shared";
import { useMemo } from "react";
import { Tag } from "../../components/garden/Badge";
import { Status } from "../../components/garden/StatusDot";
import { useVersion } from "../../hooks/useVersion";
import { useI18n } from "../../i18n";
import { getSettingsCategories } from "../../i18n-settings";
import { limitedUserMaySeeSettingsCategory } from "../../lib/limitedUserSettings";
import type { SettingsCategory } from "./types";
import directoryStyles from "./LimitedUserDirectory.module.css";

/**
 * The settings categories a limited user actually gets on this server: the
 * allowlist, narrowed to the panes this server serves (the same two filters
 * SettingsLayout applies for an acting limited user).
 */
export function useLimitedUserVisibleCategories(): SettingsCategory[] {
  const { t } = useI18n();
  const { version } = useVersion();
  return useMemo(
    () =>
      getSettingsCategories((key) => t(key as never)).filter(
        (category) =>
          limitedUserMaySeeSettingsCategory(category.id) &&
          (!category.requires ||
            category.requires.anyCapability.some((capability) =>
              serverHasCapability(version, capability),
            )),
      ),
    [t, version],
  );
}

export interface LimitedUserListProps {
  users: LimitedUserSummary[];
  /** Username whose editor is open, if any. */
  selected: string | null;
  creating: boolean;
  busy: boolean;
  visibleCategoryCount: number;
  onToggleUser: (username: string) => void;
  onToggleCreate: () => void;
}

/** One account row: initial, name, what it can see, and its state. */
function UserRow({
  user,
  selected,
  meta,
  onToggle,
}: {
  user: LimitedUserSummary;
  selected: boolean;
  meta: string;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const metaId = `limited-user-meta-${user.username}`;
  return (
    <button
      type="button"
      className={`${directoryStyles.userRow} ${user.disabled ? directoryStyles.userChipDisabled : ""}`}
      aria-pressed={selected}
      aria-label={user.username}
      aria-describedby={metaId}
      title={user.disabled ? t("usersDisabledTitle") : undefined}
      onClick={onToggle}
    >
      <span className={directoryStyles.avatar} aria-hidden="true">
        {user.username.slice(0, 1).toUpperCase()}
      </span>
      <span className={directoryStyles.userText}>
        <span className={directoryStyles.userName}>{user.username}</span>
        <span id={metaId} className={directoryStyles.userRowMeta}>
          {meta}
        </span>
      </span>
      {user.disabled ? (
        <Status state="idle">{t("usersStatusDisabled")}</Status>
      ) : (
        <Status state="ok">{t("usersEnabledLabel")}</Status>
      )}
    </button>
  );
}

/** The account list (design .usr-user rows) with Add user at its foot. */
export function LimitedUserList(props: LimitedUserListProps) {
  const { t } = useI18n();
  const meta = `${t("usersRoleLimited")} · ${t("usersVisibleCategoriesCount", {
    count: props.visibleCategoryCount,
  })}`;
  return (
    <div className={`settings-group ${directoryStyles.userList}`}>
      <div
        className={directoryStyles.userBar}
        role="group"
        aria-label={t("usersListLabel")}
      >
        {props.users.map((user) => (
          <UserRow
            key={user.username}
            user={user}
            selected={props.selected === user.username}
            meta={user.disabled ? t("usersDisabledTitle") : meta}
            onToggle={() => props.onToggleUser(user.username)}
          />
        ))}
        <button
          type="button"
          className={`settings-button ${directoryStyles.userChip} ${directoryStyles.addUser}`}
          aria-pressed={props.creating}
          disabled={props.busy}
          onClick={props.onToggleCreate}
        >
          + {t("usersAddUser")}
        </button>
      </div>
    </div>
  );
}

/** Which categories a limited user's Settings shows (design usr-scope card). */
export function LimitedUserVisibleCategories({
  categories,
}: {
  categories: SettingsCategory[];
}) {
  const { t } = useI18n();
  return (
    <section
      className={`settings-group ${directoryStyles.visibleCard}`}
      aria-labelledby="limited-user-visible-title"
    >
      <h3 id="limited-user-visible-title">{t("usersVisibleTitle")}</h3>
      <p>{t("usersVisibleBody", { count: categories.length })}</p>
      <div className={directoryStyles.visibleTags}>
        {categories.map((category) => (
          <Tag key={category.id}>{category.label}</Tag>
        ))}
      </div>
      <p>{t("usersVisibleScopeNote")}</p>
    </section>
  );
}
