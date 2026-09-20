type Props = {
  vibration: boolean;
  onPress: (dir: "up" | "down" | "left" | "right", down: boolean) => void;
};

const cells: Record<string, string> = {
  up: "col-start-2 row-start-1 rounded-t-xl",
  left: "col-start-1 row-start-2 rounded-l-xl",
  right: "col-start-3 row-start-2 rounded-r-xl",
  down: "col-start-2 row-start-3 rounded-b-xl",
};

export function DPad({ vibration, onPress }: Props) {
  const buzz = () => {
    if (vibration && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
  };

  return (
    <div className="grid size-28 grid-cols-3 grid-rows-3 gap-0.5">
      {(["up", "left", "right", "down"] as const).map((d) => (
        <button
          key={d}
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture(e.pointerId);
            buzz();
            onPress(d, true);
          }}
          onPointerUp={() => onPress(d, false)}
          onPointerCancel={() => onPress(d, false)}
          className={`touch-none border border-border bg-secondary text-muted-foreground active:bg-primary active:text-primary-foreground ${cells[d]}`}
          aria-label={d}
        >
          {d === "up" ? "▲" : d === "down" ? "▼" : d === "left" ? "◀" : "▶"}
        </button>
      ))}
      <div className="col-start-2 row-start-2 bg-secondary" />
    </div>
  );
}
