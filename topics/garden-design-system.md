# Garden design system

> VIBEALLDAY's client presents one mobile-first layout in two skins. Celadon
> (light): porcelain surfaces, celadon-green action, amber for "needs you",
> rounded shapes. Night (dark): blue-black surfaces, lime only on primary
> actions and focus, amber attention, compact square shapes; Night · OLED is
> its pure-black variant. State is always colour plus shape. Phones get a
> tab bar on root pages; desktop keeps the sidebar.

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
3. Themes (revised 2026-10-30, the two-skin redesign): theme ids and the
   `vibeallday-theme` storage key are unchanged; `light` = Celadon (清瓷),
   `dark` = Night (夜航), `verydark` = Night · OLED (夜航·纯黑), `auto`
   (default) = System (跟随系统: Celadon under a light OS, Night under a
   dark one).
4. Fonts (revised 2026-10-30): each skin sets its own self-hosted latin
   subsets. Celadon uses Instrument Sans with DM Mono; Night and OLED use
   Archivo (titles widen through `--display-stretch`) with IBM Plex Mono. CJK
   falls back to system fonts. An explicit font setting still overrides the
   skin's choice.
5. The phone shell (`width < 768px` or a coarse pointer, below 1100 px) has a
   bottom tab bar on root pages only; desktop keeps the sidebar.
6. The redesign replaces the old look outright.
7. New copy is added to `en.json` and `zh-CN.json`.

## Tokens

All tokens live in `packages/client/src/styles/theme.css`, the single global
source of truth for design values. Design names (`--canvas`, `--surface`,
`--ink`, `--accent`, `--attn`, `--r-*`, `--fs-*`, ...) hold each skin's
values; existing token names (`--bg-surface`, `--text-primary`,
`--border-color`, `--primary-color`, `--indigo`, `--rose`, ...) alias them, so
untouched components recolor without edits. New components use the design
names directly. Skins map to theme ids: `:root` is Celadon, `[data-theme="dark"]`
and `[data-theme="verydark"]` share Night, `verydark` then overrides surfaces
only, and `auto` under a dark OS repeats Night. `data-theme` sits on `<html>`;
a nested `data-theme` subtree re-scopes the skin tokens, which is how the
Appearance skin previews paint every skin side by side.

### Palette (Celadon / Night)

| Role | Token | Celadon | Night |
|---|---|---|---|
| Page | `--canvas` (`--bg-surface`) | `#F3F5F3` | `#0C0F14` |
| Card, sheet | `--surface` (`--bg-card`, `--bg-secondary`) | `#FFFFFF` | `#12161D` |
| Sunken, table heads | `--surface-2` (`--bg-sunken`) | `#F7F9F8` | `#181D26` |
| Hover, track | `--surface-3` (`--bg-tertiary`) | `#EDF1EE` | `#1F2530` |
| Sidebar | `--side-bg` | `#F3F5F3` | `#0F131A` |
| Ink | `--ink` (`--text-primary`) | `#102019` | `#E9EEF5` |
| Ink 2 | `--ink-2` (`--text-secondary`) | `#3A4A43` | `#B3BCC9` |
| Ink 3 (meta) | `--ink-3` (`--text-muted`) | `#57665F` | `#95A0AF` |
| Ink 4 (placeholder only) | `--ink-4` (`--text-dimmed`) | `#8D9A94` | `#5E6878` |
| Hairline | `--line` (`--border-color`) | `#DDE3DF` | `#252C38` |
| Strong line | `--line-strong` (`--border-input`, `--dash`) | `#C5CEC9` | `#333C4A` |
| Accent (primary, selected, focus, ok) | `--accent` / `--accent-ink` | `#0E7A66` / `#0B5F50` | `#C8F25A` / `#C8F25A` |
| Link | `--link` | `#0B6A58` | `#7CCFFF` |
| Needs you | `--attn` / `--attn-ink` | `#D08A12` / `#8A5A00` | `#FFB648` / `#FFC46B` |
| Running | `--run` / `--run-ink` | `#2D6CB5` / `#1F5797` | `#62C6FF` / `#7CCFFF` |
| Error, destructive | `--err` / `--err-ink` | `#C8412A` / `#A3311C` | `#FF6A5C` / `#FF8E83` |
| Idle | `--idle` | `#8D9A94` | `#8590A0` |

Each family has a `-soft` fill used behind its `-ink` text, most have a
`-line`, and filled controls take `--on-accent`, `--on-attn` or `--on-err`
text (Night's lime takes dark text). `--ok` equals `--accent`. Component
tokens (`--switch-*`, `--seg-*`, `--nav-on-*`, `--tabbar-bg`, `--phead-*`,
`--toast-*`, `--ask-*`, `--user-bubble*`, `--code-bg`, `--scrim`) carry the
per-skin details. The legacy accent families alias the design families:
indigo = accent, rose = err, mint = ok, sand = attn; peach keeps its own hue
and has no design role. The Garden Console (license-hub) names `--bg-2`,
`--bg-soft`, `--card` and the label recipes (`--label-font`,
`--eyebrow-size`, `--eyebrow-tracking`, `--meta-tracking`,
`--badge-tracking`) and page-frame tokens (`--topbar-height`,
`--page-max-width`, `--page-gutter`, `--z-topbar`, `--overlay-scrim`) still
alias the semantic tokens. `verydark` keeps Night's ink and accents over
pure-black surfaces (`#000000` page and sidebar, `#0A0C10` card).

Semantic map, used everywhere a state is shown, always colour plus shape
(`StatusDot` / `Status`): attn = needs you (filled circle); run = running
(circle with a halo that pulses only while its row is in view); idle =
idle/stopped (hollow ring); err = error (square in Celadon, diamond in Night);
queued = queued (dashed ring); ok = done (check). Accent also marks
primary/selected/info; a dashed border on a soft fill = archived/inert.
Providers take per-skin hues in `provider-colors.css`; every provider color
keeps >= 4.5:1 against its skin's page.

### Shape, depth, spacing

- Shape is per skin: `--r-btn`, `--r-chip`, `--r-seg`, `--r-input`,
  `--r-card`, `--r-sheet`, `--r-dialog`, `--r-bubble`, `--r-composer`,
  `--r-send`, `--r-icon-btn`, `--r-toast` and friends. Celadon is rounded
  (pill buttons and chips, 20 px cards); Night is square (8 px buttons, 12 px
  cards). The older `--radius-*` scale remains for legacy rules.
- Sizes are per skin too: `--btn-h{,-sm,-lg}`, `--icon-btn`, `--input-h`,
  `--chip-h`, `--seg-h`, `--row-h`, `--pad-card`, `--sw-w`/`--sw-h`. Below
  768 px one `@media (width < 768px)` block raises them for every skin
  (44 px buttons and icon buttons, 48 px inputs with 16 px text).
- Depth: `--shadow-card`, `--shadow-pop` (menus, dialogs, sheets) and
  `--shadow-composer`; Night draws cards flat and outlines popovers. The
  legacy `--shadow-xs..lg` scale remains.
- Spacing is a 4 px grid: `--space-1..8` = 4/8/12/16/20/24/32/40 px.
- Touch: `--tap-min: 44px`; every phone control meets it.
- Layering: `--z-tabbar` (40) sits under the drawer (101); `--z-sheet` and
  `--z-menu` match the modal layer (9999+) for new code.

## Typography

- `--font-ui`: the skin's UI face (Celadon: Instrument Sans; Night and OLED:
  Archivo), then PingFang SC / Noto Sans SC / system. All controls, titles
  and body copy. `--font-display` and `--font-brand` equal `--font-ui`; page
  and card titles differ only by `--title-weight` (600 Celadon, 700 Night),
  `--display-stretch` (Night widens to 110%) and `--display-tracking`.
- `--font-mono`: the skin's mono face (Celadon: DM Mono; Night and OLED: IBM
  Plex Mono). Code, paths, ids, hashes, branch names, timestamps, counters,
  and small metadata labels.
- Assistant prose keeps its own Output Typography font (Geist by default).
  Choosing a UI or code font in Appearance sets `--font-ui` / `--font-mono`
  inline on `<html>` and wins over the skin; the default choice follows the
  skin.
- Chrome sizes come from the per-skin `--fs-display|h1|h2|h3|body|small|meta|
  btn|input|code` scale (Celadon is slightly larger: body 15 px, Night 14 px).
  Apply `--fs-*` to chrome only (buttons, inputs, headings, rows, settings);
  transcript and prose keep their Output Typography sizes. Phones raise body
  text (`--fs-body-phone`) and use 16 px inputs (prevents iOS focus zoom).
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
  [session workbench](session-workbench.md) owns the view behavior.

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
  phones. Partial catalog discovery is explicit. See [session workbench](session-workbench.md).
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
  [settings placement](settings-ui-placement.md#settings-home-host-quick-controls-groups).
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
  ([065](../docs/tactical/065-session-composer-input-latency.md)); no
  keystroke may be dropped or take more than 100 ms to appear.
- Reduced motion is respected; animations are 120-200 ms and only answer user
  actions.
- Verification: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`,
  `pnpm test`, focused browser specs for touched surfaces, and desktop
  (1000x600) plus phone (375x812) captures of every redesigned page.
