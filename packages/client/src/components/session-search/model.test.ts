import { expect, it } from "vitest";
import type { GlobalSessionItem } from "../../api/client";
import {
  countActiveFilters,
  countQuickViews,
  matchesActivity,
  parseActivityParam,
  type FilterSnapshot,
  limitTurnMatches,
  type SearchMatch,
  toggleChipStatus,
} from "./model";

it("reserves an independent budget for user matches after several assistant matches", () => {
  const matches: SearchMatch[] = [
    "assistant",
    "assistant",
    "assistant",
    "user",
    "user",
  ].map((role, i) => ({
    id: String(i),
    role: role as "user" | "assistant",
    ordinal: i + 1,
    preview: "needle",
  }));
  expect(limitTurnMatches(matches, 1).map((m) => m.id)).toEqual(["0", "3"]);
  expect(limitTurnMatches(matches, 2).map((m) => m.id)).toEqual([
    "0",
    "1",
    "3",
    "4",
  ]);
  expect(limitTurnMatches(matches, Infinity)).toEqual(matches);
});

const DEFAULT_FILTERS: FilterSnapshot = {
  fields: ["title"],
  intersection: true,
  basis: "activity",
  young: "",
  old: "",
  limit: "",
  project: "",
  providers: [],
  sources: [],
  executors: [],
  created: [],
  statuses: ["unarchived"],
};

it("counts only the sheet groups that differ from their defaults", () => {
  expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
  expect(
    countActiveFilters({
      ...DEFAULT_FILTERS,
      fields: ["title", "user"],
      old: "7d",
      project: "alpha",
      providers: ["codex"],
      statuses: ["unarchived", "unstarred"],
    }),
  ).toBe(5);
});

it("leaves the Unread chip to the chips and counts sheet statuses", () => {
  expect(
    countActiveFilters({
      ...DEFAULT_FILTERS,
      statuses: ["unarchived", "unread"],
    }),
  ).toBe(0);
  // Starred and Archived moved from the quick chips into the sheet.
  expect(
    countActiveFilters({
      ...DEFAULT_FILTERS,
      statuses: ["unarchived", "unread", "starred"],
    }),
  ).toBe(1);
  expect(countActiveFilters({ ...DEFAULT_FILTERS, statuses: [] })).toBe(1);
  expect(
    countActiveFilters({ ...DEFAULT_FILTERS, statuses: ["archived"] }),
  ).toBe(1);
});

it("toggles the Unread chip without touching the archive view", () => {
  expect(toggleChipStatus(["unarchived"], "unread")).toEqual([
    "unarchived",
    "unread",
  ]);
  expect(toggleChipStatus(["unarchived", "unread"], "unread")).toEqual([
    "unarchived",
  ]);
});

it("matches needs-you before running and counts unarchived sessions only", () => {
  const base = { id: "s", updatedAt: "", hasUnread: false };
  const waiting = { ...base, activity: "waiting-input" as const };
  const running = { ...base, activity: "in-turn" as const, hasUnread: true };
  const asking = {
    ...base,
    activity: "in-turn" as const,
    pendingInputType: "tool-approval" as const,
  };
  expect(matchesActivity(waiting, "attention")).toBe(true);
  expect(matchesActivity(asking, "attention")).toBe(true);
  expect(matchesActivity(asking, "running")).toBe(false);
  expect(matchesActivity(running, "running")).toBe(true);
  expect(parseActivityParam("running,bogus,attention")).toEqual([
    "running",
    "attention",
  ]);
  const sessions = [waiting, running, asking, { ...running, isArchived: true }];
  expect(countQuickViews(sessions as unknown as GlobalSessionItem[])).toEqual({
    attention: 2,
    running: 1,
    unread: 1,
  });
});
