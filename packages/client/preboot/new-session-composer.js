// Pre-boot new-session composer — see topics/early-typing-handoff.md.
//
// Inlined into the app HTML right after #root by
// vite-plugin-preboot-composer.ts, so it runs during parse, before any module
// is fetched. A tab opened on /new-session can be typed into as soon as the
// document arrives instead of after the app has loaded; NewSessionForm adopts
// the text and caret (src/lib/prebootComposer.ts). Keep the inline bundle
// small: every byte here delays first paint of every page.
import { restorePrebootComposer } from "../src/lib/prebootComposer";

(() => {
  if (!/(?:^|\/)new-session\/?$/.test(location.pathname)) return;
  // A prefill arrives with the app; typing ahead of it has no field to go to.
  if (/[?&]prefillToken=/.test(location.search)) return;

  // The same value initializeContentMaxWidth applies once the app loads.
  var contentWidth = Number.parseInt(
    localStorage.getItem("vibeallday-content-max-width") || "",
    10,
  );
  if (Number.isFinite(contentWidth)) {
    document.documentElement.style.setProperty(
      "--content-max-width",
      `${Math.min(4000, Math.max(480, contentWidth))}px`,
    );
  }

  // Match NavigationLayout's saved desktop mode and width. Reserving that
  // space keeps the field steady without hiding the reader's sidebar.
  var sidebarWidth = Number.parseInt(
    localStorage.getItem("vibeallday-sidebar-width") || "280",
    10,
  );
  sidebarWidth = Number.isFinite(sidebarWidth)
    ? Math.min(560, Math.max(280, sidebarWidth))
    : 280;
  var expanded =
    new URLSearchParams(location.search).get("sidebar") === "expanded" ||
    localStorage.getItem("vibeallday-sidebar-expanded") !== "false";
  var minimized =
    !expanded &&
    localStorage.getItem("vibeallday-sidebar-minimized") === "true";
  document.documentElement.style.setProperty(
    "--preboot-sidebar-width",
    `${minimized ? 0 : expanded && innerWidth >= sidebarWidth + 600 ? sidebarWidth : 56}px`,
  );

  var style = document.createElement("style");
  // Geometry is literal px: in development the app's stylesheets arrive with
  // its modules, after this runs. Colours fall back the same way.
  style.textContent =
    // Above page chrome, below the app's modals (1000+), so a blocking
    // dialog raised at this URL (host offline) still shows over it.
    "#vibeallday-preboot-composer{position:fixed;inset:0;z-index:500;display:flex;" +
    // Where NewSessionForm puts its composer card: below the page header,
    // the page's top inset, the prompt heading and its lead (two lines in
    // English at the 760px column).
    // The page reserves a scrollbar gutter wherever scrollbars take room.
    "justify-content:center;align-items:flex-start;padding:300px 0 18px;" +
    "overflow-y:auto;scrollbar-gutter:stable;" +
    "box-sizing:border-box;background:inherit;color:var(--ink,#e6e6e6);" +
    "font-family:var(--font-ui,system-ui,-apple-system,sans-serif)}" +
    "html[data-theme=light] #vibeallday-preboot-composer{color:var(--ink,#1f1f1f)}" +
    "@media (prefers-color-scheme:light){html[data-theme=auto] " +
    "#vibeallday-preboot-composer{color:var(--ink,#1f1f1f)}}" +
    // The page column: the page's side inset (NewSessionPage .formColumn).
    "#vibeallday-preboot-composer>div{box-sizing:border-box;width:100%;" +
    "padding:0 var(--console-page-inset,clamp(16px,3.2vw,36px))}" +
    // Wide screens centre the page at the reader's content width.
    "@media (min-width:1100px){#vibeallday-preboot-composer{" +
    "left:var(--preboot-sidebar-width)}" +
    "#vibeallday-preboot-composer>div{" +
    "width:min(100%,var(--content-max-width,830px))}}" +
    // The composer card: 760 wide at most, centred, with the card's insets
    // (NewSessionControls .new-session-input-area).
    "#vibeallday-preboot-composer>div>div{box-sizing:border-box;" +
    "max-width:760px;margin:0 auto;padding:16px 14px 12px 18px;" +
    "border:1px solid var(--line-strong,rgba(127,127,127,.35));" +
    "border-radius:var(--r-composer,16px);background:var(--surface,transparent)}" +
    "#vibeallday-preboot-composer textarea{display:block;width:100%;" +
    "box-sizing:border-box;min-height:132px;padding:0;border:0;resize:none;" +
    "font:inherit;font-size:calc(var(--fs-prose,15.5px) + 1px);line-height:1.55;" +
    "color:inherit;background:transparent;outline:none}" +
    "#vibeallday-preboot-composer p{margin:12px 0 0;font-size:12px;opacity:.6}" +
    // Phones compose full screen: no heading, no card, a larger prompt.
    "@media (max-width:767.98px){#vibeallday-preboot-composer{padding-top:72px}" +
    "#vibeallday-preboot-composer>div>div{padding:0;border:0;background:none}" +
    "#vibeallday-preboot-composer textarea{min-height:168px;font-size:18px}}";

  var overlay = document.createElement("div");
  overlay.id = "vibeallday-preboot-composer";
  var column = document.createElement("div");
  var card = document.createElement("div");
  var textarea = document.createElement("textarea");
  textarea.rows = 6;
  textarea.placeholder = "Describe what you'd like help with...";
  textarea.setAttribute("aria-label", "New session prompt");
  var status = document.createElement("p");
  status.setAttribute("role", "status");
  status.textContent = "Loading…";

  // On a fine pointer Enter sends in the app. Nothing can be sent yet, and
  // turning the keystroke into a newline would change the text instead.
  var coarse = matchMedia("(pointer: coarse)").matches;
  textarea.addEventListener("keydown", (event) => {
    if (coarse || event.key !== "Enter" || event.isComposing) return;
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    event.preventDefault();
  });

  // A reload before the app adopts this field (a development source-version
  // check, applied browser defaults) must not cost what was typed: keep it
  // in the tab's session storage, where prebootComposer.ts also stashes it.
  restorePrebootComposer(textarea, !import.meta.env.VITE_IS_REMOTE_CLIENT);

  card.append(textarea, status);
  column.append(card);
  overlay.append(column);
  document.head.append(style);
  document.body.append(overlay);
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
})();
