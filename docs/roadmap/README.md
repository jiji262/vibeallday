# Roadmap

This fork focuses on a local server and a responsive browser client shared by
computers, phones and tablets. Native Android/iOS applications, desktop shells,
browser extensions, device streaming and native push delivery are retired from
the active product and build. Their older tactical documents record historical
designs, not current release commitments.

## Current scope

- Keep `packages/server`, `packages/client`, `packages/shared` and the optional
  `packages/relay`, including local authentication and encrypted remote access.
- Preserve provider sessions, user settings, browser notifications, uploads,
  project browsing and source review in the responsive web experience.
- Keep stable capability IDs and persisted security-client records readable;
  retired platform capabilities are not advertised by the web-only server.

## Priorities

1. Keep local setup, production builds and the core test suite reproducible
   without platform SDKs, native application toolchains or extension packaging.
2. Validate desktop and phone browser flows, especially sequential typing,
   attachments, approvals and reconnect behavior under concurrent updates.
3. Maintain clear source installation, data storage and remote access guidance
   in the root [README](../../README.md).

Public or local deployment remains an explicit operator action. This scope
change does not publish a release, replace running services or migrate data.
