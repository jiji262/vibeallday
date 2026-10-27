# Unified session workbench implementation plan

> Execute serially with `superpowers:executing-plans` in the isolated
> `codex/session-workbench` worktree, based on 8b079b9. The owner approved the
> design in the 2026-10-26 conversation and requires the latest mobile behavior.

**Goal:** One Sessions navigation destination, with Overview and All views,
and a small sidebar shortcut list instead of a time-window navigation concept.

**Spec:** The approved conversation, `topics/inbox.md`,
`topics/sidebar-session-ordering.md`, and `topics/garden-design-system.md`.

**Architecture:** Preserve `/inbox` for Overview and `/sessions` for All, and
join them with one shared secondary navigation component. Keeping both URLs
preserves existing bookmarks, lazy-loading boundaries, relay routes and the
new mobile project-return behavior. Reuse the global retained catalog for
complete attention/unread discovery, existing Inbox queue/review rendering,
the shared session rows and interaction-hold hook. No backend API changes.

**Tech stack:** React 19, React Router, CSS Modules/Garden tokens, Vitest,
Playwright, existing retained client summary store.

## Existing context

- `gaps/all-sessions-search-index.md`: preserve existing bounded content
  search; this change does not add an index or new search protocol.
- `gaps/mobile-history-search-loses-typed-prefix.md`: navigation changes do
  not relax sequential typing or draft-preservation checks.
- `gaps/sketches/sidebar-manual-categories.md`: retain categories and their
  existing ownership; do not implement the unapproved category-management sketch.

## Constraints

- Keep mobile session back links, recent switching, keyboard behavior,
  pointer breakpoints, draft retention and parked session ownership unchanged.
- No schema, dependency, root configuration, persistence or provider changes.
- Pending approvals/questions and unacknowledged inter-session messages have
  no age cutoff. Unread is independent of pending attention.
- Recent ordering uses max(browser submission, lastHumanTurnAt, createdAt),
  never background updatedAt. Hold row identity/order during interaction.
- Preserve future-session queue entries, failed queue items, review outcomes,
  favorites, categories, external sessions and all-search/bulk capabilities.
- Partial catalog discovery must remain visibly partial, including counts.
- New copy uses English i18n keys per DEVELOPMENT's client guide; existing
  translated keys are reused when their meaning matches.

### 1 — consolidate navigation without changing mobile detail behavior

- [x] Add a `SessionViews` component linking Overview (`/inbox`) and All
  (`/sessions`), preserving the project filter and relay base path.
- [x] Replace the two sidebar destinations with one Sessions destination,
  active for either view; reduce the mobile bar to four equal destinations.
- [x] Retain existing route modules and detail back URLs. Update the phone
  navigation helper to choose All when opening arbitrary historical sessions.

### 2 — build a complete, stable overview

- [x] Add a failing pure-model test with old pending/queued/unread sessions,
  hidden automation, more than twenty pending rows and user chronology.
  Run `pnpm --filter @vibeallday/client test src/lib/__tests__/sessionOverview.test.ts`.
- [x] Implement pure projection and a source-scoped hook over
  `useGlobalSessionsFeed`, using the shared serial page drain for both Overview and All. Reuse the
  same user timestamp helper in sidebar ordering and overview ordering.
- [x] Connect global Inbox rendering through an optional overview mode.
  Preserve its queue/review paths and existing project Inbox behavior.
  Render attention, running and recently participated groups once each.
- [x] Show compact attention/running/unread controls. Unread opens the full
  all-session unread filter, including hidden automation; no unread time cutoff.
- [x] Hold identities using `useHeldSidebarLists` while allowing live row data.

### 3 — turn sidebar recency into a bounded shortcut

- [x] Select eight ordinary sessions by user chronology across ages, after
  existing duplicate protections. Keep a current ordinary session reachable.
- [x] Retain independent favorites/categories/user sections and a visible
  more link. Keep legacy section storage keys compatible.
- [x] Update owning topic contracts and record implementation/verification
  state here; do not edit `docs/log.md`.

### 4 — verify the interaction and review the change

- [x] Run focused model, Inbox, sidebar and NavigationLayout unit coverage.
- [x] Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
  `pnpm console:scan`, and `pnpm css:touched`.
- [x] Run focused browser cases for overview/all, phone detail navigation,
  keyboard behavior, sidebar ordering and real sequential search typing with
  concurrent updates (each key <=100ms, no drops).
- [x] Capture and inspect desktop 1000x600 and phone 375x812 using the
  repository artifact facility on an isolated browser fixture.
- [x] Request independent read-only review, repair actionable findings and
  rerun affected checks. Leave the branch reviewable; no merge or push.

## Verification evidence

- Base 8b079b9 remained the clean main checkout throughout implementation.
- Focused baseline: 41 tests passed before source changes. Model and explicit
  project-scope regressions were observed failing before their implementation.
- Final browser run: desktop and phone three-page/1030-record scenarios and
  latest mobile header/keyboard/navigation behavior passed (3 cases,
  47.8 seconds). Fifteen real keys overlapped live transcript updates; the
  maximum key-to-frame acknowledgement was 10.5ms, with no dropped characters.
- The retained 1000-row All search test passed with 25 real keys and maximum
  73.7ms acknowledgement. Safe-area and sidebar chronology cases also passed.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm console:scan`,
  `pnpm css:check`, `pnpm css:lint` and `pnpm css:touched` passed. The touched-CSS
  report defers coupled legacy shell/list vocabulary; new styling is modular.
- An independent read-only review found and verified repairs for cutoff target
  stability, failed queue classification, duplicate representative scope and
  three-page pagination. The latest review reported no remaining findings.
- Final desktop/phone captures were individually inspected and presented via
  `writeCapturePreview`/`emitCapturePreview`. The project-visible copies are
  `.artifacts/ui-testing/session-workbench-20261026-1245/` in the main checkout.
- The first broad test attempt overlapped other verification and timed out in
  eight server cases; all 56 tests in those files passed when rerun serially.
  The complete final command is `npm_config_workspace_concurrency=1 pnpm test`;
  it passed all 7100 client, 976 shared, 139 relay and 45 push-broker tests.
  The server reported 6637 passed and one fake-Codex-message timeout; the
  affected provider file then passed all 138 enabled tests in isolation.
  `gaps/codex-fake-interrupt-batch-message-timeout.md` records that remaining
  batch-sensitivity limit. Do not describe the full command as green.

- Additional browser checks passed for draft ownership, delivered cross-session
  messages at desktop/phone widths, sidebar density and project App
  full-view/parked-frame/draft preservation (five cases). Old destination
  assertions were updated to `/inbox`. The final App case passed in 14.9s.
- The owner subsequently authorized committing and pushing to main, followed by
  the Oracle static-client deployment. This publishes the verified client only;
  no dependency/configuration/schema change or session-server restart is needed.
