/**
 * Which VIBEALLDAY-emulated slash commands may be queued for later server execution,
 * and which may only run against the live composer.
 *
 * A VIBEALLDAY-emulated command is not provider text: the composer normally consumes
 * it and performs the operation immediately. That is wrong when the user chose
 * a delayed delivery lane such as Project Queue, where the point is to run the
 * command later. Queueable commands are carried verbatim as a tagged
 * `vibeAllDayCommand` on the queued item and executed by the server at dispatch, the
 * same routing-at-ingress rule `topics/emulated-slash-commands.md` states for
 * the per-session VIBEALLDAY-command lane.
 */

import {
  type ClearloopCommandArguments,
  isRewindSlashCommand,
  parseClearloopArguments,
  parseTurnIndexArgument,
} from "./session-rewind.js";

/** Emulated commands the server can execute from a queue entry. */
export const QUEUEABLE_VIBEALLDAY_COMMANDS = ["clear", "clearloop"] as const;

export type QueuedVibeAllDayCommandName =
  (typeof QUEUEABLE_VIBEALLDAY_COMMANDS)[number];

/**
 * Emulated commands that are schedulable in principle but have no queued
 * execution path yet. `/fork N` creates a *new* session, so a queued fork
 * would have to change its own item's target; that is a separate design.
 */
export const UNSUPPORTED_QUEUED_VIBEALLDAY_COMMANDS = ["fork"] as const;

export type UnsupportedQueuedVibeAllDayCommandName =
  (typeof UNSUPPORTED_QUEUED_VIBEALLDAY_COMMANDS)[number];

/**
 * Emulated commands that act on composer or client state and therefore cannot
 * be handed to a scheduler. Queueing one would have to either run it now
 * (defeating the request) or run it later against a composer that no longer
 * exists, so they are refused at enqueue instead.
 */
export const COMPOSER_ONLY_VIBEALLDAY_COMMANDS = [
  "model",
  "btw",
  "done",
  "archive",
  "terminate",
  "title",
  "compact",
  "view",
] as const;

export type ComposerOnlyVibeAllDayCommandName =
  (typeof COMPOSER_ONLY_VIBEALLDAY_COMMANDS)[number];

/** A queued VIBEALLDAY command: the command name plus its verbatim argument text. */
export interface QueuedVibeAllDayCommand {
  name: QueuedVibeAllDayCommandName;
  /** Raw text after the command name, unparsed and untrimmed of inner form. */
  argument: string;
}

/** What a well-formed queued command asks the server to do at dispatch. */
export type QueuedVibeAllDayCommandAction =
  | { name: "clear"; turnIndex: number }
  | { name: "clearloop"; arguments: ClearloopCommandArguments };

/**
 * Why a queueable command's argument cannot run: `syntax` for an unreadable
 * argument, `clear-zero` for bare `/clear` or `/clear 0`, which is the
 * composer's navigate-to-a-new-session action rather than a session operation
 * a scheduler can perform.
 */
export type QueuedVibeAllDayCommandProblem = "syntax" | "clear-zero";

export type QueuedVibeAllDayCommandReading =
  | { ok: true; action: QueuedVibeAllDayCommandAction }
  | { ok: false; problem: QueuedVibeAllDayCommandProblem };

/**
 * Read a queued command's argument. The one parser for queued commands: the
 * enqueue classification and the dispatch runner both use it, so a malformed
 * command is refused when it is queued rather than hours later at dispatch.
 */
export function readQueuedVibeAllDayCommand(
  command: QueuedVibeAllDayCommand,
): QueuedVibeAllDayCommandReading {
  if (command.name === "clearloop") {
    const parsed = parseClearloopArguments(command.argument);
    return parsed
      ? { ok: true, action: { name: "clearloop", arguments: parsed } }
      : { ok: false, problem: "syntax" };
  }
  const turnIndex = parseTurnIndexArgument(command.argument, {
    allowEmpty: true,
  });
  if (turnIndex === null) return { ok: false, problem: "syntax" };
  if (turnIndex === 0) return { ok: false, problem: "clear-zero" };
  return { ok: true, action: { name: "clear", turnIndex } };
}

export type QueuedVibeAllDayCommandClassification =
  | { kind: "prompt" }
  | { kind: "queueable"; command: QueuedVibeAllDayCommand; commandText: string }
  | {
      /** A queueable command whose argument cannot run; refused at enqueue. */
      kind: "invalid";
      command: QueuedVibeAllDayCommand;
      problem: QueuedVibeAllDayCommandProblem;
    }
  | { kind: "composer-only"; name: ComposerOnlyVibeAllDayCommandName }
  | { kind: "unsupported"; name: UnsupportedQueuedVibeAllDayCommandName };

const ALIASES: Record<string, string> = {
  m: "model",
  b: "btw",
  d: "done",
  v: "view",
};

function isQueueable(name: string): name is QueuedVibeAllDayCommandName {
  return (QUEUEABLE_VIBEALLDAY_COMMANDS as readonly string[]).includes(name);
}

function isComposerOnly(
  name: string,
): name is ComposerOnlyVibeAllDayCommandName {
  return (COMPOSER_ONLY_VIBEALLDAY_COMMANDS as readonly string[]).includes(
    name,
  );
}

/**
 * Decide how composer text should reach a delayed delivery lane. Anything that
 * is not a VIBEALLDAY-emulated command — ordinary prose, a provider command, a skill
 * line, an effort modifier such as `/fast …` — is `prompt` and queues as text.
 * Without rewind support, `/clear`, `/fork`, and `/clearloop` are the
 * provider's own commands and queue as text too, as does `/v` or `/view`
 * where VIBEALLDAY's file-view command is unavailable.
 */
export function classifyQueuedVibeAllDayCommand(
  text: string,
  {
    rewindSupported,
    fileViewSupported = false,
  }: { rewindSupported: boolean; fileViewSupported?: boolean },
): QueuedVibeAllDayCommandClassification {
  const match = /^\/([^\s/]+)(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!match) return { kind: "prompt" };
  const authored = match[1]?.toLowerCase() ?? "";
  const name = ALIASES[authored] ?? authored;
  const argument = match[2] ?? "";
  if (!rewindSupported && isRewindSlashCommand(name)) return { kind: "prompt" };
  if (!fileViewSupported && name === "view") return { kind: "prompt" };
  if (isQueueable(name)) {
    const trimmed = argument.trim();
    const command = { name, argument: trimmed };
    const reading = readQueuedVibeAllDayCommand(command);
    if (!reading.ok) {
      return { kind: "invalid", command, problem: reading.problem };
    }
    return {
      kind: "queueable",
      command,
      commandText: trimmed ? `/${name} ${trimmed}` : `/${name}`,
    };
  }
  if (isComposerOnly(name)) return { kind: "composer-only", name };
  if (
    (UNSUPPORTED_QUEUED_VIBEALLDAY_COMMANDS as readonly string[]).includes(name)
  ) {
    return {
      kind: "unsupported",
      name: name as UnsupportedQueuedVibeAllDayCommandName,
    };
  }
  return { kind: "prompt" };
}

/**
 * The queueable command a tagged queue item's text spells, or undefined when
 * it spells none. A tag exists only where the enqueuing session supported
 * rewind, so the text is read with rewind support. A command with an invalid
 * argument still spells its command: it keeps its tag so the server refuses
 * it, instead of losing the tag and reaching a provider as a prompt.
 */
export function queuedVibeAllDayCommandForText(
  text: string,
): QueuedVibeAllDayCommand | undefined {
  const classified = classifyQueuedVibeAllDayCommand(text, {
    rewindSupported: true,
  });
  return classified.kind === "queueable" || classified.kind === "invalid"
    ? classified.command
    : undefined;
}

/**
 * Re-tag an edited queue message from its new text: a tagged item edited to
 * another command runs that command, and one edited into prose becomes a
 * prompt. An untagged message is returned unchanged.
 */
export function retagEditedQueuedMessage<
  T extends { text: string; vibeAllDayCommand?: QueuedVibeAllDayCommand },
>(message: T): T {
  if (!message.vibeAllDayCommand) return message;
  const { vibeAllDayCommand: _previous, ...rest } = message;
  const vibeAllDayCommand = queuedVibeAllDayCommandForText(message.text);
  return (vibeAllDayCommand ? { ...rest, vibeAllDayCommand } : rest) as T;
}
