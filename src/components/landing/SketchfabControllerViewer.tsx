import { useEffect, useRef, useState } from "react";

const SKETCHFAB_VERSION = "1.12.1";
const MODEL_UID = "b7bb9c5102a04cb0b1966c6d02bad7d6";
const API_SCRIPT_ID = "touchtosteer-sketchfab-viewer-api";

type SketchfabApi = {
  start: (callback?: () => void) => void;
  setUserInteraction: (enabled: boolean, options?: Record<string, unknown>, callback?: (err: unknown) => void) => void;
  setTextureQuality: (quality: "ld" | "sd" | "hd", callback?: (err: unknown) => void) => void;
  setShadingStyle: (
    style: "pbr" | "classic" | "matcap",
    options: { type: "lit" | "shadeless" },
    callback?: (err: unknown) => void,
  ) => void;
  getEnvironment: (callback: (err: unknown, env?: EnvironmentSettings) => void) => void;
  setEnvironment: (options: EnvironmentSettings, callback?: (err: unknown) => void) => void;
  getPostProcessing: (callback: (settings: Record<string, unknown>) => void) => void;
  setPostProcessing: (settings: Record<string, unknown>, callback?: () => void) => void;
  getLight: (lightId: number, callback: (err: unknown, light?: LightSettings) => void) => void;
  setLight: (lightId: number, options: Partial<LightSettings>, callback?: (err: unknown) => void) => void;
  setBackground: (options: { transparent?: boolean }, callback?: (err: unknown) => void) => void;
  setCameraEasing: (easing: string) => void;
};

type EnvironmentSettings = {
  enabled?: boolean;
  exposure?: number;
  lightIntensity?: number;
  rotation?: number;
  blur?: number;
  shadowEnabled?: boolean;
  uid?: string;
};

type LightSettings = {
  matrix?: number[];
  enabled?: boolean;
  shadowEnabled?: boolean;
  color?: number[];
  intensity?: number;
};

type SketchfabClient = {
  init: (uid: string, options: {
    autostart?: number;
    autospin?: number;
    blending?: number;
    camera?: number;
    max_texture_size?: number;
    navigation?: "orbit" | "fps";
    preload?: number;
    scrollwheel?: number;
    transparent?: number;
    ui_controls?: number;
    ui_infos?: number;
    ui_inspector?: number;
    ui_stop?: number;
    ui_watermark?: number;
    ui_watermark_link?: number;
    ui_hint?: number;
    ui_theme?: "dark" | "light";
    success: (api: SketchfabApi) => void;
    error: () => void;
  }) => void;
};

declare global {
  interface Window {
    Sketchfab?: new (version: string, iframe: HTMLIFrameElement) => SketchfabClient;
  }
}

const loadViewerApi = () =>
  new Promise<void>((resolve, reject) => {
    if (window.Sketchfab) {
      resolve();
      return;
    }

    const existing = document.getElementById(API_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Sketchfab Viewer API failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = API_SCRIPT_ID;
    script.src = `https://static.sketchfab.com/api/sketchfab-viewer-${SKETCHFAB_VERSION}.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Sketchfab Viewer API failed to load"));
    document.head.appendChild(script);
  });

function tuneViewer(api: SketchfabApi) {
  api.setTextureQuality("hd");
  api.setShadingStyle("pbr", { type: "lit" });
  api.setCameraEasing("easeOutCubic");
  api.setUserInteraction(true, undefined);

  // Keep the model's authored HDR environment, but force its real-time shadow path on.
  api.getEnvironment((err, env) => {
    if (err || !env) return;
    api.setEnvironment(
      {
        ...env,
        shadowEnabled: true,
        lightIntensity: Math.max(env.lightIntensity ?? 1, 1),
      },
      undefined,
    );
  });

  // Enable the viewer's high-end screen-space lighting/reflection stack.
  api.getPostProcessing((settings) => {
    api.setPostProcessing({
      ...settings,
      enable: true,
      ssaoEnable: true,
      ssrEnable: true,
      bloomEnable: true,
      sharpenEnable: true,
      vignetteEnable: false,
      grainEnable: false,
      chromaticAberrationEnable: false,
    });
  });

  // Retain authored light placement/colors while enabling shadow casting and adding a
  // subtle cool fill so the asset sits naturally inside the spectral cyan background.
  [0, 1, 2].forEach((lightId) => {
    api.getLight(lightId, (err, light) => {
      if (err || !light || light.enabled === false) return;
      const baseIntensity = Math.min(light.intensity ?? 1, 1);
      api.setLight(lightId, {
        shadowEnabled: true,
        intensity: baseIntensity,
        color:
          light.color && light.color.length >= 3
            ? [
                Math.max(light.color[0], 0.55),
                Math.max(light.color[1], 0.72),
                Math.max(light.color[2], 0.86),
              ]
            : [0.72, 0.9, 1],
      });
    });
  });

  api.setBackground({ transparent: true });
}

export function SketchfabControllerViewer() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        await loadViewerApi();
        if (cancelled || !iframeRef.current || !window.Sketchfab) return;

        const client = new window.Sketchfab(SKETCHFAB_VERSION, iframeRef.current);
        client.init(MODEL_UID, {
          autostart: 1,
          autospin: 0,
          blending: 1,
          camera: 0,
          max_texture_size: 8192,
          navigation: "orbit",
          preload: 1,
          scrollwheel: 0,
          transparent: 1,
          ui_controls: 0,
          ui_infos: 0,
          ui_inspector: 0,
          ui_stop: 0,
          ui_watermark: 0,
          ui_watermark_link: 0,
          ui_hint: 0,
          ui_theme: "dark",
          success(api) {
            if (cancelled) return;
            api.start(() => tuneViewer(api));
          },
          error() {
            if (!cancelled) setFailed(true);
          },
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="spectral-sketchfab-shell" data-render-quality="enhanced-pbr-ssr-ssao-hd">
      <iframe
        ref={iframeRef}
        title="PS5 DualSense Controller — high quality interactive 3D model"
        src=""
        allow="autoplay; fullscreen; xr-spatial-tracking"
        loading="eager"
        referrerPolicy="strict-origin-when-cross-origin"
      />
      {failed ? (
        <div className="spectral-model-fallback" aria-hidden="true">
          <span>3D SIGNAL OFFLINE</span>
        </div>
      ) : null}
    </div>
  );
}
