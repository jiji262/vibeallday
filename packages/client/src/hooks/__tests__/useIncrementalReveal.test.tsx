import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useIncrementalReveal } from "../useIncrementalReveal";

function ProjectList() {
  const { visible, hasMore, showMore, sentinelRef } = useIncrementalReveal(
    95,
    30,
    "projects",
  );
  return (
    <>
      <ul>
        {Array.from({ length: visible }, (_, index) => (
          <li key={index}>{index}</li>
        ))}
      </ul>
      {hasMore && (
        <div ref={sentinelRef}>
          <button type="button" onClick={showMore}>
            Show more
          </button>
        </div>
      )}
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps revealing pages while the sentinel remains inside the prefetch margin", async () => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      private active = false;
      constructor(private callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        this.active = true;
        // A real observer sends an initial observation but no further threshold
        // crossing when the sentinel remains intersecting after a page loads.
        queueMicrotask(() => {
          if (this.active)
            this.callback(
              [{ target, isIntersecting: true } as IntersectionObserverEntry],
              this as unknown as IntersectionObserver,
            );
        });
      }
      disconnect() {
        this.active = false;
      }
    },
  );
  await act(async () => {
    render(<ProjectList />);
  });
  expect(screen.getAllByRole("listitem")).toHaveLength(95);
  expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
});
