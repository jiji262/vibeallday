import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import test from "node:test";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const exec = promisify(execFile);
const require = createRequire(
  new URL("../../../server/package.json", import.meta.url),
);
const wsModule = new URL("wrapper.mjs", pathToFileURL(require.resolve("ws")))
  .href;
const preload = new URL("./fixture-runtime.mjs", import.meta.url).href;

async function run(source) {
  return exec(
    process.execPath,
    ["--import", preload, "--input-type=module", "--eval", source],
    { timeout: 5000 },
  );
}

test("fixture preload rejects remote WebSockets before DNS or socket creation", async () => {
  // DNS 被替换为确定性哨兵，旧实现的失败复现也不会访问公网。
  await run(`
    import assert from 'node:assert/strict';
    import dns from 'node:dns';
    import { WebSocket } from ${JSON.stringify(wsModule)};
    let lookups = 0;
    dns.lookup = () => { lookups++; throw new Error('DNS sentinel'); };
    for (const url of ['wss://relay.example.com/ws', 'ws://localhost/ws',
      'ws://127.0.0.1.example.com/ws', 'ws://user:pass@127.0.0.1/ws',
      'ws://[::ffff:192.0.2.1]/ws', 'ws+unix:///tmp/fixture.sock']) {
      assert.throws(() => new WebSocket(url), /E2E.*loopback/);
    }
    assert.equal(lookups, 0);
    const { createRequire } = await import('node:module');
    const require = createRequire(${JSON.stringify(new URL("../../../server/package.json", import.meta.url).href)});
    const CommonJSWebSocket = require('ws');
    assert.equal(typeof CommonJSWebSocket, 'function');
    assert.throws(() => new CommonJSWebSocket('wss://relay.example.com/ws'), /E2E.*loopback/);
  `);
});

test("fixture preload permits real loopback WebSocket traffic", async () => {
  const { WebSocketServer } = await import(wsModule);
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await once(server, "listening");
  server.on("connection", (socket) =>
    socket.on("message", (data) => socket.send(data)),
  );
  try {
    const port = server.address().port;
    const { stdout } = await run(`
      import { WebSocket } from ${JSON.stringify(wsModule)};
      const socket = new WebSocket('ws://127.0.0.1:${port}/ws');
      socket.on('open', () => socket.send('local-only'));
      socket.on('message', (data) => { process.stdout.write(data); socket.close(); });
    `);
    assert.equal(stdout, "local-only");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("real relay service cannot bypass the guard through configuration or channel restart", async () => {
  const loader = pathToFileURL(require.resolve("tsx/esm/api")).href;
  const service = new URL(
    "../../../server/src/services/RelayClientService.ts",
    import.meta.url,
  ).href;
  await run(`
    import assert from 'node:assert/strict';
    import dns from 'node:dns';
    const { tsImport } = await import(${JSON.stringify(loader)});
    const { RelayClientService } = await tsImport(${JSON.stringify(service)}, import.meta.url);
    let lookups = 0;
    dns.lookup = () => { lookups++; throw new Error('DNS sentinel'); };
    const errors = [];
    console.error = (...args) => errors.push(args.map(String).join(' '));
    console.log = () => {};
    const relay = new RelayClientService();
    for (const [index, channel] of ['app', 'speech'].entries()) {
      relay.start({ relayUrl: 'wss://relay.example.com/ws', username: 'mock-user',
        installId: 'mock-install', channel, onRelayConnection: () => {} });
      assert.equal(relay.getState().status, 'disconnected');
      assert.equal(relay.getState().reconnectAttempts, index + 1);
      relay.stop();
    }
    assert.equal(lookups, 0);
    assert.equal(errors.filter((error) => /E2E.*loopback/.test(error)).length, 2);
  `);
});
