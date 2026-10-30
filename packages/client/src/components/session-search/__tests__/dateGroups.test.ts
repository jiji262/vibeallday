import { afterEach, describe, expect, it } from "vitest";
import { dateGroupBounds } from "../dateGroups";

const originalTimeZone = process.env.TZ;

describe("dateGroupBounds", () => {
  afterEach(() => {
    process.env.TZ = originalTimeZone;
  });

  it("keeps yesterday and the week start on local midnight across a DST change", () => {
    // New York moves to daylight time at 02:00 on Sunday 8 March 2026, so
    // the Monday after is 23 hours from the Sunday midnight before it.
    process.env.TZ = "America/New_York";
    const mondayMorning = new Date(2026, 2, 9, 10).getTime();
    const bounds = dateGroupBounds(mondayMorning);
    expect(new Date(bounds.today).toISOString()).toBe(
      "2026-03-09T04:00:00.000Z",
    );
    expect(new Date(bounds.yesterday).toISOString()).toBe(
      "2026-03-08T05:00:00.000Z",
    );
    expect(new Date(bounds.week).toISOString()).toBe(
      "2026-03-09T04:00:00.000Z",
    );
  });

  it("starts the week on the Monday before a Sunday", () => {
    process.env.TZ = "America/New_York";
    const sundayEvening = new Date(2026, 2, 15, 20).getTime();
    const bounds = dateGroupBounds(sundayEvening);
    expect(new Date(bounds.week).toISOString()).toBe(
      "2026-03-09T04:00:00.000Z",
    );
    expect(new Date(bounds.yesterday).toISOString()).toBe(
      "2026-03-14T04:00:00.000Z",
    );
  });
});
