import { expect, it } from "vitest";
import {
  countActiveFilters,
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

it("leaves chip statuses to the chips and counts a cleared status as a change", () => {
  expect(
    countActiveFilters({
      ...DEFAULT_FILTERS,
      statuses: ["unarchived", "unread", "starred"],
    }),
  ).toBe(0);
  expect(countActiveFilters({ ...DEFAULT_FILTERS, statuses: [] })).toBe(1);
  expect(
    countActiveFilters({ ...DEFAULT_FILTERS, statuses: ["archived"] }),
  ).toBe(0);
});

it("returns to the unarchived view when the Archived chip is released", () => {
  expect(toggleChipStatus(["unarchived"], "archived")).toEqual(["archived"]);
  expect(toggleChipStatus(["archived", "unread"], "archived")).toEqual([
    "unread",
    "unarchived",
  ]);
  expect(toggleChipStatus(["unarchived"], "unread")).toEqual([
    "unarchived",
    "unread",
  ]);
});
