/**
 * Centralized localStorage key definitions.
 *
 * UI_KEYS are local browser preferences. BROWSER_LOCAL_KEYS are older
 * production keys kept as explicit browser-local storage for compatibility.
 * Source-scoped draft/session UI keys live in their owning modules.
 */
import { generateUUID } from "./uuid";

export const AUTOMATION_BROWSER_PROFILE_ID = "automation";

// ============================================================================
// UI Preferences (global to browser, not scoped by server)
// ============================================================================

export const UI_KEYS = {
  attachmentAction: "vibeallday-attachment-action",
  locale: "vibeallday-locale",
  theme: "vibeallday-theme",
  fontSize: "vibeallday-font-size",
  sidebarSpacing: "vibeallday-sidebar-spacing",
  panelSlideAnimations: "vibeallday-panel-slide-animations",
  diffViewMode: "vibeallday-diff-view-mode",
  outputProseFont: "vibeallday-output-prose-font",
  outputUiFont: "vibeallday-output-ui-font",
  userTurnFontSizeOffset: "vibeallday-user-turn-font-size-offset",
  tooltipFontSizeOffset: "vibeallday-tooltip-font-size-offset",
  outputProseFontSize: "vibeallday-output-prose-font-size",
  outputFixedFont: "vibeallday-output-fixed-font",
  outputFixedFontSizeOffset: "vibeallday-output-fixed-font-size-offset",
  outputProseThinkingFontSizeOffset:
    "vibeallday-output-prose-thinking-font-size-offset",
  outputProseMathFontSizeOffset:
    "vibeallday-output-prose-math-font-size-offset",
  outputProseLineSpacingPercent: "vibeallday-output-prose-line-spacing-percent",
  outputProseVerticalSpacing: "vibeallday-output-prose-vertical-spacing",
  outputProseVerticalSpacingPercent:
    "vibeallday-output-prose-vertical-spacing-percent",
  outputToolPreviewLineCount: "vibeallday-output-tool-preview-line-count",
  tabSize: "vibeallday-tab-size",
  contentMaxWidth: "vibeallday-content-max-width",
  projectAppComposing: "vibeallday-project-app-composing-enabled",
  sessionRightPane: "vibeallday-session-right-pane-enabled",
  sessionRightPaneWidth: "vibeallday-session-right-pane-width",
  /** Followed by `:<projectId>`; "1" reloads a static App on every change. */
  projectAppAutoReload: "vibeallday-project-app-auto-reload",
  searchConcurrency: "vibeallday-search-concurrency",
  pdfjsRenderer: "vibeallday-pdfjs-renderer-enabled",
  unicodeProseMath: "vibeallday-unicode-prose-math",
  transcriptMarginNavigation: "vibeallday-transcript-margin-navigation",
  escapeInterruptDisabled: "vibeallday-escape-interrupt-disabled",
  composerPromptRail: "vibeallday-composer-prompt-rail",
  commitReadWatermarks: "vibeallday-commit-read-watermarks",
  sourceControlCleanLanding: "vibeallday-source-control-clean-landing",
  sidebarWidth: "vibeallday-sidebar-width",
  sidebarExpanded: "vibeallday-sidebar-expanded",
  sidebarMinimized: "vibeallday-sidebar-minimized",
  sidebarSectionExpansion: "vibeallday-sidebar-section-expansion",
  sidebarDuplicateHidingEnabled: "vibeallday-sidebar-duplicate-hiding-enabled",
  funPhrases: "vibeallday-fun-phrases-enabled",
  streamingEnabled: "vibeallday-streaming-enabled",
  liveToolOutputEnabled: "vibeallday-live-tool-output-enabled",
  speechKeepMicWarm: "vibeallday-speech-keep-mic-warm",
  speechReducePlayback: "vibeallday-speech-reduce-playback",
  speechUnspokenPunctuation: "vibeallday-speech-unspoken-punctuation",
  speechFollowUpListenMs: "vibeallday-speech-follow-up-listen-ms",
  speechAsrAttributionMs: "vibeallday-speech-asr-attribution-ms",
  speechMessagePrefixMode: "vibeallday-speech-message-prefix-mode",
  speechMessageCustomPrefix: "vibeallday-speech-message-custom-prefix",
  speechMicDeviceId: "vibeallday-speech-mic-device-id",
  floatingActionButtonEnabled: "vibeallday-floating-action-button-enabled",
  keepMobileKeyboardOpenAfterDelivery:
    "vibeallday-keep-mobile-keyboard-open-after-delivery",
  questionAsides: "vibeallday-question-asides",
  questionReminderTurns: "vibeallday-question-reminder-turns",
  developerMode: "vibeallday-developer-mode",
  conversationView: "vibeallday-conversation-view-enabled",
  workflowTags: "vibeallday-workflow-tags-enabled",
  acliCommentary: "vibeallday-acli-commentary-enabled",
  conversationViewTurnLimit: "vibeallday-conversation-view-turn-limit",
  widerConversationActivityPreviews:
    "vibeallday-wider-conversation-activity-previews-enabled",
  glossaryHints: "vibeallday-glossary-hints-enabled",
  sessionToolbarPresence: "vibeallday-session-toolbar-presence",
  waveformButtonBackgroundOpacityPercent:
    "vibeallday-waveform-button-background-opacity-percent",
  // Legacy pre-presence keys, read once for migration then removed.
  sessionToolbarVisibility: "vibeallday-session-toolbar-visibility",
  sessionToolbarPriority: "vibeallday-session-toolbar-priority",
  tooltipMode: "vibeallday-tooltip-mode",
  tooltipDelayMs: "vibeallday-tooltip-delay-ms",
  // Legacy per-hover-card delay; seeds the shared tooltip delay at one third.
  sessionHoverCardShowDelayMs: "vibeallday-session-hover-card-show-delay-ms",
  sessionHoverCardMaxHeightPx: "vibeallday-session-hover-card-max-height-px",
  sessionGeneratedTitleEnabled: "vibeallday-session-generated-title-enabled",
  sessionGeneratedTitleLength: "vibeallday-session-generated-title-length",
  quoteReplyButtonMode: "vibeallday-quote-reply-button-mode",
  selectionQuoteActionEnabled: "vibeallday-selection-quote-action-enabled",
  selectionTextCopyActionEnabled:
    "vibeallday-selection-text-copy-action-enabled",
  selectionSourceCopyActionEnabled:
    "vibeallday-selection-source-copy-action-enabled",
  selectionRichCopyActionEnabled:
    "vibeallday-selection-rich-copy-action-enabled",
  selectionNewSessionActionEnabled:
    "vibeallday-selection-new-session-action-enabled",
  sessionThinkingVisible: "vibeallday-session-thinking-visible",
  cacheMissEventOutcomeFilter: "vibeallday-cache-miss-event-outcome-filter",
  settingsSearchMatchValues: "vibeallday-settings-search-match-values",
  newProjectGitInit: "vibeallday-new-project-git-init",
  sessionThinkingLatestOnly: "vibeallday-session-thinking-latest-only",
  sessionLoadingProgress: "vibeallday-session-loading-progress-enabled",
  sessionDomLinger: "vibeallday-session-dom-linger-enabled",
  sessionActiveWindowTrim: "vibeallday-session-active-window-trim-enabled",
  sessionInitialHistoryCompactions:
    "vibeallday-session-initial-history-compactions",
  sessionReverseSearchMaxPagesPerAttempt:
    "vibeallday-session-reverse-search-max-pages-per-attempt",
  // Legacy boolean toggle; seeds the budget preference until the slider
  // is first used, and stays coherent for older bundles.
  sessionTranscriptCache: "vibeallday-session-transcript-cache-enabled",
  sessionTranscriptCacheBudgetMb:
    "vibeallday-session-transcript-cache-budget-mb",
  sessionTranscriptCacheTtlHours:
    "vibeallday-session-transcript-cache-ttl-hours",
  sessionLastTranscriptBytes: "vibeallday-session-last-transcript-bytes",
  sessionScrollBehavior: "vibeallday-session-scroll-behavior",
  sessionDetailShadowDiagnostics:
    "vibeallday-session-detail-shadow-diagnostics-enabled",
  stableToolPreviewRendering:
    "vibeallday-stable-tool-preview-rendering-enabled",
  // Preserve the first-shipped key; true now means previews start expanded.
  inlineMediaExpandedByDefault: "vibeallday-inline-images-enabled",
  compactMultiImageGalleries:
    "vibeallday-compact-multi-image-galleries-enabled",
  recentProjectPathLinks: "vibeallday-recent-project-path-links-enabled",
  projectPathLinks: "vibeallday-project-path-links-enabled",
  mentionedDirectoryLinks: "vibeallday-mentioned-directory-links-enabled",
  schemaValidation: "vibeallday-schema-validation",
  emulatorMaxFps: "vibeallday-emulator-max-fps",
  emulatorMaxWidth: "vibeallday-emulator-max-width",
  emulatorQuality: "vibeallday-emulator-quality",
  emulatorAdaptiveFps: "vibeallday-emulator-adaptive-fps",
  attachmentUploadQuality: "vibeallday-attachment-upload-quality",
  tabTitleActivityEnabled: "vibeallday-tab-title-activity-enabled",
  hideAutomationSessions: "vibeallday-hide-automation-sessions",
  projectListSort: "vibeallday-project-list-sort",
  projectListSources: "vibeallday-project-list-sources",
  projectCodeNamesEnabled: "vibeallday-project-code-names-enabled",
  projectCodeNameActivityPulseEnabled:
    "vibeallday-project-code-name-activity-pulse-enabled",
  settingsIconStyle: "vibeallday-settings-icon-style",
  // Legacy key from the first checkbox version of this client-local setting.
  flatSettingsIcons: "vibeallday-flat-settings-icons-enabled",
} as const;

// ============================================================================
// Browser-Local Settings
// ============================================================================

export const BROWSER_LOCAL_KEYS = {
  model: "vibeallday-model",
  thinkingLevel: "vibeallday-thinking-level",
  // Old boolean thinking key still seeds the newer thinkingMode preference.
  thinkingEnabled: "vibeallday-thinking-enabled",
  thinkingMode: "vibeallday-thinking-mode",
  showThinking: "vibeallday-show-thinking",
  voiceInputEnabled: "vibeallday-voice-input-enabled",
  speechMethod: "vibeallday-speech-method",
  speechSmartTurn: "vibeallday-speech-smart-turn",
  grokSpeechAudio: "vibeallday-grok-speech-audio",
  parakeetSpeechModel: "vibeallday-parakeet-speech-model",
  whisperSpeechModel: "vibeallday-whisper-speech-model",
  xaiSttApiKey: "vibeallday-xai-stt-api-key",
  // Preserve the first-shipped push/client-log device id key.
  browserProfileId: "vibeallday-device-id",
  notifyInApp: "vibeallday-notify-in-app",
  recentProject: "vibeallday-recent-project",
} as const;

function isAutomatedBrowserProfile(): boolean {
  return typeof navigator !== "undefined" && navigator.webdriver === true;
}

/**
 * Get or create the browser profile ID.
 * This identifies the browser profile (shared across tabs) for connection tracking.
 * Creates a new UUID if one doesn't exist.
 */
export function getOrCreateBrowserProfileId(): string {
  if (isAutomatedBrowserProfile()) {
    return AUTOMATION_BROWSER_PROFILE_ID;
  }

  let browserProfileId = localStorage.getItem(
    BROWSER_LOCAL_KEYS.browserProfileId,
  );
  if (!browserProfileId) {
    browserProfileId = generateUUID();
    localStorage.setItem(BROWSER_LOCAL_KEYS.browserProfileId, browserProfileId);
  }
  return browserProfileId;
}

// ============================================================================
// Special Keys (not scoped, handle their own structure)
// ============================================================================

/** Legacy connection mirror; saved-host records own current credentials. */
export const REMOTE_CREDENTIALS_KEY = "vibeallday-remote-credentials";

/** Saved hosts for multi-host remote access */
export const SAVED_HOSTS_KEY = "vibeallday-saved-hosts";

/** Host selection and public credential ownership metadata, never session keys. */
export const TAB_HOST_KEY = "vibeallday-tab-host";
export const LAST_HOST_KEY = "vibeallday-last-host";
export const TAB_CREDENTIAL_OWNER_KEY = "vibeallday-tab-credential-owner";
