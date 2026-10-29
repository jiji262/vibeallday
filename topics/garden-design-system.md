# Garden design system

> VIBEALLDAY's client presents one mobile-first design language, "Garden": warm paper
> surfaces, inky indigo for action, four semantic accents, Fraunces display
> type over Geist UI text, and JetBrains Mono for machine strings. Phones get a
> thumb-reachable tab bar; desktop keeps the sidebar.

Topic: garden-design-system

Related: [UI design](ui-design.md), [CSS architecture](css-architecture.md),
[UI testing](ui-testing.md), [vanilla defaults](vanilla-defaults.md).

## Status and scope

This fork (jiji262/vibeallday, imported from upstream v0.10.2) replaces the
previous grey utility look with Garden as the only appearance. It is a
deliberate, owner-approved exception to the vanilla-defaults rule: the
redesign is the default and there is no "classic" toggle. Behavior that is not
presentation (session control, transcripts, provider contracts, URLs, REST and
WebSocket payloads) is unchanged.

Decisions recorded 2026-10-24:

1. Upstream is no longer tracked closely; page structure may be rewritten.
2. Depth: tokens restyle every surface; the core phone flow (shell, Now/Inbox,
   Sessions, Projects, Session, New session, Settings, sign-in) gets layout
   redesign; secondary surfaces (source control, files, agents, issues,
   devices, bang commands, workstreams, share pages) get Garden styling and
   phone fixes.
3. Themes: `light` = Garden Paper, `dark` = Garden Night, `verydark` = Garden
   OLED, `auto` (default) follows the OS.
4. Fonts: Fraunces (display), Geist (UI and prose), JetBrains Mono (code and
   machine labels) are self-hosted latin subsets; CJK falls back to system
   fonts. The existing font settings remain available.
5. Phones (< 1100 px) use a bottom tab bar; desktop keeps the sidebar.
6. Garden replaces the old look outright.
7. New copy is added to `en.json` and `zh-CN.json`.

## Tokens

All tokens live in `packages/client/src/styles/theme.css`, the single global
source of truth for design values. Existing token names (`--bg-surface`,
`--text-primary`, `--border-color`, `--primary-color`, ...) keep their meaning
and take Garden values, so untouched components recolor without edits. New
components use the Garden names directly.

### Garden palette (light / dark)

| Role | Token | Paper | Night |
|---|---|---|---|
| Page | `--bg-surface` | `#FBF8F2` | `#14131A` |
| Sunken (sidebar, tab bar, table heads) | `--bg-sunken` | `#F7F2E5` | `#1A1922` |
| Card, input, sheet | `--bg-secondary`, `--bg-card` | `#FFFFFF` | `#1E1D27` |
| Soft fill (chips, hover) | `--bg-tertiary` | `#F4EFE0` | `#26242F` |
| Ink | `--text-primary` | `#1F2433` | `#F1EDE4` |
| Ink 2 | `--text-secondary` | `#3D4459` | `#D2CDC1` |
| Ink 3 (meta) | `--text-muted` | `#5A6377` | `#A29EAE` |
| Ink 4 (placeholder) | `--text-dimmed` | `#8A92A4` | `#7A7789` |
| Hairline | `--border-color` | `#E8E2D2` | `#2E2C39` |
| Strong line | `--border-input`, `--line-strong` | `#D5CDB7` | `#3D3A4B` |
| Dashed divider | `--dash` | `#D9D2BF` | `#363344` |
| Indigo (primary, links, focus) | `--indigo`, `--primary-color` | `#4F46B8` | `#8B83F0` |
| Rose (needs you, danger) | `--rose` / `--rose-ink` | `#E37A88` / `#B85067` | `#EE8E9B` / `#F4A7B1` |
| Mint (running, ok) | `--mint` / `--mint-ink` | `#84C5A8` / `#3F8868` | `#7FCBA9` / `#8EDBB9` |
| Peach (attention, Claude) | `--peach` / `--peach-ink` | `#D97751` / `#A04E2A` | `#E8895F` / `#F2A27E` |
| Sand (pending, unread) | `--sand` / `--sand-ink` | `#D9A441` / `#8E6C1F` | `#E0B04F` / `#EBC673` |

Each accent has a `-soft` translucent fill (8-18% alpha) used behind its
`-ink` text. The Garden Console (license-hub) names `--bg-2`, `--bg-soft`,
`--card`, `--ink`, `--ink-2..4`, `--line`, `--line-strong` and `--dash` alias
the semantic tokens, so they follow every theme; label recipes
(`--label-font`, `--eyebrow-size`, `--eyebrow-tracking`, `--meta-tracking`,
`--badge-tracking`) and page-frame tokens (`--topbar-height`,
`--page-max-width`, `--page-gutter`, `--z-topbar`, `--overlay-scrim`) sit
beside them. `verydark` keeps Night's ink and accents over near-black surfaces
(`#0B0A0F` page, `#15141B` card).

Semantic map, used everywhere a state is shown: mint = running/connected/ok;
rose = needs you/error/destructive; peach = attention/warning; sand =
pending/unread/queued; indigo = primary/selected/info; grey (ink 3 on a 16%
ink-4 fill) = idle/stopped; dashed border on soft fill = archived/inert.
Providers: Claude = peach, Codex = mint, Gemini = indigo, others take
Garden-tuned hues; every provider color keeps >= 4.5:1 against the page.

### Shape, depth, spacing

- Radii: `--radius-xs 4`, `--radius-sm 6`, `--radius-md 8` (buttons, inputs,
  menus), `--radius-lg 12` (cards, tiles), `--radius-xl 16` (sheets, docks),
  `--radius-pill 999`.
- Shadows are paper edges, not floating cards: `--shadow-xs` (1px warm
  edge), `--shadow-sm`, `--shadow-md` (menus, dialogs), `--shadow-lg`
  (sheets, drawer).
- Spacing is a 4 px grid: `--space-1..8` = 4/8/12/16/20/24/32/40 px.
- Touch: `--tap-min: 44px`; every phone control meets it.
- Layering: `--z-tabbar` (40) sits under the drawer (101); `--z-sheet` and
  `--z-menu` match the modal layer (9999+) for new code.

## Typography

- `--font-display`: Fraunces (opsz axis) then Songti/Noto Serif CJK. Used for
  page titles, card titles, row titles of projects and sessions, and large
  counts. Never for controls or running text.
- `--font-ui` / `--font-sans`: Geist then PingFang SC / system. All controls,
  body copy and assistant prose.
- `--font-mono`: JetBrains Mono. Code, paths, ids, hashes, branch names,
  timestamps, counters, and small metadata labels.
- Labels follow the Garden Console recipe: mono UPPERCASE with tracking for
  eyebrows (11 px, 0.08em), table and list headers (11 px/500, 0.08em), card
  meta (11 px, 0.06em); badges are mono 12 px/500 at 0.02em and keep their
  case. Eyebrows and meta appear only when they carry information (context,
  counts, scope). CJK strings get minimal tracking.
- Phone sizes: page header title 21 px (19 px from 600 px up, since the
  compact sticky header leaves room for its actions), display moments such as
  the Now sentence and the sign-in title 24-28 px, card/row title 16-17 px,
  body 15 px, prose 16 px, inputs 16 px (prevents iOS focus zoom), metadata
  12 px.

## Shell and navigation

- Phones (`< 768 px`) and touch devices below 1100 px: a bottom tab bar
  (`MobileTabBar`) with four destinations: **Sessions** (Overview at the inbox,
  landing route), **New** (primary), **Projects**, **More**
  (`/more`). A narrow desktop window keeps the drawer only. Badges: Sessions shows
  the needs-you count in rose. Session details retain the tab bar with
  **Sessions** selected, even though their URL is nested under Projects.
  Their header replaces the drawer launcher with a back link to the current
  project's session list; this remains usable with the keyboard open and on
  direct entry, without depending on browser history. The tab bar hides inside
  a full-screen project app, the file viewer, and while the software keyboard
  takes space: a visual-viewport inset (iOS) or, with a text field focused, a layout viewport
  at least 120 px shorter than its keyboard-free height (Android). Focus
  alone never hides it, because tab-bar routes have no other way out: their
  page header drops its drawer launcher. Closing the keyboard restores the bar
  without losing the composer draft. Narrow fine-pointer desktop windows retain
  their drawer launcher, including inside sessions. `more` is a direct app route
  segment, never a relay username.
- A session's App full view conceals the tab bar and owns its viewport space.
  Back or Escape restores the bar. A parked session retaining its full-view
  state never conceals navigation on the foreground route; returning to that
  session restores its full view without replacing the App frame.
- More lists Settings, Agents, Source control, Issues, Bang commands,
  Devices, and Switch host, each gated by the same capabilities as before. A
  switched superuser also gets "Stop acting as {username}", the sidebar's way
  back, since tab-bar routes cannot reach the drawer.
- `>= 1100 px`: persistent sidebar on the sunken surface, brand block on top,
  active item = card fill + 3 px indigo bar.
- Page header: optional mono context label, Fraunces title, trailing actions
  as 44 px icon buttons. Detail pages show a back chevron instead of the
  drawer button.
- `/`, a relay host root and the post-login default all land on `/inbox`
  (Sessions Overview); an explicit return target still wins. Desktop and phone
  share one Sessions destination with **Overview / All** secondary navigation;
  [session workbench](session-workbench.md) owns the view behavior.

## Components

Shared primitives live in `packages/client/src/components/garden/` with
co-located CSS Modules (barrel: `components/garden/index.ts`):

- `Button` (`primary | secondary | ghost | danger | danger-soft | link`,
  `sm | md | lg`, optional `loading`; danger is filled rose; disabled is a
  muted fill, not opacity; sm/md are 44 px on touch).
- `IconButton` (36 px, `sm` 28 px, 44 px on touch; accessible label required).
- `Badge` (state pill, mono, tone = semantic map plus `outline`; `Pill` is a
  legacy alias) and `Tag` (UPPERCASE event chip).
- `Card` with `CardHeader` (serif title, mono meta, dashed rule), `CardBody`,
  `CardFooter`, `CardBand`; `tone="danger"` and `dashed` variants.
- `Table`/`Th`/`Tr`/`Td`/`TableEmpty`/`RowAction` and `DataList` rows for
  lists: sunken mono header, dashed row rules, stacked rows on phones.
- `MetaGrid`/`MetaField`/`MetaDivider`/`BigNumber`, `StatCard`/`StatGrid`,
  `Eyebrow`, `Kbd`, `CopyChip`, `Notice`, `Tabs`, `Breadcrumb`, and the
  line-icon set in `icons.tsx`.
- `Spinner` (the one spinner), `Skeleton`/`SkeletonText`, `LoadingState`
  (`list | table | cards | compact | page`), `EmptyState` (dashed tile;
  `compact` inside cards), `ErrorState`.
- `SearchField` and `inputClassName`/`selectClassName` (40 px fields, indigo
  focus ring, 16 px text on phones), and `ListToolbar` (list-page bar: search,
  filters, mono count, trailing actions).
- `Sheet` (bottom sheet on phones, centered dialog on desktop; drag handle,
  safe-area padding, `max-height: 90dvh`, focus trap, Escape/back closes).
- `ActionSheet` (menu rendered as a sheet on touch, popover on desktop; items
  may carry a `section` label and a danger tone).
- `SectionHeader` (title + count + trailing action).

`ui/Modal` keeps its API and becomes a bottom sheet below 600 px. Viewer modals (files,
diffs) stay edge to edge on phones; ordinary prompts and forms pass
`variant="dialog"` and get a padded, content-sized bottom sheet there.

## Pages (phone)

- **Sessions / Overview**: compact attention/running/unread controls and project
  filter above Needs you, Running and Recently participated cards. No large
  all-clear headline or separate unread section. Old pending asks stay visible;
  the unread shortcut opens the complete filtered All view. Partial catalog
  discovery is explicit. See [session workbench](session-workbench.md).
- **Sessions / All**: sticky search field, a Filters button opening a sheet,
  quick chips (Unread, Starred, Archived) and existing bulk controls. Advanced
  search options stay in the sheet. Rows share the existing session card.
- **Projects**: cards with Fraunces name, quiet code-name chip, one-line
  caption, mono path, footer pills (running / needs you / queued) and time;
  a single overflow menu holds App, Copy, Settings, Remove; New session is a
  44 px button. Add project opens a sheet.
- **Session**: compact two-line header (title; mono project · model · state)
  plus overflow; one status strip at most; transcript with indigo-tinted user
  bubbles and quiet tool rows; composer dock (rounded card, 1-row auto-growing
  textarea, attach on the left, circular primary send/stop on the right, chips
  row for mode / effort / context). Approvals and questions appear as sheets
  above the dock with large Allow / Deny targets.
- **New session**: context chips (Project, Agent, Model) opening sheets; a
  permission segmented control; the composer with a labeled Start button.
  Advanced options live in a sheet.
- **Settings**: host card on top, quick theme and text-size controls, then six
  groups (Agents & models, Look & feel, Notifications & devices, Access &
  security, Projects & integrations, Data & about) and Advanced & debug last;
  the category-to-group map lives in
  [settings placement](settings-ui-placement.md#settings-home-host-quick-controls-groups).
  Controls share one vocabulary: primary = indigo filled, secondary = card with
  a strong line (the default `.settings-button`), danger = rose; 44 px on touch.
- **Sign-in and host picker**: shared paper shell (`components/auth/AuthShell`)
  with the gradient logo tile, Fraunces title, 48 px fields and a full-width
  primary action; quiet links for secondary options. Saved hosts are rows with
  a status dot and an always-visible remove button. The reconnect-failure
  sheet opens over the same shell.

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
  ([065](../docs/tactical/065-session-composer-input-latency.md)); no
  keystroke may be dropped or take more than 100 ms to appear.
- Reduced motion is respected; animations are 120-200 ms and only answer user
  actions.
- Verification: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`,
  `pnpm test`, focused browser specs for touched surfaces, and desktop
  (1000x600) plus phone (375x812) captures of every redesigned page.
