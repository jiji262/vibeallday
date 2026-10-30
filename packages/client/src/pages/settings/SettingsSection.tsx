import {
  createContext,
  type FormEventHandler,
  type ReactNode,
  useContext,
  useMemo,
} from "react";
import type { SettingScope } from "../../components/garden/ScopeTag";
import {
  renderSettingsSearchHighlight,
  SettingsSearchScopeProvider,
  useSettingsSearchScope,
} from "./SettingsSearchContext";
import { settingsTextMatches } from "./settingsSearchMatch";

const SettingsDefaultScopeContext = createContext<SettingScope | undefined>(
  undefined,
);

/** Storage scope a SettingsItem inherits from its nearest scoped section. */
export function useSettingsDefaultScope(): SettingScope | undefined {
  return useContext(SettingsDefaultScopeContext);
}

export interface SettingsSectionProps {
  /** Section heading; searchable, rendered as the section `<h2>`. */
  title?: string;
  /** Section lede; searchable, rendered as `.settings-section-description`. */
  description?: string;
  /** Extra search-only terms; never rendered. */
  keywords?: string[];
  /** Extra classes appended to `settings-section`. */
  className?: string;
  /** One explicit-save group; native Enter submission keeps actions with fields. */
  onSubmit?: FormEventHandler<HTMLElement>;
  /** Default storage scope tag for the rows inside (a row may override it). */
  scope?: SettingScope;
  children?: ReactNode;
}

/**
 * One settings section: optional `<h2>` + description ahead of its groups
 * and rows. In search results, a title/description match surfaces the whole
 * section operable (child rows stop filtering); otherwise children filter
 * individually and CSS hides the section when nothing inside matched.
 */
export function SettingsSection({
  title,
  description,
  keywords,
  className,
  onSubmit,
  scope: defaultScope,
  children,
}: SettingsSectionProps) {
  const scope = useSettingsSearchScope();
  const sectionMatched = scope
    ? scope.sectionMatched ||
      settingsTextMatches(scope.query, [
        title,
        description,
        ...(keywords ?? []),
      ])
    : false;

  const childScope = useMemo(
    () =>
      scope
        ? {
            ...scope,
            sectionMatched,
            sectionTitle: title ?? scope.sectionTitle,
          }
        : null,
    [scope, sectionMatched, title],
  );

  const sectionClassName = [
    "settings-section",
    className,
    scope && sectionMatched ? "settings-search-section-match" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const SectionElement = onSubmit ? "form" : "section";
  const body = (
    <SectionElement
      className={sectionClassName}
      onSubmit={onSubmit}
      noValidate={onSubmit ? true : undefined}
    >
      {title && (
        <h2>
          {scope ? renderSettingsSearchHighlight(title, scope.query) : title}
        </h2>
      )}
      {description && (
        <p className="settings-section-description">
          {scope
            ? renderSettingsSearchHighlight(description, scope.query)
            : description}
        </p>
      )}
      {children}
    </SectionElement>
  );

  const scoped = defaultScope ? (
    <SettingsDefaultScopeContext.Provider value={defaultScope}>
      {body}
    </SettingsDefaultScopeContext.Provider>
  ) : (
    body
  );
  if (!childScope) return scoped;
  return (
    <SettingsSearchScopeProvider value={childScope}>
      {scoped}
    </SettingsSearchScopeProvider>
  );
}
