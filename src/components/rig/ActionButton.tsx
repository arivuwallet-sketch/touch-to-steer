type Props = {
  label: string;
  vibration: boolean;
  onPress: (down: boolean) => void;
  className?: string;
};

export function ActionButton({ label, vibration, onPress, className = "" }: Props) {
  const buzz = () => {
    if (vibration && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(12);
    }
  };

  return (
    <button
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture(e.pointerId);
        buzz();
        onPress(true);
      }}
      onPointerUp={() => onPress(false)}
      onPointerCancel={() => onPress(false)}
      className={`touch-none rounded-xl border border-border bg-secondary px-3 py-2.5 text-xs font-bold uppercase tracking-widest text-secondary-foreground transition-colors active:border-primary active:bg-primary active:text-primary-foreground ${className}`}
    >
      {label}
    </button>
  );
}
