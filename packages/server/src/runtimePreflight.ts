import {
  getServerRuntime,
  isSupportedServerRuntime,
  SERVER_BUN_RANGE,
  SERVER_NODE_RANGE,
} from "@vibeallday/shared/server-runtime";

export function checkServerRuntime(): void {
  const runtime = getServerRuntime(process.versions);
  if (isSupportedServerRuntime(runtime)) return;
  const bun = runtime.kind === "bun";
  console.error(
    `Error: VibeAllDay requires ${bun ? "Bun" : "Node.js"} ${bun ? SERVER_BUN_RANGE : SERVER_NODE_RANGE}.\n` +
      `Current runtime: ${runtime.kind} ${runtime.version ?? "unknown"}.\n` +
      `Upgrade the server runtime, then restart VIBEALLDAY: ${bun ? "https://bun.sh/docs/installation" : "https://nodejs.org/en/download"}`,
  );
  process.exit(1);
}
