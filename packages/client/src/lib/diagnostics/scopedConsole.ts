import type { ResumeScope } from "../rejectedResumeStorage";

let currentScope: ResumeScope | null | undefined;
export function getConsoleDiagnosticScope() {
  return currentScope;
}

/** console 输出保持不变，只在同步采集期间携带来源，禁止异步上下文串用。 */
export function createScopedConsole(readScope: () => ResumeScope | null) {
  const emit = (method: "log" | "warn" | "error", args: unknown[]) => {
    const previous = currentScope;
    currentScope = readScope();
    try {
      console[method](...args);
    } finally {
      currentScope = previous;
    }
  };
  return {
    log: (...args: unknown[]) => emit("log", args),
    warn: (...args: unknown[]) => emit("warn", args),
    error: (...args: unknown[]) => emit("error", args),
  };
}

export function consoleLogMessage(args: unknown[]) {
  if (args.length === 0) return null;
  const message = args
    .map((arg) =>
      typeof arg === "string"
        ? arg
        : arg instanceof Error
          ? `${arg.message}${arg.stack ? `\n${arg.stack}` : ""}`
          : JSON.stringify(arg),
    )
    .join(" ");
  const prefix =
    typeof args[0] === "string"
      ? (/^\[([A-Za-z]+)\]/.exec(args[0])?.[0] ?? "")
      : "";
  return { message, prefix };
}
