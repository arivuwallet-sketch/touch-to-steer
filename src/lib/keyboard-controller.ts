import { emptyState, type ControllerState } from "./controller-types";

export type ControllerMode = "pad" | "wheel" | "mouse";
export const KEY_BUTTONS: Record<string, string> = {
  KeyZ: "a", KeyX: "b", KeyC: "x", KeyV: "y",
  Enter: "start", Backspace: "back", Home: "home",
  Digit1: "m1", Digit2: "m2", Digit3: "m3", Digit4: "m4",
  Digit5: "m5", Digit6: "m6",
};
export const CONTROL_KEYS = new Set([
  ...Object.keys(KEY_BUTTONS), "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "KeyW", "KeyA", "KeyS", "KeyD", "KeyI", "KeyJ", "KeyK", "KeyL",
  "KeyQ", "KeyE", "KeyH", "KeyR", "Space", "ShiftLeft", "ControlLeft",
]);

/** Read the complete held-key set; OS key-repeat is never the input clock. */
export function keyboardState(keys: ReadonlySet<string>, mode: ControllerMode): ControllerState {
  const state = emptyState();
  if (mode === "mouse") return state;
  const held = (key: string) => keys.has(key) ? 1 : 0;
  for (const [key, button] of Object.entries(KEY_BUTTONS)) {
    if (keys.has(key)) state.buttons[button] = true;
  }
  if (mode === "wheel") {
    state.steer = Math.max(held("ArrowRight"), held("KeyD")) - Math.max(held("ArrowLeft"), held("KeyA"));
    state.throttle = Math.max(held("ArrowUp"), held("KeyW"));
    state.brake = Math.max(held("ArrowDown"), held("KeyS"));
    state.handbrake = held("Space");
    state.clutch = held("ShiftLeft");
    state.nitro = held("ControlLeft");
    state.gear = held("KeyE") - held("KeyQ");
    state.buttons["horn"] = keys.has("KeyH");
    state.buttons["reset"] = keys.has("KeyR");
  } else {
    for (const [key, direction] of [["ArrowLeft", "left"], ["ArrowRight", "right"], ["ArrowUp", "up"], ["ArrowDown", "down"]]) {
      state.buttons[`dpad_${direction}`] = keys.has(key!);
    }
    state.lx = held("KeyD") - held("KeyA");
    state.ly = held("KeyS") - held("KeyW");
    state.rx = held("KeyL") - held("KeyJ");
    state.ry = held("KeyK") - held("KeyI");
    state.lt = held("ShiftLeft");
    state.rt = held("ControlLeft");
    state.buttons["lb"] = keys.has("KeyQ");
    state.buttons["rb"] = keys.has("KeyE");
    if (keys.has("Space")) state.buttons["a"] = true;
  }
  return state;
}

/** Releasing keyboard input cannot clear a control still held by touch. */
export function mergeControllerInputs(touch: ControllerState, keyboard: ControllerState): ControllerState {
  const merged = { ...touch, buttons: { ...touch.buttons } };
  for (const key of Object.keys(touch) as (keyof ControllerState)[]) {
    if (key === "buttons" || key === "wheelPlatform") continue;
    merged[key] = Math.abs(keyboard[key]) > Math.abs(touch[key]) ? keyboard[key] : touch[key];
  }
  for (const [key, down] of Object.entries(keyboard.buttons)) {
    if (down) merged.buttons[key] = true;
  }
  return merged;
}
