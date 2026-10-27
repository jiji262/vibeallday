import {
  BROWSER_SETTINGS_BACKUP_CAPABILITY,
  type ServerCapabilitySource,
  serverHasCapability,
} from "@vibeallday/shared";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { useRemoteBasePath } from "../../hooks/useRemoteBasePath";
import { useActingPrincipal } from "../../hooks/useActingPrincipal";
import { useVersion } from "../../hooks/useVersion";
import { limitedUserMaySeeSettingsCategory } from "../../lib/limitedUserSettings";
import { useI18n } from "../../i18n";
import { getSettingsCategories } from "../../i18n-settings";
import { MainContent, useNavigationLayout } from "../../layouts";
import { SettingsBackupActions } from "./SettingsBackupActions";
import { SettingsClipboardTransfer } from "./SettingsClipboardTransfer";
import { SettingsGroupList } from "./SettingsGroupList";
import { SettingsHome } from "./SettingsHome";
import { SettingsHostCard } from "./SettingsHostCard";
import { SettingsPane } from "./SettingsPane";
import {
  SettingsSearchBar,
  useSettingsSearchMatchValues,
} from "./SettingsSearchBar";
import { SettingsJumpTargetProvider } from "./SettingsSearchContext";
import { SettingsSearchResults } from "./SettingsSearchResults";
import { SettingsSection } from "./SettingsSection";
import {
  SettingsPaneTitleProvider,
  useSettingsPaneTitleRegistration,
} from "./SettingsPaneTitleContext";
import {
  SettingsUndoProvider,
  useSettingsUndoRegistration,
} from "./SettingsUndoContext";
import { SettingsUndoButton } from "./SettingsUndoButton";
import { CATEGORY_COMPONENTS } from "./settingsCategoryComponents";
import { groupSettingsCategories } from "./settingsGroups";
import type { SettingsCategory } from "./types";
import styles from "./SettingsLayout.module.css";

// Reserve the 256px category rail, 16px gap and responsive page insets;
// detail controls wrap within the remaining pane's container width.
export const SETTINGS_TWO_COLUMN_MIN_WIDTH = 700;

export function shouldUseSettingsTwoColumn(availableWidth: number): boolean {
  return availableWidth >= SETTINGS_TWO_COLUMN_MIN_WIDTH;
}

interface SettingsDetailNavigationState {
  settingsDetailOpenedFromList?: true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

export function createSettingsDetailNavigationState(
  openedFromList: boolean,
): SettingsDetailNavigationState | undefined {
  return openedFromList ? { settingsDetailOpenedFromList: true } : undefined;
}

export function shouldPopSettingsDetailBack(state: unknown): boolean {
  return isRecord(state) && state.settingsDetailOpenedFromList === true;
}

export function shouldReplaceSettingsCategoryNavigation({
  currentCategory,
  useTwoColumnSettings,
}: {
  currentCategory: string | undefined;
  useTwoColumnSettings: boolean;
}): boolean {
  return useTwoColumnSettings && !!currentCategory;
}

function getInitialSettingsWidth(): number {
  return typeof window === "undefined" ? 1200 : window.innerWidth;
}

function useSettingsContainerWidth(): [
  (element: HTMLDivElement | null) => void,
  number,
] {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(getInitialSettingsWidth);

  useLayoutEffect(() => {
    if (!container) {
      return;
    }

    const updateWidth = () => {
      setWidth(container.clientWidth);
    };
    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  return [setContainer, width];
}

/** Whether the connected server serves this settings category's pane. */
function settingsCategoryServed(
  category: SettingsCategory,
  versionInfo: ServerCapabilitySource | null | undefined,
): boolean {
  return (
    !category.requires ||
    category.requires.anyCapability.some((capability) =>
      serverHasCapability(versionInfo, capability),
    )
  );
}

function scrollElementToTop(element: HTMLElement): void {
  if (typeof element.scrollTo === "function") {
    element.scrollTo({ top: 0, behavior: "auto" });
    return;
  }

  element.scrollTop = 0;
}

export function SettingsLayout() {
  const { t } = useI18n();
  const { category } = useParams<{ category?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = useRemoteBasePath();
  const { openSidebar, isWideScreen } = useNavigationLayout();
  const [settingsContainerRef, settingsContainerWidth] =
    useSettingsContainerWidth();
  const settingsScrollContainerRef = useRef<HTMLElement | null>(null);
  const useTwoColumnSettings = shouldUseSettingsTwoColumn(
    settingsContainerWidth,
  );
  const { version: versionInfo, loading: versionLoading } = useVersion();
  const { principal: actingPrincipal, resolved: principalResolved } =
    useActingPrincipal();
  const serverBacksUpBrowserSettings = serverHasCapability(
    versionInfo,
    BROWSER_SETTINGS_BACKUP_CAPABILITY,
  );
  const {
    registration: undoRegistration,
    setRegistration: setUndoRegistration,
  } = useSettingsUndoRegistration();
  const { title: paneTitle, setTitle: setPaneTitle } =
    useSettingsPaneTitleRegistration();
  const [searchQuery, setSearchQuery] = useState("");
  const [matchValues, setMatchValues] = useSettingsSearchMatchValues();
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const searchActive = searchQuery.trim() !== "";

  // One-shot jump target: a search result's jump link navigates to the
  // category pane with the row id in navigation state; the matching
  // SettingsItem scrolls itself into view, flashes, and consumes it.
  const [jumpTarget, setJumpTarget] = useState<string | null>(null);
  useEffect(() => {
    const state: unknown = location.state;
    if (isRecord(state) && typeof state.settingsJumpTarget === "string") {
      setJumpTarget(state.settingsJumpTarget);
    }
  }, [location.state]);
  const consumeJumpTarget = useCallback(() => setJumpTarget(null), []);
  const jumpTargetValue = useMemo(
    () => ({ target: jumpTarget, consume: consumeJumpTarget }),
    [jumpTarget, consumeJumpTarget],
  );

  const allCategories = getSettingsCategories((key) => t(key as never));
  const categories = allCategories.filter((item) =>
    settingsCategoryServed(item, versionInfo),
  );
  // A limited user keeps only the categories they can actually operate; the
  // rest are inert or never finish loading for them. topics/limited-users.md
  // § Delivery v1. Until the server names the principal, its placeholder is
  // the superuser, so no category is offered or mounted: a superuser-only
  // pane would otherwise send its refused requests first.
  const actingAsLimitedUser = actingPrincipal.username !== null;
  const visibleCategories = !principalResolved
    ? []
    : actingAsLimitedUser
      ? categories.filter((item) => limitedUserMaySeeSettingsCategory(item.id))
      : categories;
  // The backup slot is server-wide and `/api/browser-settings-backup` is
  // denied for a limited user, so the buttons would only ever fail for them.
  const canBackUpBrowserSettings =
    serverBacksUpBrowserSettings && principalResolved && !actingAsLimitedUser;

  // Two-column settings can fit before the persistent app sidebar can.
  const effectiveCategory =
    category || (useTwoColumnSettings ? visibleCategories[0]?.id : undefined);

  const setSettingsScrollContainerRef = useCallback(
    (element: HTMLElement | null) => {
      settingsScrollContainerRef.current = element;
    },
    [],
  );

  const scrollSettingsToTop = useCallback(() => {
    const element = settingsScrollContainerRef.current;
    if (element) {
      scrollElementToTop(element);
    }
  }, []);

  useLayoutEffect(() => {
    void location.key;
    scrollSettingsToTop();
  }, [location.key, scrollSettingsToTop]);

  const navigateToSettingsRoot = () => {
    if (shouldPopSettingsDetailBack(location.state)) {
      navigate(-1);
    } else {
      navigate(`${basePath}/settings`, { replace: !!category });
    }
    scrollSettingsToTop();
  };

  const handleSettingsTitleClick = () => {
    if (category) {
      navigateToSettingsRoot();
      return;
    }

    navigate(`${basePath}/settings`, { replace: true });
    scrollSettingsToTop();
  };

  const handleCategoryClick = useCallback(
    (categoryId: string, jumpToItemId?: string) => {
      setSearchQuery("");
      const openedFromList =
        !category || shouldPopSettingsDetailBack(location.state);
      const navigationState =
        createSettingsDetailNavigationState(openedFromList);
      navigate(`${basePath}/settings/${categoryId}`, {
        replace: shouldReplaceSettingsCategoryNavigation({
          currentCategory: category,
          useTwoColumnSettings,
        }),
        state: jumpToItemId
          ? { ...navigationState, settingsJumpTarget: jumpToItemId }
          : navigationState,
      });
    },
    [basePath, category, location.state, navigate, useTwoColumnSettings],
  );

  const searchBar = (
    <SettingsSearchBar
      query={searchQuery}
      onQueryChange={setSearchQuery}
      matchValues={matchValues}
      onMatchValuesChange={setMatchValues}
    />
  );

  const groups = groupSettingsCategories(visibleCategories);
  const transferTools = (
    <>
      {canBackUpBrowserSettings && <SettingsBackupActions />}
      {principalResolved && <SettingsClipboardTransfer />}
    </>
  );

  const searchResults =
    searchActive && principalResolved ? (
      <SettingsSearchResults
        categories={visibleCategories}
        components={CATEGORY_COMPONENTS}
        query={deferredSearchQuery || searchQuery.trim()}
        matchValues={matchValues}
        onJumpToItem={handleCategoryClick}
        onOpenCategory={handleCategoryClick}
      />
    ) : null;

  const handleBack = () => {
    navigateToSettingsRoot();
  };

  // A category withheld from this principal does not render even when its URL
  // is typed directly: the pane behind it cannot load for them. A category the
  // server does not serve answers a typed URL with its own unsupported-server
  // message, and its pane never mounts to send requests that server lacks.
  // Until the version arrives, "unsupported" is not yet known.
  const withheldFromPrincipal =
    actingAsLimitedUser &&
    effectiveCategory !== undefined &&
    !limitedUserMaySeeSettingsCategory(effectiveCategory);
  const unservedCategory =
    principalResolved && !withheldFromPrincipal
      ? allCategories.find(
          (c) =>
            c.id === effectiveCategory &&
            !settingsCategoryServed(c, versionInfo),
        )
      : undefined;
  const activeCategory =
    visibleCategories.find((c) => c.id === effectiveCategory) ??
    unservedCategory;
  const CategoryComponent =
    effectiveCategory &&
    principalResolved &&
    !withheldFromPrincipal &&
    !unservedCategory
      ? CATEGORY_COMPONENTS[effectiveCategory]
      : null;
  const unservedCategoryAnswer =
    !unservedCategory?.requires ? null : !versionInfo && versionLoading ? (
      <SettingsSection description={t("loading")} />
    ) : (
      <SettingsSection
        title={unservedCategory.label}
        description={unservedCategory.description}
      >
        <p className="settings-hint">
          {unservedCategory.requires.unsupportedMessage}
        </p>
      </SettingsSection>
    );
  const categoryPane = CategoryComponent ? (
    <CategoryComponent />
  ) : (
    unservedCategoryAnswer
  );

  // Top-strip title for the open pane: the pane registers it via
  // useSettingsPaneTitle; fall back to the category label until that
  // registers (and for the rare pane that sets nothing).
  const resolvedPaneTitle =
    paneTitle ?? activeCategory?.label ?? t("pageTitleSettings");
  const breadcrumbDescription =
    effectiveCategory === "model"
      ? t("modelSettingsSessionDefaultsDescription")
      : null;

  // Settings breadcrumb shown in the header strip (two-column): a clickable
  // "Settings" root plus the active pane title, so the strip names the page
  // instead of just "Settings".
  const settingsBreadcrumb = (
    <span className={`settings-breadcrumb ${styles.breadcrumb}`}>
      <button
        type="button"
        className="session-title settings-breadcrumb-root"
        onClick={handleSettingsTitleClick}
      >
        {t("pageTitleSettings")}
      </button>
      <span className="settings-breadcrumb-sep" aria-hidden="true">
        ›
      </span>
      <span
        className="settings-breadcrumb-current"
        role="heading"
        aria-level={1}
      >
        {resolvedPaneTitle}
      </span>
      {breadcrumbDescription && (
        <span className="settings-breadcrumb-description">
          {breadcrumbDescription}
        </span>
      )}
    </span>
  );

  // The single per-pane Undo affordance: panes register via useSettingsUndo.
  // Keep the button's header footprint even while hidden so settings rows do
  // not shift when a field first becomes undoable.
  const undoButton = (
    <SettingsUndoButton
      registration={undoRegistration}
      paneTitle={resolvedPaneTitle}
    />
  );

  // Narrow settings: category list OR category detail (not both)
  if (!useTwoColumnSettings) {
    if (!category) {
      // Show category list
      return (
        <MainContent
          isWideScreen={isWideScreen}
          innerRef={settingsContainerRef}
        >
          <PageHeader
            title={t("pageTitleSettings")}
            onTitleClick={handleSettingsTitleClick}
            onOpenSidebar={openSidebar}
            isWideScreen={isWideScreen}
          />
          <main
            ref={setSettingsScrollContainerRef}
            className="page-scroll-container"
          >
            <SettingsHome
              searchBar={searchBar}
              searchResults={searchResults}
              groups={groups}
              onSelect={handleCategoryClick}
              extras={transferTools}
            />
          </main>
        </MainContent>
      );
    }

    // Show category detail with back button
    return (
      <MainContent isWideScreen={isWideScreen} innerRef={settingsContainerRef}>
        <PageHeader
          title={resolvedPaneTitle}
          onOpenSidebar={openSidebar}
          showBack
          onBack={handleBack}
          actions={undoButton}
        />
        <main
          ref={setSettingsScrollContainerRef}
          className="page-scroll-container"
        >
          <div className="page-content-inner">
            <SettingsJumpTargetProvider value={jumpTargetValue}>
              <SettingsPaneTitleProvider value={setPaneTitle}>
                <SettingsUndoProvider value={setUndoRegistration}>
                  <SettingsPane key={effectiveCategory}>
                    {categoryPane}
                  </SettingsPane>
                </SettingsUndoProvider>
              </SettingsPaneTitleProvider>
            </SettingsJumpTargetProvider>
          </div>
        </main>
      </MainContent>
    );
  }

  // Desktop: two-column layout with category list on left, content on right
  return (
    <MainContent isWideScreen={isWideScreen} innerRef={settingsContainerRef}>
      <PageHeader
        title={resolvedPaneTitle}
        titleElement={settingsBreadcrumb}
        onOpenSidebar={openSidebar}
        isWideScreen={isWideScreen}
        actions={undoButton}
      />
      <main
        ref={setSettingsScrollContainerRef}
        className="page-scroll-container"
      >
        <div className="settings-two-column">
          <nav className="settings-category-nav">
            {searchBar}
            <SettingsHostCard compact />
            <SettingsGroupList
              groups={groups}
              activeId={searchActive ? undefined : effectiveCategory}
              rail
              onSelect={handleCategoryClick}
              extras={transferTools}
            />
          </nav>
          <div className="settings-content-panel">
            {searchResults ?? (
              <SettingsJumpTargetProvider value={jumpTargetValue}>
                <SettingsPaneTitleProvider value={setPaneTitle}>
                  <SettingsUndoProvider value={setUndoRegistration}>
                    <SettingsPane key={effectiveCategory}>
                      {categoryPane}
                    </SettingsPane>
                  </SettingsUndoProvider>
                </SettingsPaneTitleProvider>
              </SettingsJumpTargetProvider>
            )}
          </div>
        </div>
      </main>
    </MainContent>
  );
}
