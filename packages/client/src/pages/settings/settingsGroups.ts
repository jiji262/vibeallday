import type { MessageKey } from "../../i18n";
import type { SettingsCategory } from "./types";

export type SettingsGroupId =
  | "agents"
  | "look"
  | "notifications"
  | "access"
  | "projects"
  | "data"
  | "advanced";

interface SettingsGroupDefinition {
  id: SettingsGroupId;
  titleKey: MessageKey;
  categoryIds: readonly string[];
}

/**
 * The settings home lists categories under these groups, in this order.
 * Every id from `getSettingsCategories` belongs to exactly one group (pinned
 * by a test); a category a future change forgets to map lands in `advanced`
 * so it stays reachable.
 */
export const SETTINGS_GROUPS: readonly SettingsGroupDefinition[] = [
  {
    id: "agents",
    titleKey: "settingsGroupAgents",
    categoryIds: [
      "providers",
      "model",
      "agent-context",
      "message-delivery",
      "cache-miss-billing",
      "remote-executors",
    ],
  },
  {
    id: "look",
    titleKey: "settingsGroupLook",
    categoryIds: ["appearance", "toolbar", "speech"],
  },
  {
    id: "notifications",
    titleKey: "settingsGroupNotifications",
    categoryIds: ["notifications", "devices", "emulator"],
  },
  {
    id: "access",
    titleKey: "settingsGroupAccess",
    categoryIds: ["local-access", "remote", "users"],
  },
  {
    id: "projects",
    titleKey: "settingsGroupProjects",
    categoryIds: [
      "source-control",
      "issues",
      "project-templates",
      "apps",
      "webhooks",
      "browser-extension",
    ],
  },
  {
    id: "data",
    titleKey: "settingsGroupData",
    categoryIds: ["storage", "about"],
  },
  {
    id: "advanced",
    titleKey: "settingsGroupAdvanced",
    categoryIds: ["performance", "environment", "development"],
  },
];

export interface SettingsGroup {
  id: SettingsGroupId;
  titleKey: MessageKey;
  categories: SettingsCategory[];
}

/** Ids that no group names; they are appended to the last group. */
function unmappedCategories(
  categories: SettingsCategory[],
): SettingsCategory[] {
  const mapped = new Set(SETTINGS_GROUPS.flatMap((g) => g.categoryIds));
  return categories.filter((category) => !mapped.has(category.id));
}

/**
 * Split the categories the caller may show into the home's groups. Group
 * members keep the order the group declares; empty groups are dropped so a
 * limited user or an older server never sees a heading with nothing under it.
 */
export function groupSettingsCategories(
  categories: SettingsCategory[],
): SettingsGroup[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const strays = unmappedCategories(categories);
  const groups = SETTINGS_GROUPS.map((group, index) => {
    const members = group.categoryIds.flatMap((id) => byId.get(id) ?? []);
    const isLast = index === SETTINGS_GROUPS.length - 1;
    return {
      id: group.id,
      titleKey: group.titleKey,
      categories: isLast ? [...members, ...strays] : members,
    };
  });
  return groups.filter((group) => group.categories.length > 0);
}
