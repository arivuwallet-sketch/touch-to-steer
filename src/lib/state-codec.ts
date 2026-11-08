import type { ControllerState } from "./controller-types";

// Wire encoder for controller "state" packets.
//
// The hot (analog) and edge (button) lanes used to serialise the whole snapshot
// twice per event: once for the packet and once more to build the change
// signature, and each time the full wheel/pad binding objects went through
// JSON.stringify as well. Snapshots and bindings are immutable and replaced on
// change, so identity is a safe cache key: the state is serialised once per new
// snapshot and the bindings only when they actually change.
//
// The packet is byte-for-byte what `JSON.stringify({ type, priority, t, seq,
// ...state, wheelBindings, padBindings })` produced, so the bridge is unchanged.

export type StatePriority = "hot" | "edge";

export type StateEncoder = {
  /** Serialised `state` packet, ready for `ws.send`. */
  packet(
    priority: StatePriority | undefined,
    t: number,
    seq: number,
    state: ControllerState,
    wheelBindings: unknown,
    padBindings: unknown,
  ): string;
  /** Stable string that only changes when the controller state or bindings change. */
  signature(state: ControllerState, wheelBindings: unknown, padBindings: unknown): string;
};

export function createStateEncoder(): StateEncoder {
  let bodyState: ControllerState | null = null;
  let body = "";

  let bindWheel: unknown = undefined;
  let bindPad: unknown = undefined;
  let bindings = "";
  let bindingsReady = false;

  let sigState: ControllerState | null = null;
  let sigWheel: unknown = undefined;
  let sigPad: unknown = undefined;
  let sig = "";

  const encodeBody = (state: ControllerState): string => {
    if (state !== bodyState) {
      // `{"a":1,...}` -> `"a":1,...` so the packet header can be prepended.
      body = JSON.stringify(state).slice(1, -1);
      bodyState = state;
    }
    return body;
  };

  const encodeBindings = (wheel: unknown, pad: unknown): string => {
    if (!bindingsReady || wheel !== bindWheel || pad !== bindPad) {
      // Match JSON.stringify's rule for object members: `undefined` is omitted.
      bindings =
        (wheel === undefined ? "" : `,"wheelBindings":${JSON.stringify(wheel)}`) +
        (pad === undefined ? "" : `,"padBindings":${JSON.stringify(pad)}`);
      bindWheel = wheel;
      bindPad = pad;
      bindingsReady = true;
    }
    return bindings;
  };

  return {
    packet(priority, t, seq, state, wheelBindings, padBindings) {
      const inner = encodeBody(state);
      return (
        `{"type":"state"${priority ? `,"priority":"${priority}"` : ""},"t":${t},"seq":${seq}` +
        (inner ? `,${inner}` : "") +
        encodeBindings(wheelBindings, padBindings) +
        "}"
      );
    },
    signature(state, wheelBindings, padBindings) {
      if (state === sigState && wheelBindings === sigWheel && padBindings === sigPad) return sig;
      sig = `${encodeBody(state)}|${encodeBindings(wheelBindings, padBindings)}`;
      sigState = state;
      sigWheel = wheelBindings;
      sigPad = padBindings;
      return sig;
    },
  };
}
