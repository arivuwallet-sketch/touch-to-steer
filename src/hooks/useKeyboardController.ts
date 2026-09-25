import { useEffect, useRef } from "react";
import { keyboardState, CONTROL_KEYS, type ControllerMode } from "@/lib/keyboard-controller";
import type { ControllerState } from "@/lib/controller-types";
import { RELEASE_INPUTS } from "./useInputReset";

export function useKeyboardController(mode: ControllerMode, enabled: boolean, onChange: (state: ControllerState) => void) {
  const latest = useRef(onChange);
  latest.current = onChange;
  useEffect(() => {
    if (!enabled || mode === "mouse") return;
    const keys = new Set<string>();
    const publish = () => latest.current(keyboardState(keys, mode));
    const down = (event: KeyboardEvent) => {
      if (event.altKey || (event.ctrlKey && event.code !== "ControlLeft" && !keys.has("ControlLeft")) || event.metaKey || !CONTROL_KEYS.has(event.code)) return;
      if (event.target instanceof Element && event.target.closest("input,textarea,select,button,[contenteditable=true],[role=slider]")) return;
      event.preventDefault();
      if (keys.has(event.code)) return;
      keys.add(event.code);
      publish();
    };
    const up = (event: KeyboardEvent) => {
      if (!keys.delete(event.code)) return;
      event.preventDefault();
      publish();
    };
    const release = () => { if (keys.size) { keys.clear(); publish(); } };
    const visibility = () => { if (document.visibilityState !== "visible") release(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", release);
    window.addEventListener(RELEASE_INPUTS, release);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", release);
      window.removeEventListener(RELEASE_INPUTS, release);
      document.removeEventListener("visibilitychange", visibility);
      release();
    };
  }, [enabled, mode]);
}
