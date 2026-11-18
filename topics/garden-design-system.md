# Studio Workbench design system (Garden evolution)

> VIBEALLDAY's client presents one responsive Studio Workbench layout across
> three cohesive skins: **Daylight** (`light`: cool neutral paper `#f6f7f9`,
> crisp `#ffffff` surfaces, studio cobalt `#2563eb` primary accent),
> **Graphite** (`dark`: deep slate `#0b0d12`, elevated `#11141c` surfaces,
> electric cobalt `#4f8cff` accent), and **Graphite · OLED** (`verydark`:
> pure-black `#000000` canvas for OLED displays). All skins share unified
> precision geometry and unified Geist + JetBrains Mono typography so switching
> themes never shifts layout metrics. State is always colour plus shape. Phones
> get a bottom tab bar on root pages; desktop keeps the sidebar.

Topic: garden-design-system

Related: [UI design](ui-design.md), [CSS architecture](css-architecture.md),
[UI testing](ui-testing.md), [vanilla defaults](vanilla-defaults.md).

## Status and scope

This fork (jiji262/vibeallday, imported from upstream v0.10.2) establishes
**Studio Workbench** (built on the `components/garden/` primitive library) as
the unified appearance across all client routes. Behavior that is not
presentation (session control, transcripts, provider contracts, URLs, REST and
WebSocket payloads) is unchanged.

Key design system invariants:

1. Every client route shares one visual language, surface hierarchy, and
   precision control scale across desktop and mobile.
2. Themes: theme ids and the `vibeallday-theme` storage key are unchanged;
   `light` = Daylight (浅色), `dark` = Graphite (深色),
   `verydark` = Graphite · OLED (纯黑 OLED), `auto` (default) = System
   (跟随系统: Daylight under a light OS, Graphite under a dark one).
3. Fonts: all skins share self-hosted `VIBEALLDAY Geist` for UI/titles
   (`--display-stretch: 100%`) and `VIBEALLDAY JetBrains Mono` for code, paths,
   hashes, counters, and telemetry. CJK falls back to PingFang SC / Noto Sans SC
   / system fonts. An explicit font setting in Appearance still overrides the
   default.
4. The phone shell (`width < 768px` or a coarse pointer, below 1100 px) has a
   frosted bottom tab bar on root pages only; desktop keeps the sidebar.
5. New copy is added to `en.json` and `zh-CN.json`.

## Tokens

All tokens live in `packages/client/src/styles/theme.css`, the single global
source of truth for design values. Design names (`--canvas`, `--surface`,
`--ink`, `--accent`, `--attn`, `--r-*`, `--fs-*`, ...) hold each skin's
values; existing token names (`--bg-surface`, `--text-primary`,
`--border-color`, `--primary-color`, `--indigo`, `--rose`, ...) alias them, so
untouched components recolor without edits. New components use the design
names directly. Skins map to theme ids: `:root` is Daylight, `[data-theme="dark"]`
and `[data-theme="verydark"]` share Graphite, `verydark` then overrides surfaces
to pure black, and `auto` under a dark OS repeats Graphite. `data-theme` sits on
`<html>`; a nested `data-theme` subtree re-scopes the skin tokens for side-by-side
skin previews in Appearance.

### Palette (Daylight / Graphite)

| Role | Token | Daylight | Graphite |
|---|---|---|---|
| Page | `--canvas` (`--bg-surface`) | `#F6F7F9` | `#0B0D12` |
| Card, sheet | `--surface` (`--bg-card`, `--bg-secondary`) | `#FFFFFF` | `#11141C` |
| Sunken, table heads | `--surface-2` (`--bg-sunken`) | `#F0F2F6` | `#161A24` |
| Hover, track | `--surface-3` (`--bg-tertiary`) | `#E6E9F0` | `#1D2330` |
| Sidebar | `--side-bg` | `#F1F3F7` | `#0E1117` |
| Ink | `--ink` (`--text-primary`) | `#0F172A` | `#EDF2FA` |
| Ink 2 | `--ink-2` (`--text-secondary`) | `#334155` | `#B4BFCE` |
| Ink 3 (meta) | `--ink-3` (`--text-muted`) | `#5B677A` | `#8A96A8` |
| Ink 4 (placeholder only) | `--ink-4` (`--text-dimmed`) | `#8B96A8` | `#5C6778` |
| Hairline | `--line` (`--border-color`) | `#E2E6EE` | `#222836` |
| Strong line | `--line-strong` (`--border-input`, `--dash`) | `#CBD2DF` | `#30394B` |
| Accent (primary, selected, focus) | `--accent` / `--accent-ink` | `#2563EB` / `#1D4ED8` | `#4F8CFF` / `#7AABFF` |
| Link | `--link` | `#1D4ED8` | `#7AABFF` |
| Needs you | `--attn` / `--attn-ink` | `#D97706` / `#9A5200` | `#F59E0B` / `#FBBF24` |
| Running | `--run` / `--run-ink` | `#0284C7` / `#0369A1` | `#38BDF8` / `#7DD3FC` |
| Ok / Healthy | `--ok` / `--ok-ink` | `#059669` / `#047857` | `#34D399` / `#6EE7B7` |
| Error, destructive | `--err` / `--err-ink` | `#DC2626` / `#B91C1C` | `#F87171` / `#FCA5A5` |
| Idle | `--idle` | `#8B96A8` | `#7D899B` |

Each family has a `-soft` fill used behind its `-ink` text, most have a
`-line`, and filled controls take `--on-accent`, `--on-attn` or `--on-err`
text. Component tokens (`--switch-*`, `--seg-*`, `--nav-on-*`, `--tabbar-bg`,
`--phead-*`, `--toast-*`, `--ask-*`, `--user-bubble*`, `--code-bg`, `--scrim`)
carry the per-skin details. `verydark` keeps Graphite's ink and accents over
pure-black surfaces (`#000000` page and sidebar, `#090B10` card).

Semantic map, used everywhere a state is shown, always colour plus shape
(`StatusDot` / `Status`): attn = needs you (filled circle); run = running
(circle with a halo that pulses only while its row is in view); idle =
idle/stopped (hollow ring); err = error; queued = queued (dashed ring);
ok = done (check). Providers take per-skin hues in `provider-colors.css`; every
provider color keeps >= 4.5:1 against its skin's page.

### Shape, depth, spacing

- Unified precision geometry across all skins: `--r-btn: 8px`, `--r-chip: 999px`,
  `--r-seg: 9px`, `--r-input: 8px`, `--r-card: 12px`, `--r-sheet: 16px`,
  `--r-dialog: 14px`, `--r-bubble: 12px`, `--r-composer: 14px`,
  `--r-send: 9px`, `--r-icon-btn: 8px`, `--r-toast: 10px`.
- Unified desktop control heights across all skins: `--btn-h: 34px` (`sm` 28 px,
  `lg` 40 px), `--icon-btn: 32px`, `--input-h: 36px`, `--chip-h: 26px`,
  `--seg-h: 32px`, `--row-h: 44px`, `--pad-card: 16px`. Below 768 px one
  `@media (width < 768px)` block raises interactive targets for every skin
  (44 px buttons and icon buttons, 48 px inputs with 16 px text).
- Depth: `--shadow-card`, `--shadow-pop` (menus, dialogs, sheets) and
  `--shadow-composer`, paired with frosted translucent topbars (`--phead-bg` +
  `backdrop-filter`).
- Spacing is a 4 px grid: `--space-1..8` = 4/8/12/16/20/24/32/40 px.
- Touch: `--tap-min: 44px`; every phone control meets it.
- Layering: `--z-tabbar` (40) sits under the drawer (101); `--z-sheet` and
  `--z-menu` match the modal layer (9999+) for new code.

## Typography

- `--font-ui`: `VIBEALLDAY Geist` across all skins, then PingFang SC / Noto
  Sans SC / system. All controls, titles and body copy. `--font-display` and
  `--font-brand` equal `--font-ui`, with `--title-weight: 600`,
  `--display-stretch: 100%`, and `-0.02em` display tracking.
- `--font-mono`: `VIBEALLDAY JetBrains Mono` across all skins. Code, paths,
  ids, hashes, branch names, timestamps, counters, and metadata badges.
- Assistant prose keeps its own Output Typography font (Geist by default).
  Choosing a UI or code font in Appearance sets `--font-ui` / `--font-mono`
  inline on `<html>` and wins over the skin.
- Chrome sizes come from the unified `--fs-display|h1|h2|h3|body|small|meta|
  btn|input|code` scale (`14px` body, `13px` small, `12px` meta). Apply
  `--fs-*` to chrome only; transcript and prose keep their Output Typography
  sizes. Phones raise body text (`--fs-body-phone: 15px`) and use 16 px inputs
  (prevents iOS focus zoom).
- The Garden Console label recipe still exists for mono UPPERCASE eyebrows
  and table heads (`--label-font`, `--eyebrow-size`, `--eyebrow-tracking`);
  eyebrows and meta appear only when they carry information (context, counts,
  scope). CJK strings get minimal tracking.

## Shell and navigation

- The phone shell applies below 1100 px when the window is under 768 px wide
  or the pointer is coarse; a narrow fine-pointer desktop window (768-1099 px)
  keeps the drawer only. In the phone shell a bottom tab bar (`MobileTabBar`)
  shows only on the root pages `/inbox`, `/sessions`, `/projects` and `/more`,
  with four destinations: **Sessions** (Inbox, All and Triage), **New** (the
  centre accent button), **Projects**, **More** (`/more`). Badges: Sessions
  shows the needs-you count on an attn fill.
- Pages with a back link show no tab bar. Session details, although their URL
  is nested under Projects, replace the drawer launcher with a back link to
  the current project's session list; it remains usable with the keyboard
  open and on direct entry, without depending on browser history. Other deep
  phone pages show the drawer launcher instead. The tab bar also hides inside
  a full-screen project app, the file viewer, and while the software keyboard
  takes space: a visual-viewport inset (iOS) or, with a text field focused, a
  layout viewport at least 120 px shorter than its keyboard-free height
  (Android). Focus alone never hides it, because tab-bar routes have no other
  way out: their page header drops its drawer launcher. Closing the keyboard
  restores the bar without losing the composer draft. Narrow fine-pointer
  desktop windows retain their drawer launcher, including inside sessions.
  `more` is a direct app route segment, never a relay username.
- A session's App full view owns the viewport; Back or Escape leaves it. A
  parked session retaining its full-view state never conceals navigation on
  the foreground route; returning to that session restores its full view
  without replacing the App frame.
- More shows a host card (connection status, Switch host), then Work (Source
  control), Tools (Agents, Issues, Bang commands, Devices) and System
  (Settings and a This-browser skin picker), each gated by the same
  capabilities as the sidebar. A switched superuser also gets "Stop acting as
  {username}", the sidebar's way back, since tab-bar routes cannot reach the
  drawer.
- `>= 1100 px`: persistent sidebar on `--side-bg`: brand block, host card,
  New session and search (⌘K), the navigation groups, pending queue and recent
  sessions, then a footer with Settings and the skin menu. The active item
  takes the skin's `--nav-on-*` treatment: a raised pill in Celadon, an inset
  lime bar in Night. Desktop `/settings*` replaces the app sidebar with the
  settings rail, which leads with a Back-to-app link.
- Page header: optional mono context label, title in the UI font, trailing
  actions as icon buttons (44 px on touch). Detail pages show a back chevron
  instead of the drawer button. Below 768 px the sticky phone header carries
  the page title, so the page's own `PageIntro` h1 is visually hidden there
  (it stays in the accessibility tree).
- `/`, a relay host root and the post-login default all land on `/inbox`
  (Inbox); an explicit return target still wins. Desktop and phone share one
  Sessions destination with **Inbox / All** secondary navigation;
  [session workbench](https://github.com/jiji262/vibeallday/blob/e64c8b4ffb737da273152d02280fb69a2cddfc88/topics/session-workbench.md) owns the view behavior.

## Components

Shared primitives live in `packages/client/src/components/garden/` with
co-located CSS Modules (barrel: `components/garden/index.ts`):

- `Button` (`primary | secondary | ghost | danger | danger-soft | attn |
  link`, `sm | md | lg`, optional `loading`; heights from `--btn-h*`, radius
  from `--r-btn`; danger is filled err, danger-soft is the default for
  destructive actions and filled danger is kept for the final confirmation;
  disabled is a muted fill, not opacity; 44 px on touch). A main area carries
  at most one primary button per screen.
- `IconButton` (`--icon-btn`, `sm` smaller, 44 px on touch; accessible label
  required) and `SplitButton` (primary action plus an attached menu).
- `Status` / `StatusDot` (the six session states as colour plus shape, see
  the semantic map), `Badge` (state pill, tone = attn, run, err, ok, accent,
  idle plus `outline`; the older mint/rose/peach/sand/indigo/grey tones map
  onto them; `Pill` is a legacy alias), `Tag` (mono event chip), `Count`
  (mono count capsule), `ScopeTag` (本机 / 服务器: stored in this browser or on
  the server) and `ProviderMark`.
- `Segmented` (radio group on the `--seg-*` track), `Switch` (native checkbox
  with `role="switch"`, `--sw-w` x `--sw-h`), `Menu`/`MenuItem`, and `Field`.
- `Card` with `CardHeader` (title in the UI font, mono meta, rule),
  `CardBody`, `CardFooter`, `CardBand`; `tone="danger"` and `dashed`
  variants.
- `Table`/`Th`/`Tr`/`Td`/`TableEmpty`/`RowAction` and `DataList` rows for
  lists: sunken mono header, row rules, stacked rows on phones.
- `MetaGrid`/`MetaField`/`MetaDivider`/`BigNumber`, `StatCard`/`StatGrid`,
  `Eyebrow`, `Kbd`, `CopyChip`, `Notice`, `Tabs`, `Breadcrumb`, and the
  line-icon set in `icons.tsx`.
- `Spinner` (the one spinner), `Skeleton`/`SkeletonText`, `LoadingState`
  (`list | table | cards | compact | page`), `EmptyState` (dashed tile;
  `compact` inside cards), `ErrorState`.
- `SearchField` and `inputClassName`/`selectClassName` (`--input-h` fields,
  accent focus ring, 16 px text on phones), and `ListToolbar` (list-page bar:
  search, filters, mono count, trailing actions).
- `Sheet` (bottom sheet on phones, centered dialog on desktop; drag handle,
  safe-area padding, `max-height: 90dvh`, focus trap, Escape/back closes).
- `ActionSheet` (menu rendered as a sheet on phones, popover anchored to its
  trigger on desktop; items may carry a `section` label and a danger tone).
- `SectionHeader` (title + count + trailing action).

Native checkboxes and radios only follow the accent colour; there is no custom
checkbox primitive yet.

`ui/Modal` keeps its API and becomes a bottom sheet below 600 px. Viewer modals (files,
diffs) stay edge to edge on phones; ordinary prompts and forms pass
`variant="dialog"` and get a padded, content-sized bottom sheet there.

## Pages (phone)

- **Sessions / Inbox**: status blocks (needs you, running, unread, queued) and
  a project filter above Needs you, Running and Recently participated cards.
  The status blocks are in-page filter toggles; the filtered unread or queued
  section then offers **View all unread** (the complete filtered All view) or
  **Manage queue**. No large all-clear headline. Old pending asks stay
  visible. **Triage** walks the needs-you sessions one at a time and answers
  approvals and one-tap questions on the card, from a bottom decision bar on
  phones. Partial catalog discovery is explicit. See [session workbench](https://github.com/jiji262/vibeallday/blob/e64c8b4ffb737da273152d02280fb69a2cddfc88/topics/session-workbench.md).
- **Sessions / All**: sticky search field, quick chips (Unread, Needs you,
  Running; the last two set `activity`), a Filters button opening a sheet that
  also holds Starred and Archived, and existing bulk controls. Advanced
  search options stay in the sheet. Rows share the existing session card.
- **Projects**: cards with the project name, quiet code-name chip, one-line
  caption, mono path, footer pills (running / needs you / queued) and time;
  a single overflow menu holds App, Copy, Settings, Remove; New session is a
  44 px button. A card opens the project home page (`/projects/:projectId`).
  Add project opens a sheet.
- **Session**: compact two-line header (title; mono project · model · state)
  plus overflow; one status strip at most; transcript with tinted user
  bubbles and quiet tool rows; composer dock (rounded card, 1-row
  auto-growing textarea). The composer row keeps only attachments, permission
  mode, model/thinking, the context ring, microphone/waveform, status and
  send/stop; every other shown tool sits in the **+** tray unless its toolbar
  presence is **Show always** (pinned tools stay in the row and have no tray
  copy). Approvals and questions open above the dock while the composer
  collapses. On desktop the session inspector (Changes / Plan / Context /
  Subagents) is docked open by default wherever its column fits; its open
  state and tab are client-local preferences.
- **New session**: prompt first; provider, model/thinking and permission
  mode are chips (permission mode is a dropdown chip, not a segmented
  control); the project chooser is a full-width row under the composer at
  every width. Start is a split action
  whose **More ways to start** menu holds Queue for project. Advanced options
  live in a sheet. Its toolbar keeps the measured More (`...`) narrowing
  order for the `first` / `mid` / `last` tiers.
- **Settings**: host card on top, quick theme and text-size controls, then six
  groups (Agents & models, Look & feel, Notifications & devices, Access &
  security, Projects & integrations, Data & about) and Advanced & debug last
  (folded into one entry row on phones); on desktop the index is an overview
  of category cards with status lines. The category-to-group map lives in
  [settings placement](https://github.com/jiji262/vibeallday/blob/e64c8b4ffb737da273152d02280fb69a2cddfc88/topics/settings-ui-placement.md#settings-home-host-quick-controls-groups).
  Rows carry a 本机 / 服务器 scope tag. Changes apply immediately; the first
  change that makes a pane undoable shows a toast (`Changed {page}` with
  **Undo**) beside the header Undo button. Controls share one vocabulary:
  primary = accent filled, secondary = card with a strong line (the default
  `.settings-button`), danger = err; 44 px on touch.
- **Sign-in and host picker**: shared shell (`components/auth/AuthShell`): a
  brand column beside one form card, stacking into one column when narrow,
  with full-width primary actions and quiet links for secondary options.
  Saved hosts are rows with a status dot, an explicit Connect button and an
  always-visible remove button. The reconnect-failure sheet opens over the
  same shell and offers Switch host. While the transport is down, a labelled
  connection bar (`role="status"`, Retry now) overlays the top of the page.

## Removed or demoted

- Removed: `/activity` (ActivityPage), `/-/hosts` (HostsPage placeholder),
  `RemoteLoginModePage`.
- Demoted to More: Agents, Issues, Bang commands, Source control, Devices,
  Switch host, each under the same capability gate as its old sidebar link.
  Workstreams keeps its per-project URL and, as before, has no navigation
  entry.
- Hidden on session rows: turn counts, created age, executor, context
  percentage (still in the session's details). Project card controls move into
  one overflow menu.

## Engineering contracts

- CSS: new styles in CSS Modules; `theme.css` is the reviewed global token
  file; legacy stylesheets only shrink (`pnpm css:check --record`).
- Class names that tests and generated markup rely on stay on their elements
  (`.session-header`, `.message-list`, `.session-messages`,
  `.message-input-wrapper`, `.send-button`, `.stop-button`, `.tool-row*`,
  `.session-list-item*`, diff/Shiki vocabulary). New design classes are added
  beside them.
- Composer typing stays isolated from transcript rendering
  ([065](https://github.com/jiji262/vibeallday/blob/e64c8b4ffb737da273152d02280fb69a2cddfc88/docs/tactical/065-session-composer-input-latency.md)); no
  keystroke may be dropped or take more than 100 ms to appear.
- Reduced motion is respected; animations are 120-200 ms and only answer user
  actions.
- Verification: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`,
  `pnpm test`, focused browser specs for touched surfaces, and desktop
  (1000x600) plus phone (375x812) captures of every redesigned page.
