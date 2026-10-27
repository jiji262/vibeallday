# Source name prefixes

> `VIBEALLDAY_` and `VIBEALLDAY_` prefixes on TypeScript symbols are ordinary module naming
> choices, distinct from `VIBEALLDAY_*` process environment variables and from global
> runtime names.

Topic: source-name-prefixes

## TypeScript scope

Top-level declarations in a TypeScript file with imports or exports belong to
that module. They do not become process environment variables, browser globals,
or Node globals. TypeScript supports `namespace`, but VIBEALLDAY normally uses ES
modules instead: callers import an exported symbol explicitly.

For example, `VIBEALLDAY_GROK_BATCH_SPEECH_METHOD` is an exported constant whose value
is the persisted string `"vibeallday-grok-batch"`. The identifier is compile-time
source vocabulary; the string is runtime data. Renaming only the identifier
does not migrate the persisted value.

## Rename risk

Source-symbol prefix cleanup is separate from environment-variable migration.
Before renaming an exported `VIBEALLDAY_*` or `VIBEALLDAY_*` symbol, check:

- imports within this repository;
- exports from a package entry point that downstream packages may import;
- string values used in storage, URLs, API payloads, protocol messages, or
  generated artifacts;
- explicit globals created through `globalThis`, `window`, `declare global`,
  script-tag execution, or non-module JavaScript.

An unexported module constant can normally be renamed mechanically with its
local references. An exported constant may be a package API even when its
value does not change. A persisted or protocol string needs a compatibility
migration based on the string value, independent of the TypeScript identifier.

## Prefix direction

Do not infer that every source symbol mentioning VibeAllDay needs a product
prefix. Prefer the narrow domain name when module scope already provides
context. Use `VIBEALLDAY_` only where a product distinction is useful; avoid redundant
forms such as `VIBEALLDAY_*`. Existing `VIBEALLDAY_*` source symbols can be reviewed in a
separate pass rather than mixed into the `VIBEALLDAY_*` environment compatibility
change.
