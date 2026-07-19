import { useEffect, useRef, useState } from 'react';

/**
 * Prevents the browser Back button (and any other popstate-driven
 * navigation) from silently exiting an active room. While `active` is
 * true, a sentinel history entry is kept on top of the stack; the first
 * Back press is intercepted and re-parked on that sentinel instead of
 * being allowed through, and a confirmation prompt is shown. Only after
 * the user explicitly confirms does `onLeave` run.
 *
 * `requestLeave()` is exposed so in-app "leave" affordances (e.g. the
 * logo link) can trigger the exact same confirmation, rather than
 * bypassing it.
 */
export function useLeaveRoomGuard(active: boolean, onLeave: () => void) {
  const [showConfirm, setShowConfirm] = useState(false);
  const confirmedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    confirmedRef.current = false;

    // Sentinel entry: makes the *next* Back press interceptable without
    // the visible hash changing, since it duplicates the current URL.
    window.history.pushState({ syncbeatGuard: true }, '', window.location.href);

    const onPopState = () => {
      if (confirmedRef.current) return; // user already confirmed — let this one through
      // Cancel the pop by re-pushing the sentinel, then ask.
      window.history.pushState({ syncbeatGuard: true }, '', window.location.href);
      setShowConfirm(true);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [active]);

  const confirmLeave = () => {
    confirmedRef.current = true;
    setShowConfirm(false);
    onLeave();
  };

  const cancelLeave = () => setShowConfirm(false);
  const requestLeave = () => setShowConfirm(true);

  return { showConfirm, confirmLeave, cancelLeave, requestLeave };
}
