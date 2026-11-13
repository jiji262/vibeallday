# Testing

[Contributor guide](../../DEVELOPMENT.md) · [Development docs](README.md)

Commands and code paths below are relative to the repository root unless stated
otherwise.

## Test Value And CI Cost

Keep CI latency and runner load stable over time by judging tests on the
regressions they can reveal relative to their ongoing runtime and maintenance
cost. Agents are authorized to avoid writing, remove, consolidate, or replace
low-value tests without separate permission. This includes shallow mocked/local
tests that merely restate the implementation or assert mock wiring whose
correctness is readily established by reading the code. Like redundant comments,
such tests can add upkeep without protecting useful behavior. Test count and
coverage percentage alone do not establish value.

Apply the same retention decision to tests used to prove a feature during
implementation: keep them when they protect likely future regressions or
meaningful failure modes; their usefulness during development does not by itself
justify permanent CI execution. A test can be valuable during exploration and
be removed before landing, or later when its continuing value no longer pays
for its cost.

Prefer scenarios exercising real integration boundaries, specific regression
risks, tricky interactions, or fragile-seeming code. Small unit tests remain
valuable for subtle algorithms and state transitions. Mocks are useful for
controlling a real failure or interleaving; they are weak evidence when they
replace the behavior being claimed. Tests capable of exposing rare races or
unexpected scheduling failures have lasting value even when they rarely fail.
Preserve that detection capability when making them faster. Investigate an
intermittent failure before deciding it is expendable test noise.

For a removal or replacement, identify the plausible regression the test could
catch and whether surviving coverage still catches it, or explain why the
assertion adds little beyond code inspection. Do not require a replacement for
every deleted trivial assertion. Do not delete a failing test merely to make CI
green or remove unique security, persistence, transport, or real-input coverage
without preserving its contract.

When retaining tests, reduce their duration in seconds where practical: remove
fixed sleeps, unnecessary services, repeated setup and duplicate scenarios;
use controlled clocks or interleavings where they preserve the failure under
test. Keep enough real scheduling coverage to expose races. Compare relevant
before/after case or suite times on comparable runs, including setup, teardown,
retries and total runner time. More parallel workers can reduce wall time while
increasing load; report both. A single local sample is diagnostic, not proof of
a sustained CI improvement. Avoid adding expensive measurement machinery for a
trivial deletion. [E2E testing](../../topics/e2e-testing.md) owns browser-boundary
choices and detailed cost measurement; [test time budgets](../../topics/test-time-budgets.md)
owns timeout evidence. Raising timeouts, retries or resource allocation does not
count as accelerating a test.

## After Editing Code

After editing TypeScript or other source files, verify your changes compile
and pass `pnpm lint`, `pnpm format:check`, `pnpm typecheck` (no emit), and
`pnpm test`. For UI changes, run the relevant focused browser checks. The full
client E2E suite remains a CI gate; run it locally when the affected browser
scope cannot be bounded reliably. [E2E testing](../../topics/e2e-testing.md)
owns the decision to add a browser case, choose a cheaper test level, and
measure its cost and reliability. [UI testing](../../topics/ui-testing.md)
owns visual QA and captures.

For site changes (marketing pages in `site/`):

```bash
cd site && npm run build   # Astro check + build (or: pnpm site:build from root)
```

Fix any errors before considering the task complete.

Root `pnpm typecheck` includes `pnpm e2e:typecheck`, which checks all client
Playwright specs, configurations and support modules through
`packages/client/tsconfig.e2e.json`. Keep fixture and startup changes in that
strict gate; Playwright strips types without checking them.

The general CI unit-test job runs `pnpm test` for the core Web workspaces.

Captured provider regressions run offline in the normal server suite:
`pnpm --dir packages/server exec vitest run test/captured-provider.test.ts`.
The [corpus README](../../packages/server/test/fixtures/captured/README.md)
owns the capture/import recipe, coverage limits, and manifest format. These
tests use production readers/adapters and require no provider credentials or
private histories. Root typechecking includes their helpers and importer.

Environment-dependent subprocess tests must control both the child environment
and relevant process descriptors. In particular, Bash `BASH_ENV` probes use
ignored stdin rather than inheriting a test runner's socket-backed stdin. See
[subprocess environment boundaries](../../topics/subprocess-environment.md) for the
runtime and hermetic-test contract.

Full server-app tests import `test/setup/create-app.ts`, rather than the
production constructor directly. The wrapper gives each app its own storage
under the test file's hermetic data root, as well as empty provider histories.
The production constructor reads its `dataDir` option, not `VIBEALLDAY_DATA_DIR`;
setting the environment alone does not isolate these fixtures. Pass an
explicit `dataDir` only when the test needs an owned persisted profile, such
as a restart or shared-storage scenario. Dispose app services before removing
their fixture directories. The wrapper drains all registered app services at file teardown before removing
the file's storage root, including supervisor maintenance and artifact readiness
writes. Repeated explicit app disposal joins the same cleanup promise.
Restore fake timers before leaving a test that admits asynchronous maintenance
work, so teardown can drain its promises rather than wait on a frozen clock.
The wrapper injects an offline latest-version lookup. Browser server processes
use a fixture preload that supplies the update endpoint's real 204 no-update
response while forwarding other HTTP traffic. Version-route contract tests own
their explicit update responses; general tests never require public update
service availability. Client unit setup clears local/session storage before
invalidating preference caches, so earlier cases cannot choose later defaults.

## Cross-Platform Behavior And Tests

Treat Linux, macOS, and Windows as supported development targets. Code and
tests must not assume that the current host's filesystem, descriptor, process,
or shell behavior is portable. Pay particular attention to path syntax and
case handling, symlinks, `/proc` and `/dev/fd`, permissions and file locking,
signals and process trees, executable discovery, temporary directories, and
shell availability.

For every OS-sensitive change, either use portable APIs and cover all three
platforms, or make the narrower capability explicit: document it, gate native
tests by platform or capability, and test the supported fallback on the other
platforms. Passing on one contributor's OS is not sufficient evidence. When
other-OS validation is unavailable, state that limitation in the handoff.
Never weaken a security boundary merely to make another platform pass.
