---
title: Install from source
description: Build VibeAllDay from source on macOS, Windows, or Linux and launch the local dashboard.
---

VibeAllDay is currently installed from source. The new npm package has not been published yet.

## Requirements

- Node.js 22.16 or newer (see the repository engines requirement).
- pnpm (use the repository-pinned version via Corepack).
- Claude Code, Codex CLI, or another configured provider.

## Install from source

Use a source checkout when contributing, maintaining a fork, customizing the
code, or deliberately following unreleased work:

```bash
git clone https://github.com/jiji262/vibeallday.git
cd vibeallday
pnpm install
pnpm build
pnpm start
```

For local development with live client/server rebuilds, use `pnpm dev` instead
of the production build/start pair.

## Ports and profiles

The main server defaults to port `3400`. Related maintenance and development
ports are derived from the same `PORT` value:

```bash
PORT=4000 VIBEALLDAY_PROFILE=dev pnpm start
```

A profile stores state in a separate data directory. Use profiles when a
development instance must not share settings and uploads with the normal
installation.

The default data directory is `~/.vibeallday/` on macOS and Linux and
`%USERPROFILE%\.vibeallday\` on Windows. Set `VIBEALLDAY_DATA_DIR` to use an
explicit location. `VIBEALLDAY_PROFILE=dev` uses the suffixed directory
`.vibeallday-dev` under the same user home directory.

## Provider setup

Authenticate providers using their official CLI. VibeAllDay does not collect
provider credentials or intercept OAuth tokens. Provider-specific API keys and
experimental integrations may require explicit environment or Settings values;
see [Providers](/docs/providers).
