import type { PromptSuggestionMode } from "@vibeallday/shared";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useI18n } from "../i18n";
import { writeClipboardText } from "../lib/clipboard";
import {
  CheckIcon,
  CopyIcon,
  DiffIcon,
  ExternalIcon,
  InfoIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshIcon,
  SettingsIcon,
  StarIcon,
  ChevronDownIcon,
} from "./garden/icons";
import styles from "./SessionMenu.module.css";
import { SessionMenuCategoryPicker } from "./SessionMenuCategoryPicker";
import { SessionMenuGroup, SessionMenuMoreGroup } from "./SessionMenuGroup";
import {
  ArchiveIcon,
  CloneIcon,
  CompactIcon,
  GenerateTitleIcon,
  HandoffIcon,
  NudgeIcon,
  RecapIcon,
  RenameIcon,
  RestartIcon,
  RestoreIcon,
  ShareIcon,
  SuggestionIcon,
  TerminateIcon,
  UnreadIcon,
} from "./SessionMenuIcons";

/** Below this width the header menu is a bottom sheet, not an anchored popover. */
const PHONE_WIDTH_QUERY = "(width < 600px)";
const MENU_ICON_SIZE = 14;
const TRIGGER_ICON_SIZE = 16;

export interface SessionMenuProps {
  sessionId: string;
  projectId: string;
  isStarred: boolean;
  isArchived: boolean;
  hasUnread?: boolean;
  /** Provider name - used for capability checks like cloning support */
  provider?: string;
  /** Process ID if session has an active process (enables terminate option) */
  processId?: string;
  onToggleStar: () => void | Promise<void>;
  /** The session's current sidebar category, if any. */
  sidebarCategory?: string;
  /** Existing categories to offer, besides creating a new one. */
  sidebarCategoryNames?: readonly string[];
  /** File the session under a category, or none with null. Omit to hide. */
  onSetSidebarCategory?: (category: string | null) => void | Promise<void>;
  onToggleArchive: () => void | Promise<void>;
  onToggleRead?: () => void | Promise<void>;
  onRename: () => void;
  /** Open Session Info directly, without visiting model configuration. */
  onShowInfo?: () => void;
  /** Open Source Control's changes for this session's project. */
  onReviewChanges?: () => void;
  /** Generate and apply a title through the provider helper flow. */
  onGenerateTitle?: () => void | Promise<void>;
  /** Copy the session's initial prompt, when available. */
  onCopyPrompt?: () => void | Promise<void>;
  /** Open this session in a new browser tab/window. */
  onOpenNewTab?: () => void | Promise<void>;
  /** Create a cold provider-native clone of the latest completed transcript. */
  onClone?: () => void | Promise<void>;
  /** Why Clone is visible but unavailable on this server. */
  cloneUnavailableMessage?: string;
  /** Clone waits for the current provider response to complete. */
  cloneDisabled?: boolean;
  /** Called to request compaction in the current session */
  onCompact?: () => void | Promise<void>;
  compactDisabled?: boolean;
  /** Called to hand off the session into a fresh agent session */
  onHandoff?: () => void | Promise<void>;
  /** Start an empty session in the same project with the same provider/model */
  onClear?: () => void | Promise<void>;
  /** Called to terminate the session's process */
  onTerminate?: () => void | Promise<void>;
  /** Stop the provider, reopen its saved session, and refresh the view. */
  onRestartProvider?: () => Promise<void>;
  /** Reload the page (non-swipe alternative for mobile) */
  onReload?: () => void;
  /** Called to configure session heartbeat settings */
  onConfigureHeartbeat?: () => void;
  /** Called to configure defaults for this session's project */
  onConfigureProjectSettings?: () => void;
  /** Called to configure session recap settings */
  onConfigureRecaps?: () => void;
  /**
   * Current per-session prompt-suggestion mode. When provided alongside
   * onTogglePromptSuggestions, a toggle entry is shown.
   */
  promptSuggestionMode?: PromptSuggestionMode;
  /** Toggle the per-session prompt-suggestion preference (off <-> native) */
  onTogglePromptSuggestions?: () => void | Promise<void>;
  /** Whether dismissed warnings can be restored */
  warningRestoreAvailable?: boolean;
  /** Restore dismissed per-session warnings */
  onRestoreWarnings?: () => void | Promise<void>;
  /** Use "..." icon instead of chevron */
  useEllipsisIcon?: boolean;
  /** @deprecated Public share availability is checked when the modal creates the link. */
  sharingConfigured?: boolean;
  /** Called to open the public share flow */
  onShare?: () => void | Promise<void>;
  shareLabel?: ReactNode;
  additionalItems?: (close: () => void) => ReactNode;
  triggerClassName?: string;
  /** Additional class for the wrapper */
  className?: string;
  /** Remove the trigger from layout so its caller can overlay it on a row. */
  overlayTrigger?: boolean;
  /** Use fixed positioning for dropdown (escapes overflow clipping) */
  useFixedPositioning?: boolean;
  /** Notified when the menu opens/closes so callers can react to open state. */
  onOpenChange?: (open: boolean) => void;
}

export function SessionMenu({
  sessionId,
  isStarred,
  isArchived,
  hasUnread,
  processId,
  onToggleStar,
  sidebarCategory,
  sidebarCategoryNames = [],
  onSetSidebarCategory,
  onToggleArchive,
  onToggleRead,
  onRename,
  onShowInfo,
  onReviewChanges,
  onGenerateTitle,
  onCopyPrompt,
  onOpenNewTab,
  onClone,
  cloneUnavailableMessage,
  cloneDisabled = false,
  onCompact,
  compactDisabled = false,
  onHandoff,
  onClear,
  onTerminate,
  onRestartProvider,
  onReload,
  onConfigureHeartbeat,
  onConfigureProjectSettings,
  onConfigureRecaps,
  promptSuggestionMode,
  onTogglePromptSuggestions,
  warningRestoreAvailable = false,
  onRestoreWarnings,
  onShare,
  shareLabel,
  additionalItems,
  triggerClassName,
  useEllipsisIcon = false,
  className = "",
  overlayTrigger = false,
  useFixedPositioning = false,
  onOpenChange,
}: SessionMenuProps) {
  const { t } = useI18n();
  const isPhoneWidth = useMediaQuery(PHONE_WIDTH_QUERY);
  const [isOpen, setIsOpen] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [isRestartingProvider, setIsRestartingProvider] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  // A copied id leaves nothing on screen to confirm it, so the entry reports
  // the outcome in place and closes the menu once the reader has seen it.
  const [copiedSessionId, setCopiedSessionId] = useState<"ok" | "failed">();
  // The rarely used "More" entries stay folded until asked for.
  const [moreOpen, setMoreOpen] = useState(false);
  // Identifies the current opening, so a copy that finishes after its menu
  // closed cannot report into, or close, a later one.
  const openingRef = useRef<object | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left?: number;
    right?: number;
  } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside or scrolling (mobile)
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // Check both wrapper and dropdown (dropdown may be in portal)
      const clickedInWrapper = wrapperRef.current?.contains(target);
      const clickedInDropdown = dropdownRef.current?.contains(target);
      if (!clickedInWrapper && !clickedInDropdown) {
        setIsOpen(false);
        triggerRef.current?.blur();
      }
    };
    const handleScroll = (e: Event) => {
      // Only close if scroll happens in an ancestor of the menu trigger
      // This prevents closing when unrelated areas (like main content pane) scroll
      const scrollTarget = e.target as Node;
      if (
        scrollTarget instanceof Node &&
        wrapperRef.current &&
        !scrollTarget.contains(wrapperRef.current)
      ) {
        return; // Scroll is not in an ancestor of the menu, ignore
      }
      setIsOpen(false);
      setDropdownPosition(null);
      triggerRef.current?.blur();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [isOpen]);

  // Notify the caller of every open/close (covers toggle, outside-click,
  // scroll, and item-select close paths), not just the trigger click.
  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    openingRef.current = isOpen ? {} : null;
    if (!isOpen) {
      setCopiedSessionId(undefined);
      setMoreOpen(false);
    }
  }, [isOpen]);

  // A failure stays on the entry until the menu closes; only success is
  // transient, because the clipboard already carries the proof.
  useEffect(() => {
    if (!isOpen || copiedSessionId !== "ok") return;
    const timer = setTimeout(() => {
      setIsOpen(false);
      setDropdownPosition(null);
      triggerRef.current?.blur();
    }, 1000);
    return () => clearTimeout(timer);
  }, [isOpen, copiedSessionId]);

  const handleToggleOpen = () => {
    if (isOpen) {
      setIsOpen(false);
      setDropdownPosition(null);
      triggerRef.current?.blur();
    } else {
      setIsOpen(true);
    }
  };

  useLayoutEffect(() => {
    if (!isOpen || !useFixedPositioning) return;
    const trigger = triggerRef.current;
    const dropdown = dropdownRef.current;
    if (!trigger || !dropdown) return;
    const rect = trigger.getBoundingClientRect();
    const { width, height } = dropdown.getBoundingClientRect();
    const margin = 8;
    const below = rect.bottom + margin;
    const preferredTop =
      below + height <= window.innerHeight - margin
        ? below
        : rect.top - height - margin;
    setDropdownPosition({
      top: Math.max(
        margin,
        Math.min(preferredTop, window.innerHeight - height - margin),
      ),
      left: Math.max(
        margin,
        Math.min(rect.right - width, window.innerWidth - width - margin),
      ),
    });
  }, [isOpen, useFixedPositioning]);

  const handleAction = (action: () => void | Promise<void>) => {
    setIsOpen(false);
    setDropdownPosition(null);
    triggerRef.current?.blur();
    action();
  };

  const handleTerminate = async () => {
    if (isTerminating || !onTerminate) return;
    setIsTerminating(true);
    setIsOpen(false);
    setDropdownPosition(null);
    triggerRef.current?.blur();
    try {
      await onTerminate();
    } catch (error) {
      console.error("Failed to terminate session:", error);
    } finally {
      setIsTerminating(false);
    }
  };

  const handleShare = async () => {
    if (isSharing || !onShare) return;
    setIsSharing(true);
    setIsOpen(false);
    setDropdownPosition(null);
    triggerRef.current?.blur();
    try {
      await onShare();
    } catch (error) {
      console.error("Failed to share session:", error);
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopySessionId = async () => {
    const opening = openingRef.current;
    const copied = await writeClipboardText(sessionId);
    if (openingRef.current !== opening) return;
    setCopiedSessionId(copied ? "ok" : "failed");
  };

  const handleClone = async () => {
    if (isCloning || cloneDisabled || !onClone) return;
    setIsCloning(true);
    setIsOpen(false);
    setDropdownPosition(null);
    triggerRef.current?.blur();
    try {
      await onClone();
    } finally {
      setIsCloning(false);
    }
  };

  const handleRestartProvider = async () => {
    if (isRestartingProvider || !onRestartProvider) return;
    setIsRestartingProvider(true);
    setIsOpen(false);
    triggerRef.current?.blur();
    try {
      await onRestartProvider();
    } finally {
      setIsRestartingProvider(false);
    }
  };

  const wrapperClasses = [
    styles.wrapper,
    overlayTrigger && styles.overlayTrigger,
    "session-menu-wrapper",
    className,
    isOpen && "is-open",
  ]
    .filter(Boolean)
    .join(" ");

  // For portal mode, we must have fixed positioning with calculated coordinates
  // Fall back to a visible position if calculation failed
  const sheetLayout = useFixedPositioning && isPhoneWidth;
  const dropdownStyle =
    useFixedPositioning && !sheetLayout
      ? {
          position: "fixed" as const,
          marginTop: 0,
          top: dropdownPosition?.top ?? 100,
          ...(dropdownPosition?.left !== undefined
            ? { left: dropdownPosition.left }
            : { right: dropdownPosition?.right ?? 20 }),
        }
      : undefined;

  const closeThen = (action: () => void | Promise<void>) => () =>
    handleAction(action);

  const dropdownContent = (
    <div
      ref={dropdownRef}
      className={`${styles.dropdown}${sheetLayout ? ` ${styles.sheet}` : ""}`}
      style={dropdownStyle}
      data-session-menu-open
    >
      <SessionMenuGroup>
        {onShowInfo && (
          <button type="button" onClick={closeThen(onShowInfo)}>
            <InfoIcon size={MENU_ICON_SIZE} />
            {t("sessionInfoShortcut")}
          </button>
        )}
        {onReviewChanges && (
          <button type="button" onClick={closeThen(onReviewChanges)}>
            <DiffIcon size={MENU_ICON_SIZE} />
            {t("sessionMenuReviewChanges")}
          </button>
        )}
      </SessionMenuGroup>
      <SessionMenuGroup label={t("sessionMenuGroupOrganize")}>
        <button type="button" onClick={closeThen(onRename)}>
          <RenameIcon />
          {t("sessionMenuRename")}
        </button>
        <button type="button" onClick={closeThen(onToggleStar)}>
          <StarIcon
            size={MENU_ICON_SIZE}
            fill={isStarred ? "currentColor" : "none"}
          />
          {isStarred ? t("sessionMenuUnstar") : t("sessionMenuStar")}
        </button>
        {onSetSidebarCategory && (
          <SessionMenuCategoryPicker
            current={sidebarCategory}
            names={sidebarCategoryNames}
            onChoose={(category) =>
              handleAction(() => onSetSidebarCategory(category))
            }
          />
        )}
        {onToggleRead && (
          <button
            type="button"
            onClick={closeThen(onToggleRead)}
            aria-label={
              hasUnread ? t("sessionMenuMarkRead") : t("sessionMenuMarkUnread")
            }
          >
            {hasUnread ? <CheckIcon size={MENU_ICON_SIZE} /> : <UnreadIcon />}
            {hasUnread ? t("sessionMenuMarkRead") : t("sessionMenuMarkUnread")}
            <kbd className={styles.shortcut}>{hasUnread ? "R" : "U"}</kbd>
          </button>
        )}
        {additionalItems?.(() => setIsOpen(false))}
      </SessionMenuGroup>
      <SessionMenuGroup label={t("sessionMenuGroupShare")}>
        {onShare && (
          <button type="button" onClick={handleShare} disabled={isSharing}>
            <ShareIcon />
            {isSharing
              ? t("sessionMenuSharing")
              : (shareLabel ?? t("sessionMenuShare"))}
          </button>
        )}
        {onCopyPrompt && (
          <button type="button" onClick={closeThen(onCopyPrompt)}>
            <CopyIcon size={MENU_ICON_SIZE} />
            {t("sessionMenuCopyPrompt")}
          </button>
        )}
        {onOpenNewTab && (
          <button type="button" onClick={closeThen(onOpenNewTab)}>
            <ExternalIcon size={MENU_ICON_SIZE} />
            {t("sessionMenuOpenNewTab")}
          </button>
        )}
      </SessionMenuGroup>
      <SessionMenuGroup label={t("sessionMenuGroupBranch")}>
        {(onClone || cloneUnavailableMessage) && (
          <button
            type="button"
            onClick={handleClone}
            disabled={Boolean(
              cloneUnavailableMessage || cloneDisabled || isCloning,
            )}
            title={
              cloneUnavailableMessage ??
              (cloneDisabled ? t("sessionMenuCloneDisabled") : undefined)
            }
          >
            <CloneIcon />
            {isCloning
              ? t("sessionMenuCloning")
              : cloneUnavailableMessage
                ? t("sessionMenuCloneUpdateRequired")
                : t("sessionMenuClone")}
          </button>
        )}
        {onHandoff && (
          <button type="button" onClick={closeThen(onHandoff)}>
            <HandoffIcon />
            {t("sessionMenuHandoff")}
          </button>
        )}
        {onClear && (
          <button type="button" onClick={closeThen(onClear)}>
            <PlusIcon size={MENU_ICON_SIZE} />
            {t("sessionMenuClear")}
          </button>
        )}
      </SessionMenuGroup>
      <SessionMenuGroup label={t("sessionMenuGroupAgent")}>
        {onConfigureHeartbeat && (
          <button type="button" onClick={closeThen(onConfigureHeartbeat)}>
            <NudgeIcon />
            {t("sessionMenuHeartbeat")}
          </button>
        )}
        {onConfigureRecaps && (
          <button type="button" onClick={closeThen(onConfigureRecaps)}>
            <RecapIcon />
            {t("sessionMenuRecaps")}
          </button>
        )}
        {onCompact && (
          <button
            type="button"
            onClick={closeThen(onCompact)}
            disabled={compactDisabled}
            title={compactDisabled ? t("sessionCompactTurnActive") : undefined}
          >
            <CompactIcon />
            {t(
              compactDisabled
                ? "sessionMenuCompactTurnActive"
                : "sessionMenuCompact",
            )}
          </button>
        )}
        {processId && onRestartProvider && (
          <button
            type="button"
            disabled={isRestartingProvider || isTerminating}
            title={t("sessionMenuRestartProviderHint")}
            onClick={handleRestartProvider}
          >
            <RestartIcon />
            {isRestartingProvider
              ? t("sessionMenuRestartingProvider")
              : t("sessionMenuRestartProvider")}
          </button>
        )}
      </SessionMenuGroup>
      <SessionMenuMoreGroup
        label={t("sessionMenuGroupMore")}
        open={moreOpen}
        onToggle={() => setMoreOpen((open) => !open)}
      >
        {onTogglePromptSuggestions && (
          <button type="button" onClick={closeThen(onTogglePromptSuggestions)}>
            <SuggestionIcon />
            {promptSuggestionMode === "native"
              ? t("sessionMenuPromptSuggestionsOn")
              : t("sessionMenuPromptSuggestionsOff")}
          </button>
        )}
        {warningRestoreAvailable && onRestoreWarnings && (
          <button type="button" onClick={closeThen(onRestoreWarnings)}>
            <RestoreIcon />
            {t("sessionMenuRestoreWarnings")}
          </button>
        )}
        {onGenerateTitle && (
          <button type="button" onClick={closeThen(onGenerateTitle)}>
            <GenerateTitleIcon />
            {t("sessionMenuGenerateTitle")}
          </button>
        )}
        <button type="button" onClick={handleCopySessionId}>
          <CopyIcon size={MENU_ICON_SIZE} />
          {copiedSessionId === "ok"
            ? t("sessionMenuCopiedSessionId")
            : copiedSessionId === "failed"
              ? t("sessionMenuCopySessionIdFailed")
              : t("sessionMenuCopySessionId")}
        </button>
        {onConfigureProjectSettings && (
          <button type="button" onClick={closeThen(onConfigureProjectSettings)}>
            <SettingsIcon size={MENU_ICON_SIZE} />
            {t("sessionMenuProjectSettings")}
          </button>
        )}
        {onReload && (
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onReload();
            }}
          >
            <RefreshIcon size={MENU_ICON_SIZE} />
            {t("sessionMenuReloadPage")}
          </button>
        )}
      </SessionMenuMoreGroup>
      <SessionMenuGroup tone="danger">
        <button
          type="button"
          className={styles.dangerItem}
          onClick={closeThen(onToggleArchive)}
        >
          <ArchiveIcon />
          {isArchived ? t("sessionMenuUnarchive") : t("sessionMenuArchive")}
        </button>
        {processId && onTerminate && (
          <button
            type="button"
            onClick={handleTerminate}
            disabled={isTerminating}
            className={`${styles.dangerItem} ${styles.terminateButton}`}
          >
            <TerminateIcon />
            {isTerminating
              ? t("sessionMenuTerminating")
              : t("sessionMenuTerminate")}
          </button>
        )}
      </SessionMenuGroup>
    </div>
  );

  // Render dropdown via portal when using fixed positioning to escape overflow clipping
  const renderDropdown = () => {
    if (useFixedPositioning) {
      return createPortal(dropdownContent, document.body);
    }
    return dropdownContent;
  };

  return (
    <div className={wrapperClasses} ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        className={[styles.trigger, "session-menu-trigger", triggerClassName]
          .filter(Boolean)
          .join(" ")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleToggleOpen();
        }}
        aria-label={t("sessionMenuOptions")}
        aria-expanded={isOpen}
      >
        {useEllipsisIcon ? (
          <MoreHorizontalIcon size={TRIGGER_ICON_SIZE} />
        ) : (
          <ChevronDownIcon size={TRIGGER_ICON_SIZE} />
        )}
      </button>
      {isOpen && renderDropdown()}
    </div>
  );
}
