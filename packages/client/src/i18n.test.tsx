// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, useI18n } from "./i18n";
import { UI_KEYS } from "./lib/storageKeys";

vi.mock("./i18n/zh-CN.json", () => ({
  default: {
    pageTitleProjects: "部分翻译的项目",
  },
}));

function TranslationProbe() {
  const { t } = useI18n();

  return (
    <>
      <div data-testid="translated">{t("pageTitleProjects")}</div>
      <div data-testid="fallback">{t("pageTitleSettings")}</div>
    </>
  );
}

describe("I18nProvider", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("falls back to English for missing non-English messages", async () => {
    localStorage.setItem(UI_KEYS.locale, "zh-CN");

    render(
      <I18nProvider>
        <TranslationProbe />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("translated").textContent).toBe(
        "部分翻译的项目",
      );
    });
    expect(screen.getByTestId("fallback").textContent).toBe("Settings");
  });
});
