import { describe, expect, it } from "vitest";
import en from "./en.json";
import zhCN from "./zh-CN.json";

/**
 * zh-CN is deliberately partial (missing keys fall back to English), so full
 * parity must NOT be asserted — only that no translation keeps a key en.json
 * no longer has, which would be dead weight that can never render.
 */
describe("locale catalogs", () => {
  const enKeys = new Set(Object.keys(en));
  for (const [name, catalog] of [["zh-CN", zhCN]] as const) {
    it(`${name} has no keys absent from en`, () => {
      const stale = Object.keys(catalog).filter((key) => !enKeys.has(key));
      expect(stale).toEqual([]);
    });
  }
});
