---
title: Desktop apps
description: Understand desktop source builds and the status of independent installers.
---

VibeAllDay desktop source supports macOS and Windows. Installers and independent signing registrations are being prepared; no signed VibeAllDay installer is published yet.

[Check desktop release status](/download)

## What the desktop app includes

The installer bundles the VibeAllDay server, web client, and a private Bun
runtime as one tested unit. First launch opens the local dashboard without
running npm or a package manager.

Claude Code and Codex are managed separately. If neither provider is detected,
the dashboard still opens and links to the providers' official setup pages.

## macOS

Choose the `.dmg` that matches your Mac:

- **Apple Silicon** for M-series Macs.
- **Intel** for Intel-based Macs.

Public macOS releases will require an independent Developer ID and notarization. Move VibeAllDay
to Applications and launch it normally. macOS may still show ordinary first-run
security confirmation for an app downloaded from the internet.

## Windows

Future public releases will use a signed per-user `x64-setup.exe` installer. It also works on Windows
ARM64 because the app bundles a native ARM64 runtime.

## Tray behavior and data

The tray menu exposes the dashboard, server output, diagnostics, update checks,
startup behavior, restart, and quit. Closing the dashboard hides it and, by
default, unloads the hidden web view after five minutes while leaving the tray
app, server, and active provider sessions running.

Desktop data uses a separate desktop profile so it does not silently overwrite
an existing command-line installation's state. The default location is
`~/.vibeallday-desktop/` on macOS and
`%USERPROFILE%\.vibeallday-desktop\` on Windows.

## Updates and recovery

Use the desktop update check when offered. A manual reinstall of a newer signed
release is the supported recovery path. Automatic downgrade is not supported.

If the app cannot start its bundled server, open **Desktop Diagnostics** and
**Server Output** before filing an issue. Include the app version, bundled VibeAllDay version, operating system, and the bounded error output—never provider
credentials or session contents.

## Mobile app status

The Android app is in development and iOS is planned afterward. Neither app is
published or part of the desktop download, and no public APK or store listing
is currently offered. Use the [mobile browser connection](/docs/remote-access)
today.
