import { describe, expect, it } from "vitest";
import {
  mergeSeen,
  readTriageProgress,
  readTriageReturn,
  skipItem,
  type TriageProgress,
  triageCounts,
  triageOrder,
} from "../triageQueue";

describe("triage queue", () => {
  it("counts items that left the live list as handled", () => {
    const seen = mergeSeen([], ["a", "b", "c"]);
    expect(triageCounts(seen, ["a", "b", "c"])).toEqual({
      total: 3,
      handled: 0,
      current: 1,
    });
    // "a" was answered in its session; a new item arrived meanwhile.
    const later = mergeSeen(seen, ["b", "c", "d"]);
    expect(triageCounts(later, ["b", "c", "d"])).toEqual({
      total: 4,
      handled: 1,
      current: 2,
    });
    expect(triageCounts(later, [])).toEqual({
      total: 4,
      handled: 4,
      current: 0,
    });
  });

  it("keeps the same seen array when nothing new arrives", () => {
    const seen = ["a", "b"];
    expect(mergeSeen(seen, ["b"])).toBe(seen);
  });

  it("puts skipped items last in skip order and cycles them", () => {
    let progress: TriageProgress = { seen: ["a", "b", "c"], skipped: [] };
    progress = skipItem(progress, "a");
    expect(triageOrder(["a", "b", "c"], progress.skipped)).toEqual([
      "b",
      "c",
      "a",
    ]);
    progress = skipItem(skipItem(progress, "b"), "c");
    expect(triageOrder(["a", "b", "c"], progress.skipped)).toEqual([
      "a",
      "b",
      "c",
    ]);
    // A skipped item that was handled elsewhere drops out of the order.
    expect(triageOrder(["b", "c"], progress.skipped)).toEqual(["b", "c"]);
  });

  it("restores only well-formed progress from history state", () => {
    expect(
      readTriageProgress({ triage: { seen: ["a", 1], skipped: "b" } }),
    ).toEqual({ seen: ["a"], skipped: [] });
    expect(readTriageProgress(null)).toEqual({ seen: [], skipped: [] });
  });

  it("returns to Triage only through an in-app path", () => {
    const progress = { seen: ["a"], skipped: ["a"] };
    expect(
      readTriageReturn({ triageReturnTo: "/triage?x=1", triage: progress }),
    ).toEqual({ to: "/triage?x=1", progress });
    for (const to of ["//evil.test", "/\\evil.test", "https://evil.test", 3]) {
      expect(readTriageReturn({ triageReturnTo: to })).toBeNull();
    }
    expect(readTriageReturn(undefined)).toBeNull();
  });
});
