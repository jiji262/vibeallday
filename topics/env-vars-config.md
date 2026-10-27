# Environment Variable Configuration

> Environment variable configuration exposes the server process environment
> and a server-managed override list for future VIBEALLDAY-launched provider sessions.

Topic: env-vars-config

## Problem

VIBEALLDAY behavior depends on both process-start environment variables and
server-managed settings. Operators currently have to know which variables were
active when VIBEALLDAY started, which ones are VIBEALLDAY-specific, and which ones would be
passed to provider child processes. This is especially easy to miss for
safety-sensitive guard variables.

The settings UI should show the active environment and let the operator define
future launch overrides without pretending VIBEALLDAY can mutate already-running
processes.

## Proposed Surface

Add a Settings subpage for environment variables:

- Show VIBEALLDAY-relevant process-start variables, including inherited system vars and
  variables catalogued in [vibeallday-env-vars.md](vibeallday-env-vars.md).
- Show an editable override list used for future VIBEALLDAY-launched provider/session
  processes. The list supports key/value fields and `KEY=value` paste/parsing
  in the key field.
- Seed the override list with `AGENT_GUARD=1` as the default safety-oriented
  override. Operators may remove it explicitly.
- Compare each override against process-start state. Overrides equivalent to
  the inherited value should render in a lighter/neutral treatment; overrides
  that change the effective child environment should be highlighted.
- Keep secret handling aligned with [vibeallday-env-vars.md](vibeallday-env-vars.md):
  VIBEALLDAY-private `VIBEALLDAY_<MODULE>_<NAME>` secrets are consumed and stripped, and
  sensitive values must not be exposed in full by default.
- Show canonical `VIBEALLDAY_*` names after startup alias normalization. Legacy
  `VIBEALLDAY_*` and `VIBEALLDAY_*` aliases must not remain as duplicate rows.

## Process Boundary

VIBEALLDAY cannot normally edit the environment of already-launched provider sessions
or OS child processes. This feature only affects:

- future provider/session launches started by VIBEALLDAY after the override changes;
- child process environment construction under VIBEALLDAY's control;
- diagnostic visibility into the server process-start environment.

Already-running sessions need an explicit restart/new launch to observe
changed overrides.

## Storage Contract

Store overrides as server settings, not browser-local preferences, because they
affect future server-side child process launches. The server should preserve
order for display, reject invalid environment variable names, and distinguish
between:

- absent override: inherit process-start value if any;
- override with value: pass that value to future children;
- explicit removal/blocking, if supported later: remove the variable from the
  child environment even when it existed at process start.

## Open Decisions

- Whether to support explicit removal/blocking in the first version, or only
  key/value overrides.
- Which inherited variables are displayed by default versus hidden behind an
  "all environment" expansion.
- How aggressively to redact values: secrets should be masked, but non-secret
  toggles need enough visible value to explain effective behavior.
- Whether environment overrides apply to every provider child process or can be
  scoped by provider/module.

## Related Topics

- [vibeallday-env-vars.md](vibeallday-env-vars.md) catalogs current VIBEALLDAY environment variables and
  naming conventions.
- [cost-efficiency.md](cost-efficiency.md) explains billing-footgun isolation
  for vendor credentials.
- [security.md](security.md) covers trust boundaries for local and remote
  clients.
