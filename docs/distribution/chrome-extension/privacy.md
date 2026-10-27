# VibeAllDay Chrome extension privacy policy

Last updated: October 13, 2026.

VibeAllDay is maintained by jiji262. This policy covers the Chrome
extension. The extension connects to VibeAllDay servers you select; it does
not require a hosted VibeAllDay account. Server operators and AI providers
control the data they process under their own policies.

## Data used by the extension

The extension stores saved host names, addresses, relay usernames, login and
resume credentials, and extension settings locally in its own browser origin
and `chrome.storage.local`. It temporarily caches lookup results and app-tab
identifiers in `chrome.storage.session`. Credentials are not placed in Chrome
sync. There are no content scripts or external messaging interfaces that share
these credentials with websites or other extensions.

The app displays session transcripts, prompts, project information, agent
activity and other content returned by your selected servers. Actions you
choose, such as sending a prompt or approving an agent operation, go to that
server. The server may send content to the AI provider you configured.

Clicking the toolbar button permits a lookup of that tab's URL. If you enable
automatic lookup and grant access to a site, the extension reads URLs on that
site to recognize GitHub issues, pull requests and Jira tickets. It sends a
matching issue or ticket URL to the active VibeAllDay hosts you selected;
repository and project filters can limit those lookups. It does not extract
page bodies, inject content scripts, modify visited pages or collect a complete
browsing-history database. Your host may request issue metadata from GitHub or
Jira using its configured integration.

These uses include authentication information, identifiers such as host
usernames, selected browsing URLs, user actions and website content such as
session transcripts. The extension does not sell this data, use it for
advertising, or send product activity to an analytics service.

## Relay connections

The public relay carries authenticated application traffic encrypted end to
end between your extension and your server. It cannot read authenticated
application content or your password. It can observe connection metadata such
as IP addresses, relay usernames, timing and traffic sizes. You can configure a
self-hosted relay. Public read-only share links have a different boundary: the
relay can observe their bearer-link requests and shared content. Do not assume
public shares have the authenticated connection's privacy protections.

## Your choices and deletion

Site permissions and automatic lookup are optional. You can revoke site access
through Chrome or disable lookup in Settings → Browser extension. Removing a
saved host removes its local profile and saved login; uninstalling the extension
or clearing its storage removes its local data. Revoke saved sessions through
the server's Remote Access settings if you also want the server to invalidate
those credentials.

Local deletion does not erase transcripts, files, accounts or audit records on
your server or at an AI provider. Contact the relevant server administrator or
provider for deletion of that data. The VibeAllDay maintainers cannot access or
delete data on independently operated servers. No public evaluation or demo
server is currently provided.

For privacy questions or deletion requests concerning services operated by the maintainer,
contact [jiguofei@msn.com](mailto:jiguofei@msn.com). Do not send passwords,
resume secrets, prompts or private project files by email.
