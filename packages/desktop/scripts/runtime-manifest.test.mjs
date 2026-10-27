import assert from "node:assert/strict";
import test from "node:test";
import {
  reportedVibeAllDayVersion,
  selectBundledVibeAllDayVersion,
} from "./runtime-manifest.mjs";

test("a packaged server reports release-shaped versions without the v", () => {
  assert.equal(reportedVibeAllDayVersion("v0.7.0-204-g02856e2c"), "0.7.0-204-g02856e2c");
  assert.equal(reportedVibeAllDayVersion("0.7.0"), "0.7.0");
});

test("a build without release tags reports an unknown version", () => {
  assert.equal(reportedVibeAllDayVersion("98ab07df6"), "unknown");
  assert.equal(reportedVibeAllDayVersion("98ab07df6-dirty"), "unknown");
  assert.equal(reportedVibeAllDayVersion("unknown"), "unknown");
});

test("the bundled VIBEALLDAY version prefers the exact git build description", () => {
  assert.equal(
    selectBundledVibeAllDayVersion("v0.7.0-204-g02856e2c", "0.7.0"),
    "v0.7.0-204-g02856e2c",
  );
});

test("the package version is only a fallback without git metadata", () => {
  assert.equal(selectBundledVibeAllDayVersion("unknown", "0.7.0"), "0.7.0");
  assert.equal(selectBundledVibeAllDayVersion("", ""), "unknown");
});
