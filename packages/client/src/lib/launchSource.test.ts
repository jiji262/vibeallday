import { describe, expect, it } from "vitest";
import {
  effectiveLaunchSource,
  isHiddenAutomation,
  launchSourceOfSummary,
  parseLaunchSourceParam,
  sortLaunchSources,
} from "./launchSource";

describe("launchSourceOfSummary", () => {
  it("keeps a label the server already sent", () => {
    expect(
      launchSourceOfSummary({ provider: "claude", launchSource: "claude-cli" }),
    ).toBe("claude-cli");
  });

  it("labels a live Codex summary from its originator", () => {
    expect(
      launchSourceOfSummary({
        provider: "codex",
        originator: "codex_exec",
        source: "exec",
      }),
    ).toBe("codex-exec");
  });

  it("labels a live Claude summary only when it is a scheduled task", () => {
    expect(
      launchSourceOfSummary({
        provider: "claude",
        title: '<scheduled-task name="digest">',
      }),
    ).toBe("claude-scheduled");
    expect(
      launchSourceOfSummary({ provider: "claude", title: "fix the relay" }),
    ).toBeUndefined();
  });

  it("leaves other providers unlabeled", () => {
    expect(launchSourceOfSummary({ provider: "gemini" })).toBeUndefined();
  });
});

describe("isHiddenAutomation", () => {
  it("hides automation only while the preference is on", () => {
    const run = { launchSource: "codex-exec" as const };
    expect(isHiddenAutomation(run, true)).toBe(true);
    expect(isHiddenAutomation(run, false)).toBe(false);
    expect(isHiddenAutomation({ launchSource: "claude-desktop" }, true)).toBe(
      false,
    );
    expect(isHiddenAutomation({}, true)).toBe(false);
  });

  it("never hides a session waiting for input", () => {
    expect(
      isHiddenAutomation(
        { launchSource: "claude-scheduled", pendingInputType: "tool-approval" },
        true,
      ),
    ).toBe(false);
  });
});

describe("launch source params", () => {
  it("drops values outside the vocabulary", () => {
    expect(parseLaunchSourceParam("claude-desktop,bogus,,codex-exec")).toEqual([
      "claude-desktop",
      "codex-exec",
    ]);
    expect(parseLaunchSourceParam("")).toEqual([]);
  });

  it("orders sources by the fixed vocabulary", () => {
    expect(
      sortLaunchSources(["unknown", "codex-exec", "claude-desktop"]),
    ).toEqual(["claude-desktop", "codex-exec", "unknown"]);
  });

  it("files an unlabeled session under unknown", () => {
    expect(effectiveLaunchSource({})).toBe("unknown");
  });
});
