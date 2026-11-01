# Managed artifact content host

The first-party hosted VIBEALLDAY client supplies this viewer automatically when its
server advertises `artifact-relay-preview` and no custom public artifact host
is configured. The static host carries no artifact storage or VIBEALLDAY credentials.
The real file viewer captures its source transport and forwards bounded reads
through an authenticated, principal/session-bound preview lease.

## Delivery

`artifact-<32 lowercase hex digits>.vibeallday.navs.dpdns.org` is a fresh origin for one
viewer. First-level labels fit ordinary wildcard TLS. Only the fixed
`/__vibeallday/1/bootstrap.html`, `bootstrap.js`, `worker.js` and `frame.js` are served;
all artifact and API network paths return inert failures. A worker scoped to
`/v/` synthesizes document/asset responses from the parent broker. Its CSP
allows local assets and scripts while restricting ordinary external resource
loads, workers, nested frames, forms and top-level escape. This is credential
and API isolation, not network containment: artifact scripts can read every
non-dot file granted under the entry directory and exfiltrate it through
WebRTC STUN/TURN, their own frame navigation or DNS side channels. Source bytes remain inert
on the authenticated VIBEALLDAY API origin.

The hosted assets allow only `https://vibeallday.navs.dpdns.org` and
`https://latest.vibeallday.navs.dpdns.org` to embed or connect the bootstrap.
The client and bootstrap both validate exact source,
origin, protocol and viewer identity. Content receives an entry name and theme
and widget state, never a server credential, grant API path or general fetch
interface. The server rechecks file authority even if content forges messages.

The small fragment adapter exposes `openai.theme`, `widgetState`,
`setWidgetState()` (64 KiB), and `sendFollowUpMessage()` (8,000 characters,
eight insertions per viewer, requiring transient user activation and viewer-frame focus in the trusted
parent). Follow-ups insert undoably into the current
session draft and never send automatically. State belongs to one source,
session and artifact; it is not durable across closing the viewer. The fixed
frame helper also supports the existing file-viewer find protocol.

Version `1` is the message/asset compatibility family. Compatible changes keep
its URLs and protocol working for existing viewers. A future incompatible
family must retain version 1 assets while its active viewers can still run.
New viewers always get a fresh origin. Viewer documents are no-store; the host
never caches file bytes. Network fallback is always safe if worker control is
lost. Parent cleanup cancels readers/ports and releases the server lease; the
bootstrap unregisters on explicit close and pagehide.

## Build and deploy

Build shared first so the generated, existing find agent is available:

```bash
pnpm --filter shared build
node --test artifact-host/host.test.mjs
cd artifact-host
npx -y wrangler@4.141.0 deploy --config wrangler.jsonc
```

The route uses `*.vibeallday.navs.dpdns.org/*`. DNS must provide a proxied wildcard
record. Existing explicit service records remain DNS-only and bypass the
Worker; a non-artifact hostname reaching this Worker returns 404. Review that
constraint before proxying any additional first-party service hostname.
Private account/zone records, credentials and actual deployment receipts live
in the dotfiles runbook, not public source. Logs/observability are disabled.
This is the real HTTPS content host, not a separate VIBEALLDAY staging environment.

## Acceptance

The explicit manual runner uses a temporary VIBEALLDAY profile and a fresh, random
identity/password on the public TLS relay. It loads the **actual newly built
VIBEALLDAY client** from the owned worktree into an intercepted first-party-origin
page in a separately identified Playwright Chromium profile. The content
origin's DNS, TLS and responses are real network requests to this deployment;
the first-party parent build is temporary, not the public site's deployed
client. It needs no browser insecure-origin, resolver, TLS or LNA overrides.
Third-party cookies are blocked in the disposable browser profile.

```bash
pnpm exec tsx --conditions source artifact-host/acceptance.mjs --public-relay
```

The public relay sees only normal SRP/NaCl encrypted traffic. The runner stops
its owned VIBEALLDAY/browser processes, and leaves secret-free diagnostics/captures
under ignored `.artifacts/managed-artifact/`. No screenshots belong in Git.
It is manual qualification, not a production-dependent CI test. Fast host
security and real-filesystem lease tests run in ordinary unit CI.

The supported v1 file tree is the entry HTML's directory and descendants.
UTF-8 HTML, relative resources, computed modules and linked HTML documents work without asset
rewriting. Absolute OS paths, root-relative web-app routing, external scripts
or APIs, application backends and WebSockets are not supplied by this broker.
Custom artifact hosts, app vhosts and public sharing retain their existing
contracts. Chrome is the initial qualified engine. WebKit keeps its existing viewer;
Only the two
official parent origins are supported by hosted assets;
`PARENT_ORIGINS` is a diagnostic override, not custom-deployment support, since
the content response CSP also fixes its ancestors.

## Measured qualification — 2026-10-16

Chrome for Testing 148.0.7778.96 passed the real VIBEALLDAY-pane/public encrypted-relay
runner with the artifact listener disabled and third-party cookies blocked:

- Native PNG/srcset, imported CSS/background URL, WOFF2 font, classic script,
  static and computed dynamic module imports, and JSON fetch.
- Linked HTML navigation/reload, explicit worker termination/restart, separate
  origins/storage for concurrent viewers, and find (1/1).
- Fragment theme and widget-state restoration on inner reload; a follow-up
  populated the draft without submission.
- Cancellation after the first 65,536 bytes of a 4 MiB stream, followed by a
  successful read; close removed all registrations and a surviving controlled
  frame's next read returned 503. Direct network artifact fallback returned 404.
- All 32 sequential artifact keystrokes acknowledged within 4 ms. All 33
  composer keystrokes acknowledged within 6 ms while 12 transcript updates
  caused 38 DOM mutations. No browser console/page errors.
- Desktop 1000×600 and phone-width 375×812 captures inspected; no screenshots
  committed. Phone-width Chromium is not Android/iOS device qualification.

Selected, secret-free evidence is in [acceptance-results.json](acceptance-results.json).
Server tests separately cover range responses, traversal/symlink denial,
principal/session binding, policy changes and revocation/expiry. Those security
cases are API integration evidence, not additional browser measurements.

## Historical mobile browser measurements

The retained [emulator Chrome results](android-acceptance-results.json) and
[physical Chrome results](physical-acceptance-results.json) describe earlier
browser runs. Native APK measurements have been removed. The current manual
runner supports Chromium at desktop and phone viewport sizes; it does not
claim physical Android or iOS qualification.

## Review hardening

VIBEALLDAY API launched Claude Opus 5.5 at high effort for a source/security review.
No security blocker was found. Its functional findings were addressed: bounded
FIFO admission (64 waiting per viewer / 256 per tab, eight active per viewer, 32 per tab), byte-exact
relay download streams, range-header forwarding and response-byte budgets,
late admission cleanup, explicit lease-expiry/unavailability Retry, immediate
static fallback while version is unknown, and server slots reserved before
filesystem awaits. Follow-ups require transient user activation; reserved
content hosts are excluded from the extension's session-tab trust lookup.
The scriptless link listener is shared with the configured viewer. A follow-up
review accepted all fixes without blockers. Its additional recommendations
were applied: server read headroom (16/64), 64 queued reads per viewer, and
viewer focus as well as user activation for composer insertions.

Leases do not renew automatically. Expiry or server lease loss exposes Retry,
which admits the original entry through the captured trusted source. Missing
individual files remain resource failures. Current source uses a 120-second
progress-based idle deadline, bounded by lease expiry, a 256 MiB per-file limit
and 1 GiB of produced bytes per viewer. Cancelling a range charges only bytes
produced, preserving headroom for repeated video seeks. Linked PDF/download
navigation remains outside this qualification. Other file bytes are transported
verbatim; HTML needs UTF-8. The currently deployed hosted worker still has its
earlier 64 MiB file limit until separately published; the generated APK copy
uses the source limits.

Qualification limits: queued response heads still have the worker's 15-second
limit; slow cellular/resource bursts can time out. Server read caps are shared
across clients, so overload can still return 429. The expiry notification uses
the server timestamp against the client clock; clock skew may show Retry early.
Lease expiry intentionally tears down in-page state after 30 minutes; dashboard
renewal and durable widget state are not supplied by v1.
