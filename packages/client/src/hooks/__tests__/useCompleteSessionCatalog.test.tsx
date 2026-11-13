import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCompleteSessionCatalog } from "../useCompleteSessionCatalog";

function catalogFeed(loadMore = vi.fn(async () => {})) {
  return { loading: false, error: null, hasMore: true, loadMore };
}

describe("useCompleteSessionCatalog", () => {
  it("resumes after another query owner supplies rows following a settled empty attempt", async () => {
    const feed = catalogFeed();
    const { rerender } = renderHook(
      ({ rows }) => useCompleteSessionCatalog(feed, rows),
      { initialProps: { rows: 0 } },
    );
    await act(async () => {});
    expect(feed.loadMore).toHaveBeenCalledTimes(1);

    // Sidebar/bootstrap and the overview observe a shared retained query.
    // A settled request may precede the record subscription's next snapshot.
    rerender({ rows: 500 });
    await waitFor(() => expect(feed.loadMore).toHaveBeenCalledTimes(2));
    rerender({ rows: 1000 });
    await waitFor(() => expect(feed.loadMore).toHaveBeenCalledTimes(3));
  });

  it("stops settled pages with no progress instead of repeatedly requesting them", async () => {
    const feed = catalogFeed();
    const { rerender } = renderHook(
      ({ rows }) => useCompleteSessionCatalog(feed, rows),
      { initialProps: { rows: 500 } },
    );
    await act(async () => {});
    rerender({ rows: 500 });
    await act(async () => {});
    expect(feed.loadMore).toHaveBeenCalledTimes(1);
  });

  it("waits for the active page when shared records arrive during its request", async () => {
    let finish = () => {};
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const loadMore = vi
      .fn<() => Promise<void>>()
      .mockReturnValueOnce(pending)
      .mockResolvedValue(undefined);
    const feed = catalogFeed(loadMore);
    const { rerender } = renderHook(
      ({ rows }) => useCompleteSessionCatalog(feed, rows),
      { initialProps: { rows: 0 } },
    );
    rerender({ rows: 500 });
    expect(loadMore).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    await waitFor(() => expect(loadMore).toHaveBeenCalledTimes(2));
  });
});
