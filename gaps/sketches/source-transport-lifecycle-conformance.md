# Web source transport lifecycle conformance

Status: the shared browser-transport conformance factory remains open.

## Purpose

Sleep, wake, network changes and server restarts are tested piecemeal. The
caller-visible recovery contract lives in
[source transport](../../topics/source-transport.md), but the browser transports
do not yet share one conformance factory. Preserve working browser recovery;
shared fixes need a demonstrated defect and focused regression coverage.

## Existing coverage

ConnectionManager, recovery, reconnect-subscription, SecureConnection resume,
MultiplexSourceTransport and ManagedStream tests cover the component boundaries.
The relay integration suite also checks renewed activity, retained input and
refresh/resume against real owned services. These are not full physical sleep
or TCP dead-peer qualification.

## Scenarios

Each case asserts caller-visible status, typed request failures, subscription
catch-up, retained credentials and recovery without a page reload. Every typed
character must be acknowledged within 100 ms.

| Scenario | Required outcome |
| --- | --- |
| Hidden socket dies without a close event | Wake health check fails, reconnects and catches up |
| Temporary network outage | Draft, attachment and page identity survive |
| Server restarts while the page is hidden | Recovery uses current credentials and bounded retry |
| Session credentials expire | A terminal authentication result offers sign-in instead of looping |
| A request is in flight when the browser sleeps | Typed retryable failure; no fabricated HTTP status or blind write replay |
| A frozen page resumes | Due timers trigger one health check without a reconnect storm |

## Delivery

Build one factory over the browser transports, add the non-browser scenarios
first, and retain browser fault-injection checks for visible recovery and input.
Use isolated server, relay and provider-history fixtures. Add no platform App
or device-control runner.

## Open questions

Whether hidden browser pages should eventually close their sockets remains a
separate policy decision; [architecture mandates](../../topics/architecture-mandates.md)
bound resources for closed tabs. Determine which cases apply to the always-ready
LocalhostSourceTransport instead of pretending every transport has the same
connection state machine.
