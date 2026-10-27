# Managed SSH tests fail when Node runs from a Homebrew versioned keg

`packages/server/test/sdk/providers/managed-ssh-target.test.ts`,
`managed-ssh-workspace.test.ts`, `managed-ssh-agent-session.test.ts` and
`managed-codex-transcript-mirror.test.ts` pass `process.execPath` as
`nodeCommand`. `ManagedSshTarget` checks it against `SAFE_EXECUTABLE_PATTERN`
(`packages/server/src/sdk/providers/managed-ssh-target.ts:16`), which allows
only `[A-Za-z0-9._/-]` in an absolute path. Under Homebrew's versioned
formula the path is `/opt/homebrew/Cellar/node@24/24.22.0/bin/node`, so all
15 cases throw "Node executable must be a literal executable name or
absolute path" before testing anything. With the unversioned `node` formula
(`/opt/homebrew/Cellar/node/26.12.0/bin/node`) they pass. node@24 is the
runtime the maintainer's LaunchAgent uses, and the server deploy runbook puts
it first on `PATH`.

The same pattern rejects a user-configured `nodeCommand` of that form, so a
remote host whose Node lives under such a path cannot be named by its absolute
path either.

Not fixed in place: found while verifying the upstream 0.11 sync, which does
not touch this code; widening the pattern is a security-sensitive change to a
command-construction guard.

Cheap fixes: allow `@` in absolute-path segments (it carries no shell meaning
once arguments are passed without a shell; confirm how `nodeCommand` reaches
the remote command first), or have the tests pass a fixed literal such as
`"node"` and stub resolution.

Found 2026-10-26 while running the full unit suite under node@24 for the
upstream 0.11 sync.
Contributing-model: claude-opus-5-5.
