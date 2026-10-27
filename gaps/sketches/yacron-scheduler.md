# VibeAllDay has no generally running vibeallday-cron scheduler

VibeAllDay and its provider host do not currently supply the generally running local
scheduler proposed in [`topics/vibeallday-cron.md`](../../topics/vibeallday-cron.md). Ordinary
agent sessions no longer probe the existing `~/agents` `at/` queue at startup,
so due work still has no punctual owner unless a user invokes that protocol
explicitly.

Missing feature: implement vibeallday-cron's single-owner scheduler/store and agent CLI,
using the [agent command runtime sketch](../../topics/agent-command-runtime.sketches.md) for the
integrated supervised-session launcher rather than adding another desktop
sidecar or global VibeAllDay command. Then support either or both explicit deployment
variants. The standalone
variant may launch harnesses directly but cannot claim Project Queue or atomic
project exclusivity. The integrated variant requires a durable profile-scoped
provider service that owns patient/deferred input, FIFO project admission,
sandbox launch facts, current/existing/fresh-session targets, and Project
Queue's complete idle predicate.

The earlier solution sketched here — a VibeAllDay scanner coupled directly to
`scripts/at-queue` — is superseded. `at/` is prior art and a possible explicit
point-in-time import/export format, not vibeallday-cron's required state or dispatch
protocol. Exported files stay inert until an explicit import-as-of-now
operation. It may be retired if vibeallday-cron covers its useful cases.

Why not fixed in place: the shared core needs persistence/reconciliation and
cross-platform supervision. Full integration additionally needs a new durable
provider-service lifecycle, provider-owned queues/admission, sandbox-aware
authorization, and headless session creation rather than a bounded server
patch.

Found 2026-08-22 while removing the agents-side session-start `at/` probe
mandate (`~/agents` commit 24a9a3c).
