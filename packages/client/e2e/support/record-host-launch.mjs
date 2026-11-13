// @ts-check
/** Observe owned fixture launches without replacing their runtime or lifetime. */
import childProcess from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  captureProcessIdentity,
  processGroupAlive,
  providerHostCapability,
} from "../../../../scripts/provider-process-identity.mjs";

const hostEntrypoint = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../scripts/provider-runtime-host.mjs",
);
const spawn = childProcess.spawn;
const canTrackDetached = providerHostCapability({ probe: false }).supported;

/** @param {string} runtimeDir */
function createLaunchReceipt(runtimeDir) {
  const directory = join(runtimeDir, "e2e-launches");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = join(directory, `${randomUUID()}.json`);
  /** @param {Record<string, unknown>} record */
  const write = (record) => {
    const temporary = `${file}.tmp`;
    writeFileSync(temporary, JSON.stringify(record), { mode: 0o600 });
    renameSync(temporary, file);
  };
  // Publish before spawn so a crash cannot look like successful reclamation.
  const label = "E2E fixture process launch";
  write({ pending: true, label });
  return { file, write, label };
}

/**
 * @param {readonly string[] | import("node:child_process").SpawnOptions} [args]
 * @param {import("node:child_process").SpawnOptions} [options]
 */
function launchOptions(args, options) {
  return (
    options ??
    (Array.isArray(args)
      ? undefined
      : /** @type {import("node:child_process").SpawnOptions | undefined} */ (
          args
        ))
  );
}

/**
 * @returns {import("node:child_process").ChildProcess}
 * @param {string} command
 * @param {readonly string[] | import("node:child_process").SpawnOptions} [args]
 * @param {import("node:child_process").SpawnOptions} [options]
 */
function observedSpawn(command, args, options) {
  const argumentsArray = Array.isArray(args) ? args : [];
  const spawnOptions = launchOptions(args, options);
  const runtimeDir = (spawnOptions?.env ?? process.env)
    .VIBEALLDAY_PROVIDER_HOST_RUNTIME_DIR;
  // Model discovery also detaches; it must release the private profile before
  // cleanup. Only launches carrying this fixture's runtime marker are owned.
  if (
    !runtimeDir ||
    (argumentsArray[0] !== hostEntrypoint &&
      !(canTrackDetached && spawnOptions?.detached))
  )
    return Reflect.apply(spawn, childProcess, [command, args, options]);

  const { file, write, label } = createLaunchReceipt(runtimeDir);
  let child;
  try {
    child = spawn(command, argumentsArray, spawnOptions ?? {});
  } catch (error) {
    rmSync(file, { force: true }); // No child was created.
    throw error;
  }
  child.on("error", () => {});
  if (!child.pid) {
    // Spawn failed before acquiring a process; the normal caller reports it.
    rmSync(file, { force: true });
    return child;
  }
  try {
    const identity = captureProcessIdentity(child.pid);
    write({
      pid: child.pid,
      leaderStartTime: identity.startTime,
      label,
    });
  } catch (error) {
    // A short-lived detached probe may exit before identity capture finishes.
    if (canTrackDetached && !processGroupAlive(child.pid)) {
      rmSync(file, { force: true });
      return child;
    }
    // The live handle proves ownership. Leave the pending marker if capture
    // or persistence failed so coordinator cleanup cannot silently succeed.
    try {
      child.kill("SIGKILL");
    } catch {}
    throw error;
  }
  return child;
}
childProcess.spawn = /** @type {typeof spawn} */ (observedSpawn);
syncBuiltinESMExports();
