# Fake Codex foreground-tool interrupt occasionally exceeds its message wait

The complete serial workspace test run on 2026-10-26 failed only
`CodexProvider app-server lifecycle > accepts a clean Codex foreground-tool
interrupt` in `packages/server/test/sdk/providers/codex.test.ts:2947`.
`waitForMessage` at line 5330 waits a fixed two seconds for the fake process's
`call-active` message. The run reported 6637 server tests passed and this one
failure. A separate, single-worker run of the entire provider file passed all
138 enabled tests (two skipped) in 37.76 seconds. Provider code was unchanged.

This establishes a batch-sensitive test failure, not a diagnosed protocol bug.
Investigate child startup/message scheduling and retain the foreground-tool
interrupt assertions; do not silently increase the product input deadline.
The UI task left provider behavior unchanged because it is outside its scope.

Found 2026-10-26 while verifying the unified session workbench.
