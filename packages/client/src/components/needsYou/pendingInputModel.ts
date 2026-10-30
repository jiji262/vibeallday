import { fromUrlProjectId, isUrlProjectId } from "@vibeallday/shared";
import { makeSecurityVisibleText } from "../../lib/securityVisibleText";
import type { InputRequest, UserQuestionAnswers } from "../../types";
import { toolRegistry } from "../renderers/tools";
import type { Question } from "../renderers/tools/types";
import { getToolSummary } from "../tools/summaries";

/** Tools whose approval can also switch the session to accept edits. */
const EDIT_TOOLS = new Set(["Edit", "Write", "NotebookEdit"]);

/**
 * What a card can settle without opening the session. Plan approvals and
 * questions that need typing, several answers or a secret stay in the
 * session, where the full panels live.
 */
export type InlineAsk =
  | { kind: "approval"; request: InputRequest; canAlwaysAllow: boolean }
  | { kind: "plan"; request: InputRequest }
  | { kind: "question"; request: InputRequest; question: Question }
  | { kind: "questionInSession"; request: InputRequest; question?: Question }
  | { kind: "none" };

function questionsOf(request: InputRequest): Question[] {
  const input = request.toolInput as { questions?: unknown } | undefined;
  return Array.isArray(input?.questions) ? (input.questions as Question[]) : [];
}

/** One plain single-choice question answers with one tap. */
function isQuickQuestion(questions: Question[]): boolean {
  const [only] = questions;
  return (
    questions.length === 1 &&
    !!only &&
    !only.multiSelect &&
    !only.isSecret &&
    Array.isArray(only.options) &&
    only.options.length > 0
  );
}

export function inlineAsk(request: InputRequest | null): InlineAsk {
  if (!request) return { kind: "none" };
  if (request.toolName === "AskUserQuestion") {
    const questions = questionsOf(request);
    const [first] = questions;
    if (first && isQuickQuestion(questions)) {
      return { kind: "question", request, question: first };
    }
    return { kind: "questionInSession", request, question: first };
  }
  if (request.toolName === "ExitPlanMode") return { kind: "plan", request };
  return {
    kind: "approval",
    request,
    canAlwaysAllow: EDIT_TOOLS.has(request.toolName ?? ""),
  };
}

/** The answer payload the session panel would send for one option. */
export function quickAnswer(
  question: Question,
  label: string,
): UserQuestionAnswers {
  const key = question.id ?? question.question;
  return { [key]: label };
}

export interface ApprovalPreview {
  /** The agent's own one-line reason, when it gave one. */
  caption?: string;
  /** The command or target, with hidden characters made visible. */
  code: string;
}

function commandText(input: Record<string, unknown>): string | undefined {
  const { command } = input;
  if (typeof command === "string") return command;
  if (Array.isArray(command) && command.every((p) => typeof p === "string")) {
    return command.join(" ");
  }
  return undefined;
}

/**
 * Shell approvals show the full command, since that is what runs; other
 * tools show the same summary the session panel uses.
 */
export function approvalPreview(
  request: InputRequest,
  projectPath?: string,
): ApprovalPreview {
  const input = (request.toolInput ?? {}) as Record<string, unknown>;
  const toolName = request.toolName ?? "";
  const canonical = toolName ? toolRegistry.metadata(toolName).tool : "";
  const command = canonical === "Bash" ? commandText(input) : undefined;
  if (command !== undefined) {
    const caption =
      typeof input.description === "string" && input.description.trim()
        ? makeSecurityVisibleText(input.description)
        : undefined;
    return { caption, code: makeSecurityVisibleText(command) };
  }
  const summary = toolName
    ? getToolSummary(toolName, request.toolInput, undefined, "pending", {
        projectPath,
      })
    : request.prompt;
  return { code: makeSecurityVisibleText(summary || request.prompt) };
}

/** A project id is its base64url path; summaries shorten paths under it. */
export function projectPathOf(projectId: string): string | undefined {
  return isUrlProjectId(projectId) ? fromUrlProjectId(projectId) : undefined;
}
