// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assistantMessage,
  installMessageListTestEnvironment,
  userMessage,
} from "./MessageList.test-support";
import { setConversationViewPreference } from "../../hooks/useConversationView";
import { MessageList } from "../MessageList";

installMessageListTestEnvironment();

const originalIntersectionObserver = window.IntersectionObserver;

interface ObservedIntersection {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  target: Element | null;
}

function installIntersectionObserverMock(): ObservedIntersection {
  const observed: ObservedIntersection = {
    callback: () => {},
    target: null,
  };

  class IntersectionObserverMock {
    constructor(
      callback: IntersectionObserverCallback,
      options?: IntersectionObserverInit,
    ) {
      observed.callback = callback;
      observed.options = options;
    }

    observe(target: Element) {
      observed.target = target;
    }

    unobserve() {}

    disconnect() {}
  }

  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    value: IntersectionObserverMock,
  });
  return observed;
}

function reportIntersection(
  observed: ObservedIntersection,
  isIntersecting: boolean,
) {
  if (!observed.target) throw new Error("No pagination boundary observed");
  observed.callback(
    [
      {
        target: observed.target,
        isIntersecting,
        intersectionRatio: isIntersecting ? 1 : 0,
      } as IntersectionObserverEntry,
    ],
    {} as IntersectionObserver,
  );
}

// Runs animation frames on demand, so a case decides exactly which scheduled
// scroll work has happened before it asserts.
function installFrameQueue() {
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    nextId += 1;
    frames.set(nextId, callback);
    return nextId;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id);
  });
  return async () => {
    for (let round = 0; round < 20 && frames.size > 0; round += 1) {
      const batch = [...frames.values()];
      frames.clear();
      await act(async () => {
        for (const frame of batch) frame(performance.now());
      });
    }
  };
}

afterEach(() => {
  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    value: originalIntersectionObserver,
  });
});

describe("MessageList older-page pagination", () => {
  it("loads each visible older-page cursor once", () => {
    const observed = installIntersectionObserverMock();
    const onLoadOlderMessages = vi.fn();
    const messages = [
      userMessage("user-2", "Current request"),
      assistantMessage("assistant-2", "Current answer"),
    ];
    const { container, rerender } = render(
      <MessageList
        messages={messages}
        hasOlderMessages={true}
        olderMessagesCursor="user-2"
        onLoadOlderMessages={onLoadOlderMessages}
      />,
    );

    expect(observed.target?.classList.contains("load-older-messages")).toBe(
      true,
    );
    expect(observed.options?.root).toBe(container);

    act(() => reportIntersection(observed, true));
    act(() => reportIntersection(observed, true));
    expect(onLoadOlderMessages).toHaveBeenCalledTimes(1);

    rerender(
      <MessageList
        messages={[
          userMessage("user-1", "Older request"),
          assistantMessage("assistant-1", "Older answer"),
          ...messages,
        ]}
        hasOlderMessages={true}
        olderMessagesCursor="user-1"
        onLoadOlderMessages={onLoadOlderMessages}
      />,
    );
    act(() => reportIntersection(observed, true));
    expect(onLoadOlderMessages).toHaveBeenCalledTimes(1);
    act(() => reportIntersection(observed, false));
    act(() => reportIntersection(observed, true));
    expect(onLoadOlderMessages).toHaveBeenCalledTimes(2);
  });

  it("allows a visible-boundary retry after the reader leaves and returns", () => {
    const observed = installIntersectionObserverMock();
    const onLoadOlderMessages = vi.fn();
    render(
      <MessageList
        messages={[userMessage("user-1", "Current request")]}
        hasOlderMessages={true}
        olderMessagesCursor="user-1"
        onLoadOlderMessages={onLoadOlderMessages}
      />,
    );

    act(() => reportIntersection(observed, true));
    act(() => reportIntersection(observed, false));
    act(() => reportIntersection(observed, true));
    expect(onLoadOlderMessages).toHaveBeenCalledTimes(2);
  });

  it("treats PageUp and previous-turn Home as explicit older demand", () => {
    const observed = installIntersectionObserverMock();
    const onLoadOlderMessages = vi.fn();
    const { container } = render(
      <MessageList
        messages={[userMessage("user-1", "Current request")]}
        hasOlderMessages={true}
        olderMessagesCursor="user-1"
        onLoadOlderMessages={onLoadOlderMessages}
      />,
    );
    Object.defineProperty(container, "scrollTop", {
      configurable: true,
      value: 0,
      writable: true,
    });

    act(() => reportIntersection(observed, true));
    expect(onLoadOlderMessages).toHaveBeenCalledTimes(1);

    const frameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });
    try {
      fireEvent.keyDown(container, { key: "PageUp", code: "PageUp" });
      expect(onLoadOlderMessages).toHaveBeenCalledTimes(2);
      fireEvent.keyDown(container, {
        key: "PageUp",
        code: "PageUp",
        repeat: true,
      });
      expect(onLoadOlderMessages).toHaveBeenCalledTimes(2);

      fireEvent.keyDown(window, { key: "Home", code: "Home" });
      expect(onLoadOlderMessages).toHaveBeenCalledTimes(3);
      fireEvent.keyDown(window, {
        key: "Home",
        code: "Home",
        repeat: true,
      });
      expect(onLoadOlderMessages).toHaveBeenCalledTimes(3);
    } finally {
      frameSpy.mockRestore();
    }
  });

  it("waits for the current page to settle before loading a new cursor", async () => {
    const observed = installIntersectionObserverMock();
    let resolveFirstLoad: (() => void) | undefined;
    const firstLoad = new Promise<void>((resolve) => {
      resolveFirstLoad = resolve;
    });
    const onLoadOlderMessages = vi
      .fn<() => void | Promise<void>>()
      .mockReturnValueOnce(firstLoad)
      .mockReturnValue(undefined);
    const messages = [userMessage("user-2", "Current request")];
    const { rerender } = render(
      <MessageList
        messages={messages}
        hasOlderMessages={true}
        olderMessagesCursor="user-2"
        onLoadOlderMessages={onLoadOlderMessages}
      />,
    );

    act(() => reportIntersection(observed, true));
    rerender(
      <MessageList
        messages={[userMessage("user-1", "Older request"), ...messages]}
        hasOlderMessages={true}
        olderMessagesCursor="user-1"
        onLoadOlderMessages={onLoadOlderMessages}
      />,
    );
    act(() => reportIntersection(observed, true));
    expect(onLoadOlderMessages).toHaveBeenCalledTimes(1);

    await act(async () => resolveFirstLoad?.());
    act(() => reportIntersection(observed, true));
    expect(onLoadOlderMessages).toHaveBeenCalledTimes(1);
    act(() => reportIntersection(observed, false));
    act(() => reportIntersection(observed, true));
    expect(onLoadOlderMessages).toHaveBeenCalledTimes(2);
  });

  it("yields between bounded semantic commits for a large older page", async () => {
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      value: undefined,
    });
    const frames: FrameRequestCallback[] = [];
    const frameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        frames.push(callback);
        return frames.length;
      });
    const cancelFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});
    let resolveLoad: (() => void) | undefined;
    const load = new Promise<void>((resolve) => {
      resolveLoad = resolve;
    });
    const current = [
      userMessage("user-current", "Current request"),
      assistantMessage("assistant-current", "Current answer"),
    ];
    const older = Array.from({ length: 80 }, (_, index) => [
      userMessage(`user-${index}`, `Older request ${index}`),
      assistantMessage(`assistant-${index}`, `Older answer ${index}`),
    ]).flat();

    try {
      const { container, rerender } = render(
        <MessageList
          messages={current}
          hasOlderMessages={true}
          olderMessagesCursor="user-current"
          onLoadOlderMessages={() => load}
        />,
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Load older messages" }),
      );
      rerender(
        <MessageList
          messages={[...older, ...current]}
          hasOlderMessages={false}
          onLoadOlderMessages={() => load}
        />,
      );
      await act(async () => resolveLoad?.());

      const countRows = () =>
        container.querySelectorAll("[data-render-id]").length;
      const firstCommitCount = countRows();
      expect(firstCommitCount).toBeGreaterThan(current.length);
      expect(firstCommitCount).toBeLessThan(older.length + current.length);

      let previousCount = firstCommitCount;
      while (frames.length > 0) {
        const pendingFrames = frames.splice(0);
        await act(async () => {
          for (const frame of pendingFrames) {
            frame(performance.now());
          }
          await Promise.resolve();
        });
        const nextCount = countRows();
        expect(nextCount).toBeGreaterThanOrEqual(previousCount);
        previousCount = nextCount;
      }
      expect(countRows()).toBe(older.length + current.length);
    } finally {
      frameSpy.mockRestore();
      cancelFrameSpy.mockRestore();
    }
  });

  it("keeps the manual button when visibility observation is unavailable", () => {
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      value: undefined,
    });
    const onLoadOlderMessages = vi.fn();
    render(
      <MessageList
        messages={[userMessage("user-1", "Current request")]}
        hasOlderMessages={true}
        olderMessagesCursor="user-1"
        onLoadOlderMessages={onLoadOlderMessages}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Load older messages" }),
    );
    expect(onLoadOlderMessages).toHaveBeenCalledTimes(1);
  });

  it("keeps explicit continuation available after the history safety boundary", () => {
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      value: undefined,
    });
    const onLoadOlderMessages = vi.fn();
    render(
      <MessageList
        messages={[userMessage("user-1", "Current request")]}
        hasOlderMessages={true}
        olderLoadContinuationRequired={true}
        onLoadOlderMessages={onLoadOlderMessages}
      />,
    );

    expect(
      screen.getByText(
        "Loaded a large history span without reaching an earlier user turn. Load older messages again to continue.",
      ),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Load older messages" }),
    );
    expect(onLoadOlderMessages).toHaveBeenCalledTimes(1);
  });

  // A three-turn tail can sit within the near-bottom band even at its top, so
  // the band alone must not pull a reader who has stopped following back down.
  it.each([
    ["scrolls up before the page loads", "before", 780],
    ["scrolls up while the page loads", "during", 780],
    ["keeps following", "never", 900],
  ] as const)(
    "a reader who %s keeps their place",
    async (_, scroll, landedTop) => {
      const observed = installIntersectionObserverMock();
      const flushFrames = installFrameQueue();
      const composerTarget = document.createElement("div");
      composerTarget.className = "session-input-inner";
      document.body.append(composerTarget);
      let resolveLoad: (() => void) | undefined;
      const load = new Promise<void>((resolve) => {
        resolveLoad = resolve;
      });
      const current = [
        userMessage("user-2", "Current request"),
        assistantMessage("assistant-2", "Current answer"),
      ];
      const { container, rerender } = render(
        <MessageList
          messages={current}
          hasOlderMessages={true}
          olderMessagesCursor="user-2"
          onLoadOlderMessages={() => load}
        />,
      );
      let scrollHeight = 620;
      Object.defineProperties(container, {
        scrollHeight: { configurable: true, get: () => scrollHeight },
        clientHeight: { configurable: true, value: 500 },
        scrollTop: { configurable: true, value: 120, writable: true },
      });
      const scrollUp = () => {
        fireEvent.wheel(container, { deltaY: -120 });
        container.scrollTop = 0;
        fireEvent.scroll(container);
      };
      const followControl = () =>
        screen.queryByRole("button", { name: "Follow latest session output" });

      if (scroll === "before") scrollUp();
      act(() => reportIntersection(observed, true));
      if (scroll === "during") scrollUp();
      // Run the frames scheduled at load start before the page lands.
      await flushFrames();
      expect(container.scrollTop).toBe(scroll === "never" ? 120 : 0);
      expect(followControl() !== null).toBe(scroll !== "never");

      scrollHeight = 1400;
      rerender(
        <MessageList
          messages={[
            userMessage("user-1", "Older request"),
            assistantMessage("assistant-1", "Older answer"),
            ...current,
          ]}
          hasOlderMessages={false}
          onLoadOlderMessages={() => load}
        />,
      );
      await act(async () => resolveLoad?.());

      expect(container.scrollTop).toBe(landedTop);
      expect(followControl() !== null).toBe(scroll !== "never");
      // A scroll event arriving after the restore is unmuted must not read
      // the prepend's scrollTop shift as the reader returning to the tail.
      await flushFrames();
      fireEvent.scroll(container);
      expect(followControl() !== null).toBe(scroll !== "never");
      composerTarget.remove();
    },
  );

  it("keeps a released reader's rows when the transcript view changes", async () => {
    const flushFrames = installFrameQueue();
    const composerTarget = document.createElement("div");
    composerTarget.className = "session-input-inner";
    document.body.append(composerTarget);
    const { container } = render(
      <MessageList
        messages={[
          userMessage("user-1", "Current request"),
          assistantMessage("assistant-1", "Current answer"),
        ]}
      />,
    );
    let scrollHeight = 620;
    Object.defineProperties(container, {
      scrollHeight: { configurable: true, get: () => scrollHeight },
      clientHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, value: 120, writable: true },
    });
    fireEvent.wheel(container, { deltaY: -120 });
    container.scrollTop = 0;
    fireEvent.scroll(container);

    // The view change adds height above the reader, who sits inside the
    // near-bottom band without following.
    act(() => setConversationViewPreference(true));
    scrollHeight = 900;
    await flushFrames();

    expect(container.scrollTop).toBe(280);
    expect(
      screen.queryByRole("button", { name: "Follow latest session output" }),
    ).not.toBeNull();
    composerTarget.remove();
  });
});
