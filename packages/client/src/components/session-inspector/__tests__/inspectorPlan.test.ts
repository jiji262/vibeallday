// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Message } from "../../../types";
import { findLatestPlan, useLatestPlan } from "../inspectorPlan";

function toolUse(name: string, input: unknown): Message {
  return {
    type: "assistant",
    message: {
      role: "assistant",
      content: [{ type: "tool_use", id: name, name, input }],
    },
  } as Message;
}

const text = (value: string): Message =>
  ({ type: "assistant", message: { content: value } }) as Message;

const todos = (status: string) =>
  toolUse("TodoWrite", {
    todos: [
      { content: "Reproduce", status: "completed" },
      { content: "Fix", status },
    ],
  });

describe("inspector plan", () => {
  it("reads the newest TodoWrite or update_plan call", () => {
    const messages = [
      todos("pending"),
      text("working"),
      toolUse("update_plan", {
        plan: [
          { step: "Write test", status: "in_progress" },
          { step: "  ", status: "pending" },
        ],
      }),
      text("still working"),
    ];
    expect(findLatestPlan(messages)?.steps).toEqual([
      { text: "Write test", state: "in_progress" },
    ]);
    expect(findLatestPlan([text("no plan")])).toBeNull();
  });

  it("keeps the same plan object across ticks that only append text", () => {
    const first = [todos("in_progress")];
    const { result, rerender } = renderHook(
      ({ messages, active }) => useLatestPlan(messages, active),
      { initialProps: { messages: first, active: true } },
    );
    const plan = result.current;
    expect(plan?.steps[1]?.state).toBe("in_progress");

    rerender({ messages: [...first, text("tick")], active: true });
    expect(result.current).toBe(plan);

    rerender({
      messages: [...first, text("tick"), todos("completed")],
      active: true,
    });
    expect(result.current).not.toBe(plan);
    expect(result.current?.steps[1]?.state).toBe("completed");

    // A hidden tab does not scan the transcript at all.
    rerender({ messages: [...first], active: false });
    expect(result.current).toBeNull();
  });
});
