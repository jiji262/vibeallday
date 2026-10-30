import { describe, expect, it } from "vitest";
import { getSettingsCategories } from "../../../i18n-settings";
import { groupSettingsCategories, SETTINGS_GROUPS } from "../settingsGroups";
import type { SettingsCategory } from "../types";

/** No setting may become unreachable when the home groups its categories. */
describe("settings home groups", () => {
  const categories = getSettingsCategories((key) => key);
  const mappedIds = SETTINGS_GROUPS.flatMap((group) => group.categoryIds);

  it("maps every category id to exactly one group", () => {
    expect(new Set(mappedIds).size).toBe(mappedIds.length);
    const unmapped = categories
      .map((category) => category.id)
      .filter((id) => !mappedIds.includes(id));
    expect(unmapped).toEqual([]);
  });

  it("names only categories that exist, plus the extension-only one", () => {
    const known = new Set([
      ...categories.map((category) => category.id),
      "browser-extension",
    ]);
    expect(mappedIds.filter((id) => !known.has(id))).toEqual([]);
  });

  it("lists every visible category once, with Advanced & debug last", () => {
    const groups = groupSettingsCategories(categories);
    const listed = groups.flatMap((group) =>
      group.categories.map((category) => category.id),
    );
    expect([...listed].sort()).toEqual(
      categories.map((category) => category.id).sort(),
    );
    expect(groups.at(-1)?.id).toBe("advanced");
  });

  it("places Agent behavior after Agent context and Import/Export in Data", () => {
    const ids = (groupId: string) =>
      SETTINGS_GROUPS.find((group) => group.id === groupId)?.categoryIds ?? [];
    const agents = ids("agents");
    expect(agents.indexOf("agent-behavior")).toBe(
      agents.indexOf("agent-context") + 1,
    );
    expect(ids("data")).toEqual(["storage", "import-export", "about"]);
  });

  it("drops groups a limited user or older server leaves empty", () => {
    const only = categories.filter((category) => category.id === "about");
    expect(groupSettingsCategories(only).map((group) => group.id)).toEqual([
      "data",
    ]);
  });

  it("keeps a category no group names reachable in the last group", () => {
    const stray: SettingsCategory = {
      id: "future-pane",
      label: "Future",
      description: "Not mapped yet",
    };
    const groups = groupSettingsCategories([...categories, stray]);
    expect(groups.at(-1)?.categories.map((category) => category.id)).toContain(
      "future-pane",
    );
  });
});
