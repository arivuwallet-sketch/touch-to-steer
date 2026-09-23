import { useEffect, useState } from "react";
import { ArrowRight, Maximize2, RotateCw } from "lucide-react";

type Props = {
  mode?: "pad" | "wheel" | "mouse";
};

/** Orientation gate styled as part of the TouchToSteer spectral visual system. */
export function RotateGate({ mode = "pad" }: Props) {
  const [wrongOrientation, setWrongOrientation] = useState(false);

  useEffect(() => {
    const check = () => {
      const portrait = window.innerHeight > window.innerWidth;
      const touchDevice = window.matchMedia("(pointer: coarse)").matches;
      setWrongOrientation(touchDevice && (mode === "mouse" ? !portrait : portrait));
    };

    check();
    window.addEventListener("resize", check, { passive: true });
    window.addEventListener("orientationchange", check, { passive: true });
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, [mode]);

  const goToPreferredOrientation = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      await orientation.lock?.(mode === "mouse" ? "portrait" : "landscape");
    } catch {
      /* Some mobile browsers require the user to rotate manually. */
    }
  };

  if (!wrongOrientation) return null;

  const mouse = mode === "mouse";
  const target = mouse ? "PORTRAIT" : "LANDSCAPE";
  const title = mouse ? "Turn your phone upright" : "Turn your phone sideways";
  const body = mouse
    ? "Mouse mode uses a vertical workspace so the pointer surface stays natural in your hand."
    : "Gamepad and steering are built for a wide cockpit layout so every control stays within thumb reach.";

  return (
    <div className={"spectral-orientation-gate " + (mouse ? "is-mouse-target" : "is-landscape-target")}>
      <div className="spectral-orientation-noise" aria-hidden="true" />
      <div className="spectral-orientation-grid" aria-hidden="true" />
      <div className="spectral-orientation-orbit spectral-orientation-orbit-a" aria-hidden="true" />
      <div className="spectral-orientation-orbit spectral-orientation-orbit-b" aria-hidden="true" />
      <div className="spectral-orientation-scan" aria-hidden="true" />

      <div className="spectral-orientation-shell">
        <div className="spectral-orientation-topline">
          <div className="spectral-orientation-brand">
            <span className="spectral-orientation-ghost" aria-hidden="true">
              <svg viewBox="0 0 512 512">
                <path
                  d="m508.374 432.802s-46.6-39.038-79.495-275.781c-8.833-87.68-82.856-156.139-172.879-156.139-90.015 0-164.046 68.458-172.879 156.138-32.895 236.743-79.495 275.782-79.495 275.782-15.107 25.181 20.733 28.178 38.699 27.94 35.254-.478 35.254 40.294 70.516 40.294 35.254 0 35.254-35.261 70.508-35.261s37.396 45.343 72.65 45.343 37.389-45.343 72.651-45.343c35.254 0 35.254 35.261 70.508 35.261s35.27-40.772 70.524-40.294c17.959.238 53.798-2.76 38.692-27.94z"
                  fill="currentColor"
                />
                <circle cx="208" cy="225" r="22" fill="#03060a" />
                <circle cx="297" cy="225" r="22" fill="#03060a" />
              </svg>
            </span>
            <span>TOUCHTOSTEER</span>
          </div>
          <div className="spectral-orientation-status">
            <span />
            INPUT SYSTEM / ORIENTATION CHECK
          </div>
        </div>

        <div className="spectral-orientation-main">
          <div className="spectral-orientation-copy">
            <div className="spectral-orientation-kicker">
              CONTROL SURFACE / {mode === "mouse" ? "MOUSE" : mode === "wheel" ? "STEERING" : "GAMEPAD"}
            </div>
            <h2>{title}</h2>
            <p>{body}</p>

            <div className="spectral-orientation-meta">
              <div>
                <span>REQUIRED</span>
                <strong>{target}</strong>
              </div>
              <div>
                <span>DISPLAY</span>
                <strong>FULLSCREEN READY</strong>
              </div>
              <div>
                <span>INPUT</span>
                <strong>TOUCH + MOTION</strong>
              </div>
            </div>

            <button type="button" onClick={goToPreferredOrientation} className="spectral-orientation-button">
              <span>ENTER {target}</span>
              <Maximize2 size={15} />
              <ArrowRight size={15} />
            </button>
            <div className="spectral-orientation-hint">
              <RotateCw size={12} />
              <span>{mouse ? "Rotate upright if the browser does not lock automatically." : "Rotate sideways if the browser does not lock automatically."}</span>
            </div>
          </div>

          <div className={"spectral-device-stage " + (mouse ? "is-portrait-target" : "is-landscape-target")} aria-hidden="true">
            <div className="spectral-device-aura" />
            <div className="spectral-device-frame">
              <div className="spectral-device-speaker" />
              <div className="spectral-device-screen">
                <div className="spectral-device-signal signal-one" />
                <div className="spectral-device-signal signal-two" />
                <div className="spectral-device-signal signal-three" />
                <span>{target}</span>
                <strong>READY</strong>
              </div>
              <div className="spectral-device-home" />
            </div>
            <div className="spectral-device-ring" />
            <div className="spectral-device-label">{target} / LOCK TARGET</div>
          </div>
        </div>

        <div className="spectral-orientation-footer">
          <span>TOUCHTOSTEER / SPECTRAL CONTROL SYSTEM</span>
          <span>ORIENTATION GATE / 01</span>
          <span>NO SIGNAL LOST</span>
        </div>
      </div>
    </div>
  );
}
