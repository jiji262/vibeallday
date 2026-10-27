# Session workbench

Topic: session-workbench

## One destination, two views

Desktop and phone navigation expose one **Sessions** destination. It opens
**Overview** at `/inbox`; **All** at `/sessions` retains full session search,
project/status/time/archive filters, selection and bulk actions. The shared
view links preserve the project filter and relay-host prefix. Both existing
URLs remain valid, and the application landing route remains `/inbox`.

Mobile has Sessions, New, Projects and More. Session details still select
Sessions, retain the project-specific All back link and existing recent-session
switcher, and keep the shared keyboard/safe-area behavior. Hiding the bar for
the keyboard never changes the header's navigation mode.

## Overview

The overview progressively reads the existing non-archived global catalog and
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

Unread is independent of these sections. Its always-visible shortcut counts
all loaded, accessible non-archived records, including old and hidden-automation
sessions. It opens All with the unread/unarchived and explicit all-source
filters, preserving the project filter. A task completing after days of silence
is therefore discoverable even if its last human turn is old.

Catalog pagination and discovery remain explicit: incomplete counts carry `+`
and a loading/incomplete notice. Empty/complete is not asserted while discovery
is incomplete. The existing `/api/inbox` tier caps and unread windows remain
its compatibility contract, not the overview's completeness boundary.

The hide-automation preference applies to ordinary recent/running rows; a
session requiring human attention is never hidden by it. Existing pending
future-session queue cards (including failed cards), review outcomes, draft,
share and per-row controls remain available. The failed future-session cards
carry their explicit failure status; they are not fabricated session records.

## Stable chronology and targets

Both overview and sidebar use max(browser composer submission, server
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
