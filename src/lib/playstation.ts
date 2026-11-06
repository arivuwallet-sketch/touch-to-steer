// PlayStation output helpers.
// ViGEmBus can only emulate a DualShock 4 ("Wireless Controller", Sony VID 054C).
// PS5 / PS5 Pro titles, PS Remote Play and chiaki-ng all accept that pad, so
// "ps5" output is sent to the PC bridge as a DS4 target with PlayStation glyphs.
export type OutputMode = "xinput" | "ds4" | "universal" | "ps5";

export function isPlayStationOutput(mode: OutputMode | undefined): boolean {
  return mode === "ps5" || mode === "ds4";
}

/** Target the PC bridge must create for the selected output. */
export function bridgeOutputFor(mode: OutputMode): "xinput" | "ds4" | "universal" {
  return mode === "ps5" ? "ds4" : mode;
}

export type PadLabels = { y: string; x: string; b: string; a: string; lb: string; rb: string; lt: string; rt: string; back: string; start: string; home: string };

const XBOX: PadLabels = { y: "Y", x: "X", b: "B", a: "A", lb: "LB", rb: "RB", lt: "LT", rt: "RT", back: "VIEW", start: "MENU", home: "HOME" };
const PLAYSTATION: PadLabels = { y: "△", x: "□", b: "○", a: "✕", lb: "L1", rb: "R1", lt: "L2", rt: "R2", back: "SHARE", start: "OPTIONS", home: "PS" };

export function padLabelsFor(mode: OutputMode | undefined): PadLabels {
  return isPlayStationOutput(mode) ? PLAYSTATION : XBOX;
}
