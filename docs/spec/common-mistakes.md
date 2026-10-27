# Project-specific implementation traps

## Session catalog pagination must observe settled page progress

`useGlobalSessionsFeed.loadMore()` does not toggle `loading`, and its function
identity stays stable across pages. An effect depending only on
`hasMore/loading/error/loadMore` can stop after the second page while `hasMore`
remains true. This was inherited by the first workbench implementation from
the All view; a two-page, 530-record fixture did not expose it.

Overview and All now share a serial drain which advances after each settled
page, stops if row count does not progress, and cancels old-source continuations.
Keep at least three pages in the integration fixture, with an old pending ask
and unread records only on the final page. See
`packages/client/e2e/session-workbench.spec.ts` and
[the workbench contract](../../topics/session-workbench.md).

## Phone session cards need shrinkable grid tracks and links

Overview's implicit auto grid column used the longest title's min-content
width, so one unbroken URL stretched every section beyond a 375px screen.
The card link's automatic flex minimum also prevented shrinking inside its
body. All already constrained both layers; Overview did not. The initial
short-title fixture and body-width checks missed this because the route shell
clips overflow without widening the body.

Use a `minmax(0, 1fr)` tier column and a zero minimum width on the shared card
link. The existing workbench browser fixture now includes an unbroken URL and
checks every card link's rendered right edge against the viewport, rather than
inferring containment from the body's scroll width.
