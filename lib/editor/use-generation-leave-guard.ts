"use client";

import { useCallback, useEffect } from "react";

const leaveMessage = "Lessons are still generating. Leaving this page can interrupt generation and lose work that has not been saved yet. Already saved lessons are safe. Leave this page?";

type HistoryNavigationEvent = Event & {
  navigationType: string;
  destination: { sameDocument: boolean; url: string };
};

function isDifferentPage(destination: string) {
  const url = new URL(destination, window.location.href);
  return url.origin !== window.location.origin || url.pathname !== window.location.pathname || url.search !== window.location.search;
}

export function useGenerationLeaveGuard(active: boolean) {
  const confirmLeave = useCallback(() => !active || window.confirm(leaveMessage), [active]);

  useEffect(() => {
    if (!active) return;
    // Browsers supply their own text for refresh, closing and full-page exits.
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    function linkClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const url = new URL(link.href);
      // Cross-origin links already invoke the native beforeunload warning.
      if (url.origin !== window.location.origin || !isDifferentPage(link.href)) return;
      if (!confirmLeave()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      } else {
        // A normal anchor may unload immediately; avoid a second confirmation.
        // Next.js links stay in this document, so restore refresh protection.
        window.removeEventListener("beforeunload", beforeUnload);
        window.clearTimeout(restoreTimer);
        restoreTimer = window.setTimeout(() => window.addEventListener("beforeunload", beforeUnload), 0);
      }
    }
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    let traversalConfirmed = false;
    function navigate(event: Event) {
      const navigationEvent = event as HistoryNavigationEvent;
      traversalConfirmed = false;
      if (navigationEvent.navigationType !== "traverse" || !navigationEvent.destination.sameDocument || !event.cancelable || !isDifferentPage(navigationEvent.destination.url)) return;
      if (!confirmLeave()) event.preventDefault();
      else traversalConfirmed = true;
    }
    // Older browsers lack cancellable Navigation API traversals. Stop the
    // router's popstate listener and restore the editor entry when staying.
    let previousUrl = window.location.href;
    let previousState: unknown = window.history.state;
    function popState(event: PopStateEvent) {
      if (window.location.href === previousUrl) return;
      const previous = new URL(previousUrl);
      if (traversalConfirmed || (previous.pathname === window.location.pathname && previous.search === window.location.search)) {
        traversalConfirmed = false;
        previousUrl = window.location.href;
        previousState = event.state;
        return;
      }
      if (!confirmLeave()) {
        event.stopImmediatePropagation();
        window.history.pushState(previousState, "", previousUrl);
      } else {
        previousUrl = window.location.href;
        previousState = event.state;
      }
    }
    let restoreTimer: number | undefined;
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", linkClick, true);
    navigation?.addEventListener("navigate", navigate);
    window.addEventListener("popstate", popState, true);
    return () => {
      window.clearTimeout(restoreTimer);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", linkClick, true);
      navigation?.removeEventListener("navigate", navigate);
      window.removeEventListener("popstate", popState, true);
    };
  }, [active, confirmLeave]);

  return confirmLeave;
}
