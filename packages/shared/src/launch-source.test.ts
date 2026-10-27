import { describe, expect, it } from "vitest";
import {
  AUTOMATION_LAUNCH_SOURCES,
  classifyLaunchSource,
  isLaunchSource,
} from "./launch-source.js";

describe("classifyLaunchSource", () => {
  it("files a Claude Desktop session by its entrypoint", () => {
    expect(
      classifyLaunchSource({
        family: "claude",
        entrypoint: "claude-desktop",
        firstUserText: "research一下这个项目",
      }),
    ).toBe("claude-desktop");
  });

  it("files a scheduled task by its first user message, whatever launched it", () => {
    const firstUserText =
      '  <scheduled-task name="wechat-twitter-job" file="/x">run</scheduled-task>';
    expect(
      classifyLaunchSource({
        family: "claude",
        entrypoint: "claude-desktop",
        firstUserText,
      }),
    ).toBe("claude-scheduled");
    expect(classifyLaunchSource({ family: "claude", firstUserText })).toBe(
      "claude-scheduled",
    );
  });

  it("separates the Claude CLI from SDK launchers", () => {
    expect(classifyLaunchSource({ family: "claude", entrypoint: "cli" })).toBe(
      "claude-cli",
    );
    expect(
      classifyLaunchSource({ family: "claude", entrypoint: "sdk-ts" }),
    ).toBe("claude-sdk");
    expect(
      classifyLaunchSource({ family: "claude", entrypoint: "sdk-cli" }),
    ).toBe("claude-sdk");
  });

  it("calls a Claude session without a known entrypoint unknown", () => {
    expect(classifyLaunchSource({ family: "claude" })).toBe("unknown");
    expect(
      classifyLaunchSource({ family: "claude", entrypoint: "claude-vscode" }),
    ).toBe("unknown");
  });

  it("files Codex exec runs by originator or source", () => {
    expect(
      classifyLaunchSource({
        family: "codex",
        originator: "codex_exec",
        source: "exec",
      }),
    ).toBe("codex-exec");
    expect(classifyLaunchSource({ family: "codex", source: "exec" })).toBe(
      "codex-exec",
    );
    expect(
      classifyLaunchSource({
        family: "codex",
        originator: "codex_exec",
        source: "subagent",
      }),
    ).toBe("codex-exec");
    expect(
      classifyLaunchSource({
        family: "codex",
        originator: "Codex Desktop",
        source: "exec",
      }),
    ).toBe("codex-exec");
  });

  it("files Codex Desktop sessions, including their subagents", () => {
    expect(
      classifyLaunchSource({
        family: "codex",
        originator: "Codex Desktop",
        source: "vscode",
      }),
    ).toBe("codex-desktop");
    expect(
      classifyLaunchSource({
        family: "codex",
        originator: "Codex Desktop",
        source: "subagent",
      }),
    ).toBe("codex-desktop");
    expect(
      classifyLaunchSource({
        family: "codex",
        originator: "codex_work_desktop",
      }),
    ).toBe("codex-desktop");
  });

  it("files every other Codex launcher as other", () => {
    expect(
      classifyLaunchSource({ family: "codex", originator: "codex_cli_rs" }),
    ).toBe("codex-other");
    expect(
      classifyLaunchSource({ family: "codex", originator: "vibeallday" }),
    ).toBe("codex-other");
    expect(classifyLaunchSource({ family: "codex" })).toBe("codex-other");
  });

  it("leaves providers it does not classify unlabeled", () => {
    expect(classifyLaunchSource({ family: "gemini" })).toBeUndefined();
  });
});

describe("launch source values", () => {
  it("treats Codex exec and Claude scheduled tasks as automation", () => {
    expect([...AUTOMATION_LAUNCH_SOURCES].sort()).toEqual([
      "claude-scheduled",
      "codex-exec",
    ]);
  });

  it("recognizes only known values", () => {
    expect(isLaunchSource("claude-desktop")).toBe(true);
    expect(isLaunchSource("claude")).toBe(false);
    expect(isLaunchSource(undefined)).toBe(false);
  });
});
