import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { tsImport } from "tsx/esm/api";
import {
  processGroupAlive,
  providerHostCapability,
} from "../../../../scripts/provider-process-identity.mjs";

const { stopProviderHostRuntime } = await tsImport(
  "./provider-host-runtime.ts",
  import.meta.url,
);
const { terminateRegisteredProcess } = await tsImport(
  "./process-lifecycle.ts",
  import.meta.url,
);
const execFileAsync = promisify(execFile);
const STARTUP_TIMEOUT_MS = 5000;
const WRITER_INTERVAL_MS = 10;
const groupTestOptions = { skip: !providerHostCapability().supported };
const preload = new URL("./fixture-runtime.mjs", import.meta.url).href;
const identityModule = new URL(
  "../../../../scripts/provider-process-identity.mjs",
  import.meta.url,
).href;
const writerSource = `
  import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
  import { join } from 'node:path';
  import { captureProcessIdentity } from ${JSON.stringify(identityModule)};
  const identity = captureProcessIdentity();
  writeFileSync(process.env.FIXTURE_WRITER_CUSTODY, JSON.stringify({
    pid: identity.pid, leaderStartTime: identity.startTime
  }), { mode: 0o600 });
  const profile = process.env.FIXTURE_WRITER_PROFILE;
  mkdirSync(profile, { recursive: true });
  const write = () => appendFileSync(join(profile, 'journal'), 'x');
  write();
  setInterval(write, ${WRITER_INTERVAL_MS});
`;

async function launchWriter({ runtimeDir, profileDir, custodyPath, tracked }) {
  const launcher = `
    import { spawn } from 'node:child_process';
    import { captureProcessIdentity } from ${JSON.stringify(identityModule)};
    const child = spawn(process.execPath,
      ['--input-type=module', '--eval', ${JSON.stringify(writerSource)}],
      { detached: true, stdio: 'ignore' });
    const identity = captureProcessIdentity(child.pid);
    process.stdout.write(JSON.stringify({
      pid: child.pid, leaderStartTime: identity.startTime
    }));
    child.unref();
  `;
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--input-type=module", "--eval", launcher],
    {
      env: {
        ...process.env,
        NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${preload}`]
          .filter(Boolean)
          .join(" "),
        VIBEALLDAY_PROVIDER_HOST_RUNTIME_DIR: tracked ? runtimeDir : undefined,
        FIXTURE_WRITER_PROFILE: profileDir,
        FIXTURE_WRITER_CUSTODY: custodyPath,
      },
      timeout: STARTUP_TIMEOUT_MS,
    },
  );
  return JSON.parse(stdout);
}

async function waitForFile(file) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (!existsSync(file)) {
    assert.ok(Date.now() < deadline, "Detached writer did not become ready");
    await new Promise((resolve) => setTimeout(resolve, WRITER_INTERVAL_MS));
  }
}

async function cleanupWriter({ owner, runtimeDir, custodyPath, root }) {
  const failures = [];
  try {
    await stopProviderHostRuntime(runtimeDir);
  } catch (error) {
    failures.push(error);
  }
  if (!owner) {
    try {
      await waitForFile(custodyPath);
      owner = JSON.parse(readFileSync(custodyPath, "utf8"));
    } catch (error) {
      failures.push(error);
    }
  }
  if (owner) {
    try {
      await terminateRegisteredProcess(
        owner.pid,
        "owned fixture writer",
        owner.leaderStartTime,
      );
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "Writer cleanup failed; recovery records retained",
    );
  rmSync(root, { recursive: true, force: true });
}

async function writerFixture(t, tracked) {
  const root = mkdtempSync(join(tmpdir(), "vibeallday-owned-launch-"));
  const runtimeDir = join(root, "runtime");
  const profileDir = join(root, "profile");
  const custodyPath = join(root, "writer-custody.json");
  let owner;
  t.after(() => cleanupWriter({ owner, runtimeDir, custodyPath, root }));
  owner = await launchWriter({ runtimeDir, profileDir, custodyPath, tracked });
  await waitForFile(join(profileDir, "journal"));
  return { runtimeDir, profileDir, owner };
}

test(
  "reclaims a detached fixture writer after its launcher exits",
  groupTestOptions,
  async (t) => {
    const { runtimeDir, profileDir, owner } = await writerFixture(t, true);
    assert.equal(processGroupAlive(owner.pid), true);

    await stopProviderHostRuntime(runtimeDir);
    assert.equal(
      processGroupAlive(owner.pid),
      false,
      "Fixture storage must not be removed while a detached writer is alive",
    );
    rmSync(profileDir, { recursive: true, force: true });
    assert.equal(existsSync(profileDir), false);
  },
);

test(
  "does not reclaim detached work without the fixture runtime marker",
  groupTestOptions,
  async (t) => {
    const { runtimeDir, owner } = await writerFixture(t, false);
    await stopProviderHostRuntime(runtimeDir);
    assert.equal(processGroupAlive(owner.pid), true);
  },
);
