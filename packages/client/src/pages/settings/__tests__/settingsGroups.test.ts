import { describe, expect, it } from "vitest";
import { getSettingsCategories } from "../../../i18n-settings";
import { groupSettingsCategories, SETTINGS_GROUPS } from "../settingsGroups";
import type { SettingsCategory } from "../types";

/** No setting may become unreachable when the home groups its categories. */
describe("settings home groups", () => {
  const categories = getSettingsCategories((key) => key);
  const mappedIds = SETTINGS_GROUPS.flatMap((group) => group.categoryIds);

  it("maps every category id to exactly one group across 5 groups and 12 categories", () => {
    expect(SETTINGS_GROUPS).toHaveLength(5);
    expect(categories).toHaveLength(12);
    expect(new Set(mappedIds).size).toBe(mappedIds.length);
    const unmapped = categories
      .map((category) => category.id)
      .filter((id) => !mappedIds.includes(id));
    expect(unmapped).toEqual([]);
  });

  it("names only categories that exist", () => {
    const known = new Set([...categories.map((category) => category.id)]);
    expect(mappedIds.filter((id) => !known.has(id))).toEqual([]);
  });

  it("lists every visible category once, with About in the final group", () => {
    const groups = groupSettingsCategories(categories);
    const listed = groups.flatMap((group) =>
      group.categories.map((category) => category.id),
    );
    expect([...listed].sort()).toEqual(
      categories.map((category) => category.id).sort(),
    );
    expect(groups.at(-1)?.id).toBe("data");
    expect(groups.at(-1)?.categories.map((c) => c.id)).toEqual(["about"]);
  });

  it("groups consolidated categories cleanly by domain", () => {
    const ids = (groupId: string) =>
      SETTINGS_GROUPS.find((group) => group.id === groupId)?.categoryIds ?? [];
    expect(ids("agents")).toEqual(["providers", "model"]);
    expect(ids("look")).toEqual(["appearance", "speech"]);
    expect(ids("access")).toEqual([
      "local-access",
      "remote",
      "notifications",
      "users",
    ]);
    expect(ids("projects")).toEqual(["source-control", "apps", "storage"]);
    expect(ids("data")).toEqual(["about"]);
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
