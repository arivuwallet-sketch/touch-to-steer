import { useEffect, useRef } from "react";

export const RELEASE_INPUTS = "touch-to-steer:release-inputs";

/** Cancel local gestures/timers as well as the outgoing controller snapshot. */
export function useInputReset(reset: () => void) {
  const latest = useRef(reset);
  latest.current = reset;
  useEffect(() => {
    const release = () => latest.current();
    const visibility = () => {
      if (document.visibilityState !== "visible") release();
    };
    window.addEventListener(RELEASE_INPUTS, release);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener(RELEASE_INPUTS, release);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", visibility);
      release();
    };
  }, []);
}
