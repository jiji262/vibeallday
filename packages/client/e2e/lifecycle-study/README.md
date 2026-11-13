# Browser lifecycle checks

These helpers retain the browser recovery and real TCP fault checks used by
Web lifecycle investigations. Native App runners and device-control tooling
have been retired.

Run the retained checks directly, or use the root `pnpm test` entry:

```bash
node --test packages/client/e2e/lifecycle-study/network-gate.checks.mjs packages/client/e2e/lifecycle-study/acceptance.checks.mjs
```

`network-gate.mjs` forwards bytes to an owned loopback server. Its controlled
fault modes exercise disconnects, backpressure and recovery without replacing
WebSocket, SRP, relay or application framing. Call `close()` to release all
owned sockets and timers.

`acceptance.mjs` judges recovery evidence: the requested page, transcript,
sidebar, unsent draft and attachments must survive an outage, and each
sequentially typed character must be acknowledged within 100 ms. A completed
experiment alone does not establish recovery.

The full-app browser suite owns fresh isolated server/relay profiles and
real session flows; see [E2E testing](../../../../topics/e2e-testing.md).
The managed artifact worker's distinct cross-origin, byte-stream and typing
qualification remains in [artifact-host](../../../../artifact-host/README.md).
