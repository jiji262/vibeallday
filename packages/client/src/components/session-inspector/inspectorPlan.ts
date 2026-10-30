import type { AppContentBlock } from "@vibeallday/shared";
import { useMemo, useRef } from "react";
import type { Message } from "../../types";

export type PlanStepState = "pending" | "in_progress" | "completed";

export interface PlanStep {
  text: string;
  state: PlanStepState;
}

/** The latest task list or plan, with a signature for cheap identity checks. */
export interface PlanSnapshot {
  steps: readonly PlanStep[];
  signature: string;
}

const TODO_TOOL_NAMES = new Set(["TodoWrite"]);
const PLAN_TOOL_NAMES = new Set(["UpdatePlan", "update_plan"]);
const COMPLETED_WORDS = new Set(["completed", "complete", "done"]);
const ACTIVE_WORDS = new Set([
  "in_progress",
  "in-progress",
  "active",
  "running",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeState(status: unknown): PlanStepState {
  if (typeof status !== "string") return "pending";
  const word = status.trim().toLowerCase();
  if (COMPLETED_WORDS.has(word)) return "completed";
  if (ACTIVE_WORDS.has(word)) return "in_progress";
  return "pending";
}

function readSteps(
  entries: unknown,
  textField: "content" | "step",
): PlanStep[] | null {
  if (!Array.isArray(entries)) return null;
  const steps: PlanStep[] = [];
  for (const entry of entries) {
    if (!isRecord(entry)) continue;
    const text = entry[textField];
    if (typeof text !== "string" || !text.trim()) continue;
    steps.push({ text: text.trim(), state: normalizeState(entry.status) });
  }
  return steps;
}

function stepsFromBlock(block: AppContentBlock): PlanStep[] | null {
  if (block.type !== "tool_use" || !block.name || !isRecord(block.input)) {
    return null;
  }
  if (TODO_TOOL_NAMES.has(block.name)) {
    return readSteps(block.input.todos, "content");
  }
  if (PLAN_TOOL_NAMES.has(block.name)) {
    return readSteps(block.input.plan, "step");
  }
  return null;
}

function messageBlocks(message: Message): readonly AppContentBlock[] {
  const content = message.message?.content ?? message.content;
  return Array.isArray(content) ? content : [];
}

/**
 * The newest TodoWrite / UpdatePlan call in the transcript, scanning from the
 * end so a long session stops at its latest plan. Null when there is none.
 */
export function findLatestPlan(
  messages: readonly Message[],
): PlanSnapshot | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) continue;
    const blocks = messageBlocks(message);
    for (let block = blocks.length - 1; block >= 0; block -= 1) {
      const candidate = blocks[block];
      const steps = candidate ? stepsFromBlock(candidate) : null;
      if (steps) {
        return {
          steps,
          signature: steps
            .map((step) => `${step.state}:${step.text}`)
            .join("\n"),
        };
      }
    }
  }
  return null;
}

/**
 * Latest plan while `active`, keeping the previous object when the plan did
 * not change, so a memoized inspector skips stream ticks that only append
 * text. Inactive callers pay nothing.
 */
export function useLatestPlan(
  messages: readonly Message[],
  active: boolean,
): PlanSnapshot | null {
  const found = useMemo(
    () => (active ? findLatestPlan(messages) : null),
    [active, messages],
  );
  const stable = useRef<PlanSnapshot | null>(null);
  if (found?.signature !== stable.current?.signature) {
    stable.current = found;
  }
  return stable.current;
}
