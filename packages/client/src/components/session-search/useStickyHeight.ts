import { type RefObject, useLayoutEffect } from "react";

/**
 * Publishes a sticky element's height as a custom property on its parent, so
 * later sticky siblings (the bulk band) can pin just below it. It writes the
 * style directly: a resize never re-renders the page.
 */
export function useStickyHeight(
  ref: RefObject<HTMLElement | null>,
  property: string,
) {
  useLayoutEffect(() => {
    const element = ref.current;
    const host = element?.parentElement;
    if (!element || !host) return;
    const apply = () =>
      host.style.setProperty(property, `${element.offsetHeight}px`);
    apply();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(apply);
    observer.observe(element);
    return () => {
      observer.disconnect();
      host.style.removeProperty(property);
    };
  }, [ref, property]);
}
