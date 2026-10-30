import { describe, expect, it } from "vitest";
import type { InputRequest } from "../../../types";
import { approvalPreview, inlineAsk, quickAnswer } from "../pendingInputModel";

function request(toolName: string, toolInput: unknown): InputRequest {
  return {
    id: "req-1",
    sessionId: "s-1",
    type: "tool-approval",
    prompt: `Run ${toolName}?`,
    toolName,
    toolInput,
    timestamp: "2026-10-30T00:00:00.000Z",
  };
}

const option = (label: string) => ({ label, description: "" });
const question = (extra: object = {}) => ({
  question: "Which branch?",
  header: "Branch",
  options: [option("main"), option("dev")],
  multiSelect: false,
  ...extra,
});

describe("inlineAsk", () => {
  it("offers session-wide edits only for edit tools", () => {
    expect(inlineAsk(request("Edit", { file_path: "a.ts" }))).toMatchObject({
      kind: "approval",
      canAlwaysAllow: true,
    });
    expect(inlineAsk(request("Bash", { command: "ls" }))).toMatchObject({
      kind: "approval",
      canAlwaysAllow: false,
    });
    expect(inlineAsk(request("ExitPlanMode", { plan: "x" })).kind).toBe("plan");
    expect(inlineAsk(null).kind).toBe("none");
  });

  it("answers in place only one plain single-choice question", () => {
    const ask = (questions: object[]) =>
      inlineAsk(request("AskUserQuestion", { questions })).kind;
    expect(ask([question()])).toBe("question");
    expect(ask([question({ multiSelect: true })])).toBe("questionInSession");
    expect(ask([question({ isSecret: true })])).toBe("questionInSession");
    expect(ask([question({ options: [] })])).toBe("questionInSession");
    expect(ask([question(), question()])).toBe("questionInSession");
  });

  it("keys a quick answer the way the session panel does", () => {
    expect(quickAnswer(question({ id: "q1" }), "dev")).toEqual({ q1: "dev" });
    expect(quickAnswer(question(), "dev")).toEqual({ "Which branch?": "dev" });
  });
});

describe("approvalPreview", () => {
  it("shows the whole shell command with hidden characters made visible", () => {
    const preview = approvalPreview(
      request("Bash", {
        command: "rm -rf build\u202e && echo ok",
        description: "Clean the build",
      }),
    );
    expect(preview).toEqual({
      caption: "Clean the build",
      code: "rm -rf build[U+202E RLO] && echo ok",
    });
  });
});
