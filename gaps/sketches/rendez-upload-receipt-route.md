# A VIBEALLDAY-served receipt route for rendez uploads

An uploader that copies a file into `.rendez/latest-session/` learns nothing
about what happened to it. The Python helper answers that today:
`ssh host rendez --project <p> receive --wait <name> < file` publishes the
upload and reports whether VIBEALLDAY accepted, failed or held it
([rendez topic](../../topics/rendez.md#optional-helpers-outside-vibeallday)). That
needs the helper installed on the receiving host and an SSH login there.

A VIBEALLDAY-defined receipt would let the sender ask VIBEALLDAY instead: a REST-style route
(or a provider-host call) that reports an upload's state from VIBEALLDAY's own
`.rendez/delivered/<route>/` records, keyed by the `.rendez`-relative
destination the sender used. It should be available to limited users for
uploads into projects they can access, under the
[principals and grants](../../topics/principals-and-grants.md) model, rather
than being administrator-only like the rendez settings.

No intended consumer exists yet. Ordinary browser attachments already report
their own upload result, and remain the supported path for people using the VIBEALLDAY
client; this route matters only for out-of-band senders that cannot or do not
want to run the helper.

Open questions: whether the sender also needs to publish through VIBEALLDAY (an upload
route) rather than only query, how a sender names its upload when the helper's
`-2`/`-3` collision renaming applies, and whether long-polling or a single
read is enough.

Requested 2026-10-18 while adding the rendez per-project settings list.
Contributing-model: opus-5-5
