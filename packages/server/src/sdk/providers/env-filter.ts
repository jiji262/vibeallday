/**
 * Filter environment variables for child processes.
 *
 * When spawning Claude as a subprocess, we don't want to leak:
 * - npm_* variables (from pnpm/npm lifecycle)
 * - VibeAllDay internal variables
 * - Other irrelevant development/build-time variables
 *
 * We keep essential system variables that Claude might need.
 *
 * A marker meant for the agent to read must not be named `VIBEALLDAY_*` or `VIBEALLDAY_*`:
 * those are VIBEALLDAY's own configuration and are dropped here. Publish it under the
 * unprefixed `AGENT_` namespace instead, as the provider host does for
 * `AGENT_LAUNCHER` and `AGENT_LAUNCH_*`. See topics/vibeallday-env-vars.md.
 */

/** Prefixes to exclude from child process environment */
const EXCLUDED_PREFIXES = [
  "npm_", // npm/pnpm lifecycle variables
  "VIBEALLDAY_", // VibeAllDay internal variables
  "VITE_", // Vite dev server variables
  "VITEST", // Vitest test runner
  "LOG_", // Our logging configuration
];

/** Exact variable names to exclude */
const EXCLUDED_VARS = new Set([
  // A nested VIBEALLDAY session must never adopt its caller's self-inspection grant.
  "AGENT_VIBEALLDAY_API_URL",
  "AGENT_VIBEALLDAY_API_TOKEN",
  // Nor a caller's operator API token: a VIBEALLDAY server started from an agent
  // shell would otherwise hand it to every child, sandboxed ones included.
  // A launch that should have one gets its own through agentServerEnvironment.
  "AGENT_SERVER_TOKEN",
  // npm/pnpm specific
  "npm_execpath",
  "npm_node_execpath",
  // Development tools
  "INIT_CWD",
  "COLOR",
  "FORCE_COLOR",
  // Auth/maintenance ports (internal to vibeallday)
  "MAINTENANCE_PORT",
  "AUTH_DISABLED",
  // Proxy debug (internal)
  "PROXY_DEBUG",
  // Prevent nested session detection when server runs inside Claude Code
  "CLAUDECODE",
  // NODE_ENV is set to "production" by vibeallday's CLI but should not
  // leak into Claude Code child processes where it breaks project tooling
  // (e.g. React 19 + Vitest). See GitHub issue #41.
  "NODE_ENV",
  // Model selection should come from VIBEALLDAY's explicit SDK option, or from
  // Claude Code settings when VIBEALLDAY intentionally requests the default model.
  "ANTHROPIC_MODEL",
]);

const VIBEALLDAY_CONTROL_PLANE_CREDENTIALS = new Set([
  "AUTH_COOKIE_SECRET",
  "DESKTOP_AUTH_TOKEN",
  "VIBEALLDAY_PROVIDER_RUNTIME_TOKEN",
]);

/** Remove credentials that authorize VIBEALLDAY itself rather than a provider. */
export function stripVibeAllDayControlPlaneCredentials(
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(env).filter(
      ([name]) => !VIBEALLDAY_CONTROL_PLANE_CREDENTIALS.has(name),
    ),
  );
}

/** Essential variables to always keep (even if they match excluded patterns) */
const ALWAYS_KEEP = new Set([
  // Core system
  "HOME",
  "USER",
  "SHELL",
  "PATH",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "COLORTERM",
  // Common development tools
  "EDITOR",
  "VISUAL",
  "PAGER",
  // Node/runtime
  "NODE_OPTIONS",
  "NODE_PATH",
  "NVM_DIR",
  "NVM_BIN",
  // Git
  "GIT_AUTHOR_NAME",
  "GIT_AUTHOR_EMAIL",
  "GIT_COMMITTER_NAME",
  "GIT_COMMITTER_EMAIL",
  "GIT_SSH_COMMAND",
  // SSH
  "SSH_AUTH_SOCK",
  "SSH_AGENT_PID",
  // API keys Claude might need
  "ANTHROPIC_API_KEY",
  // Short-lived browser diagnostic broker credentials. These are generated
  // per VIBEALLDAY server boot and are useful only with a separately pasted tab grant.
  "VIBEALLDAY_BROWSER_DEBUG_AGENT_URL",
  "VIBEALLDAY_BROWSER_DEBUG_CALLER_TOKEN",
  // XDG directories
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_CACHE_HOME",
  "XDG_RUNTIME_DIR",
  // Misc
  "TZ",
  "TMPDIR",
  "TEMP",
  "TMP",
]);

/**
 * Filter environment variables for spawning child Claude processes.
 *
 * @param env - Environment object to filter (defaults to process.env)
 * @returns Filtered environment object suitable for child processes
 */
export function filterEnvForChildProcess(
  env: Record<string, string | undefined> = process.env,
): Record<string, string | undefined> {
  const filtered: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(env)) {
    if (VIBEALLDAY_CONTROL_PLANE_CREDENTIALS.has(key)) {
      continue;
    }
    // Always keep essential variables
    if (ALWAYS_KEEP.has(key)) {
      filtered[key] = value;
      continue;
    }

    // Exclude exact matches
    if (EXCLUDED_VARS.has(key)) {
      continue;
    }

    // Exclude by prefix
    if (EXCLUDED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      continue;
    }

    // Keep everything else
    filtered[key] = value;
  }

  filtered.ENABLE_PROMPT_CACHING_1H ??= "1";
  // Claude Code's retry watchdog keeps temporary 429/529 failures inside the
  // original provider turn instead of exhausting the normal ten attempts and
  // emitting a synthetic terminal response. Its exponential backoff caps at
  // five minutes, and the SDK abort signal still stops the wait immediately.
  // Preserve an explicit operator choice through ??=.
  filtered.CLAUDE_CODE_RETRY_WATCHDOG ??= "1";
  // The documented retry limit also governs other transient server, timeout,
  // and connection failures. Use a conventional signed-32-bit maximum as an
  // effectively unbounded default; Claude still rejects non-retryable errors
  // immediately, and operators can set a smaller limit explicitly.
  filtered.CLAUDE_CODE_MAX_RETRIES ??= "2147483647";
  // Default the Claude Code Bash ceiling to 59 min so a bounded 55-min
  // `agentctl wait` (re-polled while a long job runs) fits under it with
  // headroom. The agent still requests the long timeout per call; the 2-min
  // default (BASH_DEFAULT_TIMEOUT_MS, left unset) stays for un-opted calls.
  // A personal env (e.g. ~/keys.sh) BASH_MAX_TIMEOUT_MS overrides via ??=.
  filtered.BASH_MAX_TIMEOUT_MS ??= "3540000";

  return filtered;
}
