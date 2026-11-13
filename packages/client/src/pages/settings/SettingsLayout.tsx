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
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { LoadingState } from "../../components/garden/LoadingState";
import { Notice } from "../../components/garden/Notice";
import { PageHeader } from "../../components/PageHeader";
import { PageIntro } from "../../components/shell/PageIntro";
import { pageWidthClass } from "../../components/shell/pageWidth";
import { useRemoteBasePath } from "../../hooks/useRemoteBasePath";
import { useActingPrincipal } from "../../hooks/useActingPrincipal";
import { useVersion } from "../../hooks/useVersion";
import { limitedUserMaySeeSettingsCategory } from "../../lib/limitedUserSettings";
import { useI18n } from "../../i18n";
import { getSettingsCategories } from "../../i18n-settings";
import { MainContent, useNavigationLayout } from "../../layouts";
import { SettingsBackupActions } from "./SettingsBackupActions";
import { SettingsClipboardTransfer } from "./SettingsClipboardTransfer";
import { SettingsHome, SettingsOverview } from "./SettingsHome";
import { SettingsLayoutRail } from "./SettingsLayoutRail";
import {
  type SettingsDetailCrumb,
  SettingsDetailCrumbProvider,
  SettingsPane,
} from "./SettingsPane";
import {
  SettingsSearchBar,
  useSettingsSearchMatchValues,
} from "./SettingsSearchBar";
import { SettingsJumpTargetProvider } from "./SettingsSearchContext";
import { SettingsSearchResults } from "./SettingsSearchResults";
import {
  SettingsPaneTitleProvider,
  useSettingsPaneTitleRegistration,
} from "./SettingsPaneTitleContext";
import {
  SettingsUndoProvider,
  useSettingsUndoRegistration,
} from "./SettingsUndoContext";
import { SettingsUndoButton } from "./SettingsUndoButton";
import { useSettingsUndoToast } from "./SettingsUndoToast";
import { CATEGORY_COMPONENTS } from "./settingsCategoryComponents";
import { groupSettingsCategories } from "./settingsGroups";
import type { SettingsCategory } from "./types";
import styles from "./SettingsLayout.module.css";

// Reserve the 272px category rail and responsive page insets; detail
// controls wrap within the remaining pane's container width.
export const SETTINGS_TWO_COLUMN_MIN_WIDTH = 700;

const IMPORT_EXPORT_CATEGORY_ID = "import-export";

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
  const [detailCrumb, setDetailCrumb] = useState<SettingsDetailCrumb | null>(
    null,
  );
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

  // The settings index is the overview (desktop panel, phone home); no
  // category is opened on the user's behalf.
  const effectiveCategory = category;

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
    if (detailCrumb) {
      navigate(detailCrumb.backTo);
    } else if (shouldPopSettingsDetailBack(location.state)) {
      navigate(-1);
    } else {
      navigate(`${basePath}/settings`, { replace: !!category });
    }
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

  const handleOverviewClick = useCallback(() => {
    setSearchQuery("");
    navigate(`${basePath}/settings`, {
      replace: useTwoColumnSettings && !!category,
    });
  }, [basePath, category, navigate, useTwoColumnSettings]);

  const groups = groupSettingsCategories(visibleCategories);
  // Once an Import/Export category exists it owns backup and transfer, and
  // the navigation stops carrying its own copies.
  const hasImportExportCategory = visibleCategories.some(
    (item) => item.id === IMPORT_EXPORT_CATEGORY_ID,
  );
  const transferTools = hasImportExportCategory ? null : (
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
      <LoadingState label={t("loading")} variant="compact" />
    ) : (
      <Notice tone="info">
        {unservedCategory.requires.unsupportedMessage}
      </Notice>
    );
  const categoryPane = CategoryComponent ? (
    <CategoryComponent />
  ) : (
    unservedCategoryAnswer
  );

  // Pane title for the crumb and the intro: the pane registers it via
  // useSettingsPaneTitle; fall back to the category label until that
  // registers (and for the rare pane that sets nothing).
  const resolvedPaneTitle =
    paneTitle ?? activeCategory?.label ?? t("pageTitleSettings");
  const paneLede =
    effectiveCategory === "model"
      ? t("modelSettingsSessionDefaultsDescription")
      : activeCategory?.description;
  const settingsTitle = t("pageTitleSettings");
  const settingsRoot = `${basePath}/settings`;
  const paneCrumbs = !activeCategory
    ? [
        { label: settingsTitle, to: settingsRoot },
        { label: t("settingsOverviewTitle") },
      ]
    : detailCrumb
      ? [
          { label: settingsTitle, to: settingsRoot },
          {
            label: resolvedPaneTitle,
            to: detailCrumb.backTo,
            title: resolvedPaneTitle,
          },
          { label: detailCrumb.label, title: detailCrumb.label },
        ]
      : [
          { label: settingsTitle, to: settingsRoot },
          { label: resolvedPaneTitle, title: resolvedPaneTitle },
        ];

  // The single per-pane Undo affordance: panes register via useSettingsUndo.
  // Keep the button's header footprint even while hidden so settings rows do
  // not shift when a field first becomes undoable.
  useSettingsUndoToast(undoRegistration, resolvedPaneTitle);
  const undoButton = (
    <SettingsUndoButton
      registration={undoRegistration}
      paneTitle={resolvedPaneTitle}
    />
  );

  const paneIntro = <PageIntro title={resolvedPaneTitle} lede={paneLede} />;
  const pane = (
    <SettingsJumpTargetProvider value={jumpTargetValue}>
      <SettingsPaneTitleProvider value={setPaneTitle}>
        <SettingsUndoProvider value={setUndoRegistration}>
          <SettingsDetailCrumbProvider value={setDetailCrumb}>
            <SettingsPane key={effectiveCategory}>{categoryPane}</SettingsPane>
          </SettingsDetailCrumbProvider>
        </SettingsUndoProvider>
      </SettingsPaneTitleProvider>
    </SettingsJumpTargetProvider>
  );

  // An unknown category, or one withheld from this principal, has no pane
  // and no rail entry: answer its URL with the settings index instead.
  if (principalResolved && effectiveCategory && !activeCategory) {
    return <Navigate to={settingsRoot} replace />;
  }

  // Narrow settings: category list OR category detail (not both)
  if (!useTwoColumnSettings) {
    if (!category) {
      return (
        <MainContent
          isWideScreen={isWideScreen}
          innerRef={settingsContainerRef}
        >
          <PageHeader
            title={settingsTitle}
            intro="content"
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
              overviewReady={principalResolved}
            />
          </main>
        </MainContent>
      );
    }

    return (
      <MainContent isWideScreen={isWideScreen} innerRef={settingsContainerRef}>
        <PageHeader
          title={resolvedPaneTitle}
          intro="content"
          breadcrumbs={paneCrumbs}
          onOpenSidebar={openSidebar}
          showBack
          onBack={handleBack}
          actions={undoButton}
        />
        <main
          ref={setSettingsScrollContainerRef}
          className="page-scroll-container"
        >
          <div className={`page-content-inner ${pageWidthClass("narrow")}`}>
            {paneIntro}
            {pane}
          </div>
        </main>
      </MainContent>
    );
  }

  const panelBody = searchResults ? (
    <>
      <PageIntro title={settingsTitle} />
      {searchResults}
    </>
  ) : activeCategory ? (
    <>
      {paneIntro}
      {pane}
    </>
  ) : principalResolved ? (
    <SettingsOverview groups={groups} onSelect={handleCategoryClick} />
  ) : null;
  const overviewOpen = !searchActive && !activeCategory;
  const headerActions = overviewOpen ? (
    <span className={styles.savedNote}>
      {t("settingsOverviewSavedInstantly")}
    </span>
  ) : (
    undoButton
  );

  // Desktop: the settings rail on the left (it stands in for the app
  // sidebar), the open pane or the overview on the right.
  return (
    <MainContent isWideScreen={isWideScreen} innerRef={settingsContainerRef}>
      <div className={`settings-two-column ${styles.twoColumn}`}>
        <SettingsLayoutRail
          searchBar={searchBar}
          groups={groups}
          activeId={effectiveCategory}
          overviewActive={!category}
          searchActive={searchActive}
          onSelect={handleCategoryClick}
          onOverview={handleOverviewClick}
          extras={transferTools}
        />
        <div className={styles.column}>
          <PageHeader
            title={
              searchActive || !activeCategory
                ? settingsTitle
                : resolvedPaneTitle
            }
            intro="content"
            breadcrumbs={searchActive ? undefined : paneCrumbs}
            onOpenSidebar={openSidebar}
            isWideScreen={isWideScreen}
            actions={headerActions}
          />
          <main
            ref={setSettingsScrollContainerRef}
            className="page-scroll-container"
          >
            <div
              className={`page-content-inner settings-content-panel ${styles.panel}`}
            >
              {panelBody}
            </div>
          </main>
        </div>
      </div>
    </MainContent>
  );
}
