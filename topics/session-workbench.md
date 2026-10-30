# Session workbench

Topic: session-workbench

## One destination, two views

Desktop and phone navigation expose one **Sessions** destination. It opens
**Inbox** at `/inbox`; **All** at `/sessions` retains full session search,
project/status/time/archive filters, selection and bulk actions. The shared
view links preserve the project filter and relay-host prefix. Both existing
URLs remain valid, and the application landing route remains `/inbox`.

Mobile has Sessions, New, Projects and More in a tab bar that appears only on
the root pages `/inbox`, `/sessions`, `/projects` and `/more`. Session details
have no tab bar; they retain the project-specific All back link (Back to
triage, with its progress, for a session opened from Triage) and existing
recent-session switcher, and keep the shared keyboard/safe-area behavior.
Hiding the bar for the keyboard never changes the header's navigation mode.

## Inbox

The inbox progressively reads the existing non-archived global catalog and
classifies each accessible session once, in this order:

1. **Needs you:** pending approval/question, waiting-input state or an
   unacknowledged non-human user turn. No age or unread condition applies.
2. **Running:** in-turn activity or an existing-session Project Queue item
   that is queued/dispatching. Failed entries retain queue affordances but do
   not turn an idle existing session into a running one.
3. **Recently participated:** the remaining visible sessions, ordered by the
   user's submission chronology, with twenty rows and an All link.

Sections and session cards fit the available phone width even when a title
contains a long unbroken URL. Titles retain their two-line truncation.

The summary tiles above the sections (Needs you, Running, Unread, and Queued
where the server has a Project Queue) are in-page filter toggles: selecting one
narrows the inbox to that group and selecting it again clears the filter.

A Needs you row answers a simple pending request in place, through the same
pending-input endpoint as the session panel. A tool approval offers Approve
once and Deny, plus Allow edits for this session for edit tools only (the
panel's accept-edits response); the full shell command is shown with hidden
characters made visible, and the buttons keep the panel's click-protection
delay. One plain single-choice question offers its options. Plan approvals,
several questions, multi-select and secret questions open the session.
Triage adds **A** (approve once) and **D** (deny with a reason, sent with
Mod+Enter); held, modified and IME keys and keys typed in fields never act.
On phones Triage's decision buttons sit in a bottom bar.

Unread is independent of these sections. Its always-visible tile counts all
loaded, accessible non-archived records, including old and hidden-automation
sessions. Its **View all unread** link opens All with the unread/unarchived and
explicit all-source filters, preserving the project filter. A task completing after days of silence
is therefore discoverable even if its last human turn is old.

Catalog pagination and discovery remain explicit: incomplete counts carry `+`
and a loading/incomplete notice. Empty/complete is not asserted while discovery
is incomplete. The existing `/api/inbox` tier caps and unread windows remain
its compatibility contract, not the inbox's completeness boundary.

The hide-automation preference applies to ordinary recent/running rows; a
session requiring human attention is never hidden by it. Existing pending
future-session queue cards (including failed cards), review outcomes, draft,
share and per-row controls remain available. The failed future-session cards
carry their explicit failure status; they are not fabricated session records.

## Stable chronology and targets

Both inbox and sidebar use max(browser composer submission, server
lastHumanTurnAt, createdAt); updatedAt never substitutes for human activity.
Reading or background output does not reorder recent work. Pointer, keyboard
focus and touch interaction hold row identity/order/group membership while
live row content continues updating. Apply visible limits after that hold so
a new higher-ranked record cannot remove a held target at the cutoff.

## Sidebar shortcuts

Favorites, manual categories and creator groups retain their independent feeds
and controls. Ordinary recent shortcuts combine all loaded ages and show eight
rows, with the current ordinary session retained when present in those records.
The last slot can hold that current session when it falls outside the first
eight. The ordinary shortcut count does not limit favorites or categories.

The section is called **Recent sessions**; View all sessions provides the full
list. Duplicate hiding retains its existing protections and only offers hidden
rows whose representative is in the visible shortcut scope. Existing section
expansion storage keys remain compatible. The sidebar does not drain the full
catalog merely to fill space after it already has eight ordinary records.
