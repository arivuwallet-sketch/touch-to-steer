import { useEffect, useState } from "react";

type Props = {
  mode?: "pad" | "wheel" | "mouse";
};

/**
 * Gamepad/wheel stay landscape. Mouse mode intentionally stays portrait so
 * the phone can be held upright like a vertical Viper-style mouse.
 */
export function RotateGate({ mode = "pad" }: Props) {
  const [wrongOrientation, setWrongOrientation] = useState(false);

  useEffect(() => {
    const check = () => {
      const portrait = window.innerHeight > window.innerWidth;
      setWrongOrientation(mode === "mouse" ? !portrait : portrait);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, [mode]);

  const goToPreferredOrientation = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      const so = screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      await so.lock?.(mode === "mouse" ? "portrait" : "landscape");
    } catch {
      /* Safari/iOS and some desktop browsers require manual rotation. */
    }
  };

  if (!wrongOrientation) return null;

  const mouse = mode === "mouse";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-background px-8 text-center">
      <div className="animate-pulse text-6xl">{mouse ? "🖱️" : "📱"}</div>
      <h2 className="text-xl font-bold">{mouse ? "Turn your phone upright" : "Turn your phone sideways"}</h2>
      <p className="max-w-xs text-sm text-muted-foreground">
        {mouse
          ? "Mouse mode uses portrait orientation so the virtual Viper-style mouse matches a normal desktop mouse shape."
          : "The wheel and gamepad need landscape so your thumbs reach every control."}
      </p>
      <button
        onClick={goToPreferredOrientation}
        className="rounded-xl px-5 py-3 text-xs font-bold uppercase tracking-widest text-primary-foreground glow"
        style={{ background: "var(--gradient-primary)" }}
      >
        Go fullscreen {mouse ? "portrait" : "landscape"}
      </button>
    </div>
  );
}
