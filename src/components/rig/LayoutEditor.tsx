import { ControlPreview } from "./ControlPreview";
import { useRef, useState } from "react";
import {
  normalizeBox,
  collectControls,
  scaleControlBox,
  swapControls,
  type ControlBox,
  type ControlLayout,
  type LayoutControl,
} from "@/lib/control-layout";
type Props = {
  mode: "pad" | "wheel";
  source: HTMLDivElement | null;
  controls: LayoutControl[];
  saved: ControlLayout | undefined;
  aspect: number;
  onSave: (layout: ControlLayout) => void;
  onClose: () => void;
};
export function LayoutEditor({ mode, source, controls, saved, aspect, onSave, onClose }: Props) {
  const [appearances] = useState(
    () => new Map(source ? collectControls(source).map((c) => [c.id, c.el]) : []),
  );
  const defaults = Object.fromEntries(controls.map((c) => [c.id, c.box]));
  const [draft, setDraft] = useState<ControlLayout>(() => ({ ...defaults, ...saved }));
  const [selected, select] = useState(controls[0]?.id ?? "");
  const [snap, setSnap] = useState(true),
    [swap, setSwap] = useState("");
  const [history, setHistory] = useState<ControlLayout[]>([]);
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: string;
    pointer: number;
    x: number;
    y: number;
    box: ControlBox;
    resize: boolean;
  } | null>(null);
  const checkpoint = () => setHistory((h) => [...h.slice(-29), structuredClone(draft)]);
  const update = (id: string, patch: Partial<ControlBox>) =>
    setDraft((d) => ({ ...d, [id]: normalizeBox({ ...d[id]!, ...patch }) }));
  const box = draft[selected];
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Layout editor"
      className="fixed inset-0 z-[100] overflow-auto bg-slate-950 p-3 text-slate-100"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-3">
        <div>
          <h1 className="text-lg font-bold">
            {mode === "pad" ? "Gamepad" : "Steering"} layout editor
          </h1>
          <p className="text-xs text-slate-400">
            Drag controls or their corner handles. No game input is sent while editing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded border border-amber-300/60 px-3 py-2 text-amber-200"
            onClick={() => {
              checkpoint();
              setDraft(defaults);
            }}
          >
            Reset layout
          </button>
          <button className="rounded border px-3 py-2" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded bg-cyan-300 px-3 py-2 font-bold text-black"
            onClick={() => onSave(draft)}
          >
            Save layout
          </button>
        </div>
      </header>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_260px]">
        <div>
          <div
            ref={canvas}
            className="relative w-full overflow-hidden rounded-xl border border-cyan-300/30 bg-[#05080d]"
            style={{ aspectRatio: aspect || 16 / 9, touchAction: "none" }}
            onPointerMove={(e) => {
              const d = drag.current,
                r = canvas.current?.getBoundingClientRect();
              if (!d || d.pointer !== e.pointerId || !r) return;
              const round = (v: number) => (snap ? Math.round(v) : v);
              const dx = ((e.clientX - d.x) / r.width) * 100,
                dy = ((e.clientY - d.y) / r.height) * 100;
              update(
                d.id,
                d.resize
                  ? { w: round(d.box.w + dx), h: round(d.box.h + dy) }
                  : { x: round(d.box.x + dx), y: round(d.box.y + dy) },
              );
            }}
            onPointerUp={(e) => {
              if (drag.current?.pointer === e.pointerId) drag.current = null;
            }}
            onPointerCancel={(e) => {
              if (drag.current?.pointer === e.pointerId) drag.current = null;
            }}
            onLostPointerCapture={() => {
              drag.current = null;
            }}
          >
            {controls.map((c) => {
              const b = draft[c.id] ?? c.box;
              return (
                <div
                  role="button"
                  tabIndex={0}
                  key={c.id}
                  aria-label={`Arrange ${c.label}`}
                  className={`absolute touch-none rounded-lg outline-offset-2 ${selected === c.id ? "z-10 outline-2 outline-cyan-200" : "hover:outline hover:outline-slate-400"} ${b.hidden ? "opacity-30" : ""}`}
                  aria-pressed={selected === c.id}
                  onFocus={() => select(c.id)}
                  style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      select(c.id);
                    }
                    const delta = {
                      ArrowLeft: [-1, 0],
                      ArrowRight: [1, 0],
                      ArrowUp: [0, -1],
                      ArrowDown: [0, 1],
                    }[e.key];
                    if (delta) {
                      e.preventDefault();
                      checkpoint();
                      update(c.id, { x: b.x + delta[0]!, y: b.y + delta[1]! });
                    }
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    checkpoint();
                    select(c.id);
                    canvas.current?.setPointerCapture(e.pointerId);
                    drag.current = {
                      id: c.id,
                      pointer: e.pointerId,
                      x: e.clientX,
                      y: e.clientY,
                      box: b,
                      resize: (e.target as HTMLElement).dataset["resize"] === "true",
                    };
                  }}
                >
                  {appearances.get(c.id) ? (
                    <ControlPreview source={appearances.get(c.id)!} />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center rounded border border-slate-500 bg-slate-800 text-xs">
                      {c.label}
                    </span>
                  )}
                  <span
                    data-resize="true"
                    className={`absolute -bottom-1 -right-1 h-5 w-5 cursor-se-resize rounded border border-cyan-100 bg-cyan-500 ${selected === c.id ? "" : "opacity-0"}`}
                    title="Resize"
                  />
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Positions and sizes scale with the screen. The steering wheel and its built-in buttons
            move together.
          </p>
        </div>
        <aside className="space-y-3 rounded-xl border border-white/15 p-3 text-sm">
          <label className="block">
            Control
            <select
              aria-label="Selected control"
              className="mt-1 w-full bg-slate-800 p-2"
              value={selected}
              onChange={(e) => select(e.target.value)}
            >
              {controls.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {box && (
            <>
              <label className="block rounded-lg border border-cyan-300/25 bg-slate-900 p-3">
                <span className="flex justify-between">
                  Size <output>{Math.round((box.w / defaults[selected]!.w) * 100)}%</output>
                </span>
                <input
                  type="range"
                  aria-label="Control size"
                  className="mt-3 w-full accent-cyan-300"
                  min={Math.ceil(
                    ((Math.max(2 / box.w, 2 / box.h) * box.w) / defaults[selected]!.w) * 100,
                  )}
                  max={Math.floor(
                    ((Math.min(100 / box.w, 100 / box.h) * box.w) / defaults[selected]!.w) * 100,
                  )}
                  step={1}
                  value={(box.w / defaults[selected]!.w) * 100}
                  onPointerDown={checkpoint}
                  onKeyDown={(e) => {
                    if (
                      [
                        "ArrowLeft",
                        "ArrowRight",
                        "ArrowUp",
                        "ArrowDown",
                        "Home",
                        "End",
                        "PageUp",
                        "PageDown",
                      ].includes(e.key)
                    )
                      checkpoint();
                  }}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      [selected]: scaleControlBox(
                        d[selected]!,
                        (defaults[selected]!.w * Number(e.target.value)) / 100,
                      ),
                    }))
                  }
                />
                <span className="text-xs text-slate-400">
                  Scales width and height together. 100% is the original width.
                </span>
              </label>
              {(["x", "y", "w", "h"] as const).map((key) => (
                <label key={key} className="flex justify-between gap-2">
                  {{ x: "Left %", y: "Top %", w: "Width %", h: "Height %" }[key]}
                  <input
                    aria-label={`Control ${key}`}
                    className="w-24 bg-slate-800 p-1"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={Math.round(box[key] * 100) / 100}
                    onChange={(e) => {
                      checkpoint();
                      update(selected, { [key]: Number(e.target.value) });
                    }}
                  />
                </label>
              ))}
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={!box.hidden}
                  onChange={(e) => {
                    checkpoint();
                    update(selected, { hidden: !e.target.checked });
                  }}
                />
                Visible
              </label>
              <button
                className="w-full rounded border border-cyan-300/40 px-3 py-2 text-cyan-100"
                onClick={() => {
                  checkpoint();
                  setDraft((d) => ({ ...d, [selected]: defaults[selected]! }));
                }}
              >
                Reset selected control
              </button>
            </>
          )}
          <label className="flex gap-2">
            <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
            Snap to 1% grid
          </label>
          <label className="block">
            Swap position and size with
            <select
              aria-label="Swap control"
              className="mt-1 w-full bg-slate-800 p-2"
              value={swap}
              onChange={(e) => setSwap(e.target.value)}
            >
              <option value="">Choose a control</option>
              {controls
                .filter((c) => c.id !== selected)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
            </select>
          </label>
          <button
            disabled={!swap}
            className="rounded border px-3 py-1 disabled:opacity-30"
            onClick={() => {
              checkpoint();
              setDraft((d) => swapControls(d, selected, swap));
            }}
          >
            Swap controls
          </button>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={!history.length}
              className="underline disabled:opacity-30"
              onClick={() => {
                setDraft(history.at(-1)!);
                setHistory((h) => h.slice(0, -1));
              }}
            >
              Undo
            </button>
            <button
              className="underline"
              onClick={() => {
                checkpoint();
                setDraft(defaults);
              }}
            >
              Reset all
            </button>
            <button className="underline" onClick={() => onSave({})}>
              Restore original layout
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
