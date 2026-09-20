import { useEffect, useState } from "react";

/**
 * The rig is a landscape controller. In portrait we block interaction and ask
 * the player to turn the phone, offering fullscreen + orientation lock.
 */
export function RotateGate() {
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  const goLandscape = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      const so = screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      await so.lock?.("landscape");
    } catch {
      /* desktop browsers and iOS don't allow locking; the user rotates manually */
    }
  };

  if (!portrait) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-background px-8 text-center">
      <div className="animate-pulse text-6xl">📱</div>
      <h2 className="text-xl font-bold">Turn your phone sideways</h2>
      <p className="max-w-xs text-sm text-muted-foreground">
        The wheel and gamepad need landscape so your thumbs reach every control.
      </p>
      <button
        onClick={goLandscape}
        className="rounded-xl px-5 py-3 text-xs font-bold uppercase tracking-widest text-primary-foreground glow"
        style={{ background: "var(--gradient-primary)" }}
      >
        Go fullscreen landscape
      </button>
    </div>
  );
}
