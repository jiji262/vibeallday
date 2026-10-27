import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { createInputHeadroomHandler } from "./input-headroom.mjs";

// Reuse the root loopback network-gate tests' five-second hang ceiling.
// This bounds broken cancellation, independently of the 100ms input contract.
const testOptions = { timeout: 5000 };

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function startGate(callback) {
  let stopped = false;
  const gate = createInputHeadroomHandler(callback);
  const server = createServer(async (request, response) => {
    if (await gate.handle(request, response)) return;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ trusted: 0 }));
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    stop: async () => {
      if (stopped) return;
      stopped = true;
      gate.stop();
      server.closeAllConnections();
      await new Promise((done) => server.close(done));
    },
  };
}

test(
  "input readiness waits for the host, preserves stats and refuses overlapping samples",
  testOptions,
  async (t) => {
    const entered = deferred(),
      release = deferred();
    const fixture = await startGate(async () => {
      entered.resolve("entered");
      await release.promise;
    });
    t.after(() => fixture.stop());
    try {
      const pending = fetch(`${fixture.url}/input-headroom`, {
        method: "POST",
      });
      assert.equal(
        await Promise.race([
          entered.promise,
          pending.then(() => "premature response"),
        ]),
        "entered",
      );
      assert.deepEqual(await (await fetch(fixture.url)).json(), { trusted: 0 });
      assert.equal(
        (await fetch(`${fixture.url}/input-headroom`, { method: "POST" }))
          .status,
        409,
      );
      release.resolve();
      const response = await pending;
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ready: true });
    } finally {
      release.resolve();
      await fixture.stop();
    }
  },
);

test(
  "failed host readiness remains a failing response",
  testOptions,
  async (t) => {
    const fixture = await startGate(async () => {
      throw new Error("CPU saturated");
    });
    t.after(() => fixture.stop());
    try {
      const response = await fetch(`${fixture.url}/input-headroom`, {
        method: "POST",
      });
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        ready: false,
        error: "CPU saturated",
      });
    } finally {
      await fixture.stop();
    }
  },
);

test(
  "disconnecting the requester cancels host sampling",
  testOptions,
  async (t) => {
    const entered = deferred(),
      aborted = deferred();
    const fixture = await startGate(
      ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener(
            "abort",
            () => {
              aborted.resolve();
              reject(signal.reason);
            },
            { once: true },
          );
          entered.resolve();
        }),
    );
    t.after(() => fixture.stop());
    const controller = new AbortController();
    const pending = fetch(`${fixture.url}/input-headroom`, {
      method: "POST",
      signal: controller.signal,
    });
    try {
      await entered.promise;
      controller.abort();
      await assert.rejects(pending, { name: "AbortError" });
      await aborted.promise;
    } finally {
      await fixture.stop();
    }
  },
);

test(
  "fixture teardown cancels its outstanding host sample",
  testOptions,
  async (t) => {
    const entered = deferred(),
      aborted = deferred();
    const fixture = await startGate(
      ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener(
            "abort",
            () => {
              aborted.resolve();
              reject(signal.reason);
            },
            { once: true },
          );
          entered.resolve();
        }),
    );
    t.after(() => fixture.stop());
    const pending = fetch(`${fixture.url}/input-headroom`, { method: "POST" });
    const finished = pending.catch(() => null);
    await entered.promise;
    await fixture.stop();
    await aborted.promise;
    await finished;
  },
);
