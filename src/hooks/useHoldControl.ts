import { useEffect, useRef, type PointerEvent, type KeyboardEvent } from "react";
import { useInputReset } from "./useInputReset";

/** Stable press ownership: another finger cannot release this control. */
export function useHoldControl(onChange: (down: boolean) => void, turbo = false) {
  const latest = useRef(onChange);
  latest.current = onChange;
  const owners = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const down = useRef(false);
  const write = (value: boolean) => {
    if (down.current === value) return;
    down.current = value;
    latest.current(value);
  };
  const clearTimer = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  const reset = () => {
    clearTimer();
    owners.current.clear();
    write(false);
  };
  useInputReset(reset);
  useEffect(() => {
    clearTimer();
    if (!turbo) {
      if (owners.current.size) write(true);
      return;
    }
    if (owners.current.size) schedulePulse();
    return clearTimer;
  }, [turbo]);
  function schedulePulse() {
    clearTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      if (!owners.current.size) return;
      write(!down.current);
      schedulePulse();
    }, down.current ? 74 : 18);
  }
  const acquire = (owner: string) => {
    if (owners.current.has(owner)) return;
    owners.current.add(owner);
    if (owners.current.size !== 1) return;
    write(true);
    if (turbo) schedulePulse();
  };
  const release = (owner: string) => {
    if (!owners.current.delete(owner) || owners.current.size) return;
    clearTimer();
    write(false);
  };
  const pointerUp = (e: PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    release(`pointer:${e.pointerId}`);
  };
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      acquire(`pointer:${e.pointerId}`);
    },
    onPointerUp: pointerUp,
    onPointerCancel: pointerUp,
    onLostPointerCapture: pointerUp,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.code !== "Space" && e.code !== "Enter") return;
      e.preventDefault();
      acquire(`key:${e.code}`);
    },
    onKeyUp: (e: KeyboardEvent<HTMLElement>) => {
      if (e.code !== "Space" && e.code !== "Enter") return;
      e.preventDefault();
      release(`key:${e.code}`);
    },
    onBlur: () => {
      release("key:Space");
      release("key:Enter");
    },
  };
}
