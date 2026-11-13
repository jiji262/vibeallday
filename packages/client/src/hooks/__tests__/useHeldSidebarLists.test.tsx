import { act, cleanup, renderHook } from "@testing-library/react";
import type { FocusEvent, PointerEvent } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useHeldSidebarLists } from "../useSidebarSessionOrder";

afterEach(cleanup);

const pointer = { pointerType: "mouse" } as PointerEvent<HTMLElement>;

describe("sidebar interaction before initial rows", () => {
  it("releases the old layout when an explicit project filter changes", () => {
    const { result, rerender } = renderHook(
      ({ scope, rows }) => useHeldSidebarLists({ recent: rows }, true, scope),
      { initialProps: { scope: "project-a", rows: [{ id: "a" }] } },
    );
    act(() => result.current.handlers.onPointerEnter?.(pointer));
    rerender({ scope: "project-b", rows: [{ id: "b" }] });
    expect(result.current.lists.recent).toEqual([{ id: "b" }]);
  });

  it.each([8, 20])(
    "keeps the target at the %i-row cutoff while user chronology changes",
    (limit) => {
      const rows = Array.from({ length: limit + 1 }, (_, index) => ({
        id: String(index),
      }));
      const { result, rerender } = renderHook(
        ({ rows }) => useHeldSidebarLists({ recent: rows }, true),
        { initialProps: { rows } },
      );
      act(() => result.current.handlers.onPointerEnter?.(pointer));
      rerender({ rows: [rows[limit]!, ...rows.slice(0, limit)] });
      expect(result.current.lists.recent.slice(0, limit)).toEqual(
        rows.slice(0, limit),
      );
      act(() => result.current.handlers.onPointerLeave?.(pointer));
      expect(result.current.lists.recent[0]?.id).toBe(String(limit));
    },
  );

  it("shows the first population under a stationary pointer, then preserves its order", () => {
    const { result, rerender } = renderHook(
      ({ rows }) => useHeldSidebarLists({ recent: rows }, true),
      { initialProps: { rows: [] as Array<{ id: string; title: string }> } },
    );
    act(() => result.current.handlers.onPointerEnter?.(pointer));
    rerender({
      rows: [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
      ],
    });
    expect(result.current.lists.recent.map(({ id }) => id)).toEqual(["a", "b"]);
    rerender({
      rows: [
        { id: "b", title: "New B" },
        { id: "c", title: "C" },
        { id: "a", title: "A" },
      ],
    });
    expect(result.current.lists.recent).toEqual([
      { id: "a", title: "A" },
      { id: "b", title: "New B" },
    ]);
    act(() => result.current.handlers.onPointerLeave?.(pointer));
    expect(result.current.lists.recent.map(({ id }) => id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("does not keep an empty hold after the interaction finishes before rows arrive", () => {
    const { result, rerender } = renderHook(
      ({ rows }) => useHeldSidebarLists({ recent: rows }, true),
      { initialProps: { rows: [] as Array<{ id: string }> } },
    );
    act(() => result.current.handlers.onPointerEnter?.(pointer));
    act(() => result.current.handlers.onPointerLeave?.(pointer));
    rerender({ rows: [{ id: "a" }] });
    rerender({ rows: [{ id: "b" }, { id: "a" }] });
    expect(result.current.lists.recent.map(({ id }) => id)).toEqual(["b", "a"]);
  });
});

describe("sidebar focus hold", () => {
  it("releases when the focused row is removed without a blur", () => {
    const sidebar = document.createElement("aside");
    const pendingRow = document.createElement("a");
    pendingRow.href = "#queued";
    sidebar.append(pendingRow);
    document.body.append(sidebar);
    try {
      const { result, rerender } = renderHook(
        ({ rows }) => useHeldSidebarLists({ recent: rows }, true),
        { initialProps: { rows: [{ id: "a" }] } },
      );
      pendingRow.focus();
      act(() =>
        result.current.handlers.onFocusCapture?.({
          currentTarget: sidebar,
        } as FocusEvent<HTMLElement>),
      );
      // The queued item starts: its row leaves the DOM, focus falls to body.
      pendingRow.remove();
      rerender({ rows: [{ id: "started" }, { id: "a" }] });
      expect(result.current.lists.recent.map(({ id }) => id)).toEqual([
        "started",
        "a",
      ]);
    } finally {
      sidebar.remove();
    }
  });

  it("keeps holding while focus stays inside", () => {
    const sidebar = document.createElement("aside");
    const row = document.createElement("a");
    row.href = "#a";
    sidebar.append(row);
    document.body.append(sidebar);
    try {
      const { result, rerender } = renderHook(
        ({ rows }) => useHeldSidebarLists({ recent: rows }, true),
        { initialProps: { rows: [{ id: "a" }] } },
      );
      row.focus();
      act(() =>
        result.current.handlers.onFocusCapture?.({
          currentTarget: sidebar,
        } as FocusEvent<HTMLElement>),
      );
      rerender({ rows: [{ id: "new" }, { id: "a" }] });
      expect(result.current.lists.recent.map(({ id }) => id)).toEqual(["a"]);
    } finally {
      sidebar.remove();
    }
  });
});
