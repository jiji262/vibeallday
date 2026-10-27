import { describe, expect, it } from "vitest";
import {
  classifyQueuedVibeAllDayCommand,
  readQueuedVibeAllDayCommand,
  retagEditedQueuedMessage,
} from "../queued-vibeallday-commands.js";

const rewind = { rewindSupported: true };
const noRewind = { rewindSupported: false };

describe("classifyQueuedVibeAllDayCommand", () => {
  it("carries a rewind command verbatim", () => {
    expect(
      classifyQueuedVibeAllDayCommand("/clearloop 3 2: keep going", rewind),
    ).toEqual({
      kind: "queueable",
      command: { name: "clearloop", argument: "3 2: keep going" },
      commandText: "/clearloop 3 2: keep going",
    });
    expect(classifyQueuedVibeAllDayCommand("/clear 7", rewind)).toEqual({
      kind: "queueable",
      command: { name: "clear", argument: "7" },
      commandText: "/clear 7",
    });
  });

  it("refuses a rewind command whose argument cannot run", () => {
    for (const [text, argument, problem] of [
      ["/clear", "", "clear-zero"],
      ["/clear 0", "0", "clear-zero"],
      ["/clear abc", "abc", "syntax"],
      ["/clear -2", "-2", "syntax"],
    ] as const) {
      expect(classifyQueuedVibeAllDayCommand(text, rewind)).toEqual({
        kind: "invalid",
        command: { name: "clear", argument },
        problem,
      });
    }
    for (const text of ["/clearloop", "/clearloop 3 go", "/clearloop 0: p"]) {
      expect(classifyQueuedVibeAllDayCommand(text, rewind)).toMatchObject({
        kind: "invalid",
        command: { name: "clearloop" },
        problem: "syntax",
      });
    }
  });

  it("refuses commands that act on the composer, aliases included", () => {
    expect(classifyQueuedVibeAllDayCommand("/title New name", rewind)).toEqual({
      kind: "composer-only",
      name: "title",
    });
    expect(classifyQueuedVibeAllDayCommand("/m", rewind)).toEqual({
      kind: "composer-only",
      name: "model",
    });
    expect(classifyQueuedVibeAllDayCommand("/b an aside", rewind)).toEqual({
      kind: "composer-only",
      name: "btw",
    });
  });

  it("refuses /v only where VIBEALLDAY's file-view command is available", () => {
    for (const text of ["/v src index", "/view README.md"]) {
      expect(
        classifyQueuedVibeAllDayCommand(text, {
          ...rewind,
          fileViewSupported: true,
        }),
      ).toEqual({ kind: "composer-only", name: "view" });
      expect(classifyQueuedVibeAllDayCommand(text, rewind)).toEqual({
        kind: "prompt",
      });
    }
  });

  it("names /fork as not yet queueable rather than running it", () => {
    expect(classifyQueuedVibeAllDayCommand("/fork 4", rewind)).toEqual({
      kind: "unsupported",
      name: "fork",
    });
  });

  it("queues rewind command names as provider text without rewind support", () => {
    for (const text of ["/clear", "/clear 7", "/fork 4", "/clearloop 2: go"]) {
      expect(classifyQueuedVibeAllDayCommand(text, noRewind)).toEqual({
        kind: "prompt",
      });
    }
    expect(
      classifyQueuedVibeAllDayCommand("/title New name", noRewind),
    ).toEqual({
      kind: "composer-only",
      name: "title",
    });
  });

  it("leaves prose, skill lines, and effort modifiers as prompts", () => {
    for (const text of [
      "just a message",
      "/harsh-review packages/server",
      "/fast do the thing",
      "/run ls -l",
      "line one\n/clear 3",
    ]) {
      expect(classifyQueuedVibeAllDayCommand(text, rewind)).toEqual({
        kind: "prompt",
      });
    }
  });
});

describe("readQueuedVibeAllDayCommand", () => {
  it("reads what the dispatch runner performs", () => {
    expect(
      readQueuedVibeAllDayCommand({ name: "clear", argument: "7" }),
    ).toEqual({
      ok: true,
      action: { name: "clear", turnIndex: 7 },
    });
    expect(
      readQueuedVibeAllDayCommand({
        name: "clearloop",
        argument: "2: keep going",
      }),
    ).toEqual({
      ok: true,
      action: {
        name: "clearloop",
        arguments: { total: 2, prompt: "keep going" },
      },
    });
  });
});

describe("retagEditedQueuedMessage", () => {
  const tagged = {
    text: "/clearloop 3 2: p",
    mode: "default",
    vibeAllDayCommand: { name: "clearloop" as const, argument: "3 2: p" },
  };

  it("follows an edit to another command", () => {
    expect(retagEditedQueuedMessage({ ...tagged, text: "/clear 5" })).toEqual({
      text: "/clear 5",
      mode: "default",
      vibeAllDayCommand: { name: "clear", argument: "5" },
    });
  });

  it("turns a command edited into prose into a prompt", () => {
    expect(
      retagEditedQueuedMessage({ ...tagged, text: "summarize instead" }),
    ).toEqual({ text: "summarize instead", mode: "default" });
  });

  it("keeps the tag on an edit to a malformed command, so it is refused", () => {
    expect(retagEditedQueuedMessage({ ...tagged, text: "/clear abc" })).toEqual(
      {
        text: "/clear abc",
        mode: "default",
        vibeAllDayCommand: { name: "clear", argument: "abc" },
      },
    );
  });

  it("leaves an untagged message alone, even when it looks like a command", () => {
    const prose = { text: "/clear 5" };
    expect(retagEditedQueuedMessage(prose)).toBe(prose);
  });
});
