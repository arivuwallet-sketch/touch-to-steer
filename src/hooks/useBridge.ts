import { useCallback, useEffect, useRef, useState } from "react";
import type { ControllerState } from "@/lib/controller-types";
import { RELEASE_INPUTS } from "./useInputReset";
import { playDualRumble } from "@/lib/haptics";

export type BridgeStatus = "idle" | "connecting" | "connected" | "error";

export type BridgeTelemetry = {
  rpm?: number;
  rpmMax?: number;
  gear?: number;
  speed?: number;
  source?: string;
  /** -1..1 force-feedback request from a compatible PC/game bridge. */
  ffb?: number | undefined;
};

const clampRate = (hz: number) => Math.max(60, Math.min(240, Math.round(hz)));
const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/**
 * Low-latency state transport:
 * - target rate is selectable up to 240 Hz (~4.17 ms minimum cadence)
 * - self-scheduling avoids interval drift
 * - only the newest controller state is sent
 * - browser/transport buffering is bounded so stale input is not accumulated
 */
export function useBridge(
  stateRef: React.MutableRefObject<ControllerState>,
  rateHz: number,
  outputMode: "xinput" | "ds4" | "universal" = "xinput",
  vibrationEnabled = true,
) {
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [latency, setLatency] = useState<number | null>(null);
  const [packets, setPackets] = useState(0);
  const [telemetry, setTelemetry] = useState<BridgeTelemetry>({});
  const [telemetryLive, setTelemetryLive] = useState(false);
  const [activeGame, setActiveGame] = useState<string>("Desktop");
  const [activeGameProcess, setActiveGameProcess] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const moveAccumRef = useRef({ dx: 0, dy: 0 });
  const moveFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const telemetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const packetCounterRef = useRef(0);
  const lastStatsPaintRef = useRef(0);
  const lastLatencyPaintRef = useRef(0);
  const lastSentStateRef = useRef("");
  const lastHeartbeatRef = useRef(0);
  const rateHzRef = useRef(rateHz);

  useEffect(() => {
    rateHzRef.current = rateHz;
  }, [rateHz]);

  const stateSignature = useCallback(() => JSON.stringify(stateRef.current), [stateRef]);

  const clearLoop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const clearTelemetryTimer = useCallback(() => {
    if (telemetryTimerRef.current) clearTimeout(telemetryTimerRef.current);
    telemetryTimerRef.current = null;
  }, []);

  const clearMoveFlush = useCallback(() => {
    if (moveFlushTimerRef.current) clearTimeout(moveFlushTimerRef.current);
    moveFlushTimerRef.current = null;
    moveAccumRef.current = { dx: 0, dy: 0 };
  }, []);

  /**
   * Mouse-move deltas are accumulated and sent as one coalesced packet per
   * flush instead of one packet per pointer/gyro sample. On a healthy
   * connection this still goes out within a tick or two. If the socket is
   * backed up (weak Wi-Fi, a busy tab) the accumulated delta is kept and
   * retried rather than sent late (stale queueing -> perceived lag) or
   * dropped (which would desync the absolute-pointing cursor from the
   * phone's current attitude).
   */
  const flushMove = useCallback(() => {
    moveFlushTimerRef.current = null;
    const ws = wsRef.current;
    const pending = moveAccumRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      moveAccumRef.current = { dx: 0, dy: 0 };
      return;
    }
    if (!pending.dx && !pending.dy) return;

    if (ws.bufferedAmount > 48_000) {
      moveFlushTimerRef.current = setTimeout(flushMove, 4);
      return;
    }

    moveAccumRef.current = { dx: 0, dy: 0 };
    try {
      ws.send(
        JSON.stringify({
          type: "mouse",
          t: Date.now(),
          action: "move",
          dx: pending.dx,
          dy: pending.dy,
        }),
      );
    } catch {
      /* ignore a send racing socket close */
    }
  }, []);

  const disconnect = useCallback(() => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(RELEASE_INPUTS));
    clearLoop();
    clearMoveFlush();
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      try {
        ws.close(1000, "controller disconnect");
      } catch {
        /* ignore */
      }
    }
    setStatus("idle");
    setLatency(null);
    setTelemetry({});
    setTelemetryLive(false);
    clearTelemetryTimer();
  }, [clearLoop, clearMoveFlush, clearTelemetryTimer]);

  const connect = useCallback(
    (url: string) => {
      disconnect();

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        setStatus("error");
        return;
      }

      // Prefer keeping a live socket on the hot path. WebSocket itself remains
      // the compatibility transport because it is widely supported.
      wsRef.current = ws;
      setStatus("connecting");

      ws.onopen = () => {
        if (wsRef.current !== ws) { ws.close(); return; }
        lastSentStateRef.current = "";
        lastHeartbeatRef.current = 0;
        try {
          ws.send(
            JSON.stringify({
              type: "hello",
              client: "mobile-rig",
              version: 3,
              transport: "websocket",
              rateHz: clampRate(rateHzRef.current),
              output: outputMode,
            }),
          );
        } catch {
          /* socket may close immediately */
        }

        // Connection cue also proves the asynchronous game-haptic lane is alive.
        if (vibrationEnabled) playDualRumble("ui", {
          strongMagnitude: 0,
          weakMagnitude: 0.2,
          duration: 40,
        });

        let nextDue = nowMs();

        const pump = () => {
          if (wsRef.current !== ws || ws.readyState !== WebSocket.OPEN) return;

          const signature = stateSignature();
          const currentTime = nowMs();
          const changed = signature !== lastSentStateRef.current;
          const heartbeatDue = currentTime - lastHeartbeatRef.current >= 250;

          // Do not build a queue of stale controller packets. A controller is
          // interested in the newest state, not hundreds of identical refreshes.
          // Input events take the immediate hot/edge lane; this loop is only a
          // change detector and 4 Hz recovery heartbeat.
          if ((changed || heartbeatDue) && ws.bufferedAmount < 2_048) {
            try {
              ws.send(JSON.stringify({
                type: "state",
                t: Date.now(),
                seq: ++packetCounterRef.current,
                ...stateRef.current,
              }));
              lastSentStateRef.current = signature;
              lastHeartbeatRef.current = currentTime;
              if (currentTime - lastStatsPaintRef.current >= 250) {
                lastStatsPaintRef.current = currentTime;
                setPackets(packetCounterRef.current);
              }
            } catch {
              /* ignore a send racing socket close */
            }
          }

          const period = 1000 / clampRate(rateHzRef.current);
          nextDue += period;
          if (nextDue < currentTime - period * 2) nextDue = currentTime + period;
          timerRef.current = setTimeout(pump, Math.max(0, nextDue - currentTime));
        };

        pump();
      };

      ws.onmessage = (ev) => {
        if (wsRef.current !== ws) return;
        try {
          const msg = JSON.parse(String(ev.data));

          if (msg.type === "ready") {
            if (msg.controller?.connected) {
              setStatus("connected");
              lastSentStateRef.current = "";
            } else {
              clearLoop();
              setStatus("error");
            }
            return;
          }

          if (msg.type === "ack" && typeof msg.t === "number") {
            const value = Math.max(0, Math.round(Date.now() - msg.t));
            const t = nowMs();
            if (t - lastLatencyPaintRef.current >= 200) {
              lastLatencyPaintRef.current = t;
              setLatency(value);
            }
            return;
          }

          if (msg.type === "haptic") {
            if (!vibrationEnabled) return;

            const strong = Math.max(
              0,
              Math.min(1, Number(msg.strongMagnitude ?? msg.large ?? 0)),
            );
            const weak = Math.max(
              0,
              Math.min(1, Number(msg.weakMagnitude ?? msg.small ?? 0)),
            );
            const duration = Math.max(
              20,
              Math.min(500, Number(msg.duration) || 70),
            );
            const kind =
              msg.kind === "heavy" ||
              msg.kind === "heartbeat" ||
              msg.kind === "engine" ||
              msg.kind === "gunfire" ||
              msg.kind === "ui" ||
              msg.kind === "light"
                ? msg.kind
                : strong >= 0.78 && weak >= 0.58
                  ? "heavy"
                  : strong <= 0.12 && weak >= 0.68
                    ? "gunfire"
                    : strong >= 0.28 && weak <= 0.08
                      ? "heartbeat"
                      : strong <= 0.34 && weak <= 0.24
                        ? "engine"
                        : "light";

            playDualRumble(kind, {
              strongMagnitude: strong,
              weakMagnitude: weak,
              duration,
            });

            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("touch-to-steer:game-haptic", {
                  detail: {
                    kind,
                    strongMagnitude: strong,
                    weakMagnitude: weak,
                    duration,
                  },
                }),
              );
            }
            return;
          }

          if (msg.type === "game") {
            const name =
              typeof msg.name === "string" && msg.name.trim()
                ? msg.name.trim()
                : "Desktop";
            setActiveGame(name);
            setActiveGameProcess(
              typeof msg.process === "string" && msg.process.trim()
                ? msg.process.trim()
                : null,
            );
            return;
          }

          if (msg.type === "telemetry") {
            setTelemetry({
              rpm: typeof msg.rpm === "number" ? msg.rpm : undefined,
              rpmMax: typeof msg.rpmMax === "number" ? msg.rpmMax : undefined,
              gear: typeof msg.gear === "number" ? msg.gear : undefined,
              speed: typeof msg.speed === "number" ? msg.speed : undefined,
              source: typeof msg.source === "string" ? msg.source : undefined,
              ffb: typeof msg.ffb === "number" ? Math.max(-1, Math.min(1, msg.ffb)) : undefined,
            });
            setTelemetryLive(true);
            clearTelemetryTimer();
            telemetryTimerRef.current = setTimeout(() => {
              setTelemetryLive(false);
            }, 500);
            return;
          }

          if (msg.type === "ffb" && typeof msg.value === "number") {
            const force = Math.max(-1, Math.min(1, msg.value));
            setTelemetry((prev) => ({
              ...prev,
              ffb: force,
            }));

            // Mirror PC force-feedback into the real dual-rumble path.
            // Strong force drives the heavy motor; softer force drives the
            // high-frequency motor while remaining rate-safe.
            if (vibrationEnabled && Math.abs(force) > 0.04) {
              const magnitude = Math.abs(force);
              playDualRumble(magnitude >= 0.68 ? "heavy" : "engine", {
                strongMagnitude: Math.min(1, 0.12 + magnitude * 0.88),
                weakMagnitude: Math.min(1, 0.08 + magnitude * 0.72),
                duration: magnitude >= 0.68 ? 180 : 70,
              });
            }
          }
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onerror = () => { if (wsRef.current === ws) setStatus("error"); };
      ws.onclose = () => {
        if (wsRef.current === ws) {
          window.dispatchEvent(new Event(RELEASE_INPUTS));
          wsRef.current = null;
          clearLoop();
          clearMoveFlush();
          setStatus((s) => (s === "error" ? "error" : "idle"));
        }
      };
    },
    [clearLoop, clearTelemetryTimer, disconnect, outputMode, rateHz, stateRef, stateSignature, vibrationEnabled],
  );

  useEffect(
    () => () => {
      disconnect();
      clearTelemetryTimer();
    },
    [clearTelemetryTimer, disconnect],
  );

  // Switching the controller output while the phone is already connected
  // must renegotiate the virtual device immediately. Otherwise Windows can
  // keep the old DS4 "Wireless Controller" target until the next reconnect.
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    try {
      ws.send(
        JSON.stringify({
          type: "hello",
          client: "mobile-rig",
          version: 3,
          transport: "websocket",
          rateHz: clampRate(rateHz),
          output: outputMode,
        }),
      );
    } catch {
      /* ignore a send racing socket close */
    }
  }, [outputMode, rateHz]);

  const sendControllerStateNow = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;

    // Live analog controls use a dedicated hot lane. The bridge applies these
    // snapshots immediately; the selected-rate pump remains as a safety/refresh lane.
    // This matters most for steering, accelerator, brake and other pedal axes.
    if (ws.bufferedAmount >= 2_048) return false;

    try {
      ws.send(
        JSON.stringify({
          type: "state",
          priority: "hot",
          t: Date.now(),
          seq: ++packetCounterRef.current,
          ...stateRef.current,
        }),
      );
      lastSentStateRef.current = stateSignature();
      lastHeartbeatRef.current = nowMs();
      return true;
    } catch {
      return false;
    }
  }, [stateRef, stateSignature]);

  const sendControllerEdge = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;

    // Digital button transitions must not wait for the 240 Hz state sampler.
    // A lightning-fast tap can otherwise happen entirely between two pump
    // ticks and never reach the bridge at all. Send the complete current
    // controller snapshot immediately; the bridge applies edge snapshots
    // synchronously while continuous state traffic remains coalesced.
    try {
      ws.send(
        JSON.stringify({
          type: "state",
          priority: "edge",
          t: Date.now(),
          seq: ++packetCounterRef.current,
          ...stateRef.current,
        }),
      );
      lastSentStateRef.current = stateSignature();
      lastHeartbeatRef.current = nowMs();
      return true;
    } catch {
      return false;
    }
  }, [stateRef, stateSignature]);

  const sendMouse = useCallback(
    (message: {
      action: "move" | "button" | "wheel" | "reset" | "center";
      dx?: number;
      dy?: number;
      button?: "left" | "right" | "middle" | "back" | "forward";
      down?: boolean;
      delta?: number;
    }) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;

      if (message.action === "move") {
        const dx = message.dx ?? 0;
        const dy = message.dy ?? 0;
        if (!dx && !dy) return true;

        // Healthy LAN path: put the mouse delta directly on the WebSocket
        // from the pointer/gyro event. Do not add a timer tick to the hot path.
        if (ws.bufferedAmount < 32_768) {
          try {
            ws.send(
              JSON.stringify({
                type: "mouse",
                t: Date.now(),
                action: "move",
                dx,
                dy,
              }),
            );
            return true;
          } catch {
            /* fall through to the bounded coalescing path */
          }
        }

        // Only use the coalescer while the browser socket is actually backed
        // up. This prevents stale move queues without sacrificing the fastest
        // path during normal local-network operation.
        moveAccumRef.current.dx += dx;
        moveAccumRef.current.dy += dy;
        if (!moveFlushTimerRef.current) {
          moveFlushTimerRef.current = setTimeout(flushMove, 0);
        }
        return true;
      }

      try {
        ws.send(
          JSON.stringify({
            type: "mouse",
            t: Date.now(),
            ...message,
          }),
        );
        return true;
      } catch {
        return false;
      }
    },
    [flushMove],
  );

  return {
    status,
    latency,
    packets,
    telemetry,
    telemetryLive,
    activeGame,
    activeGameProcess,
    connect,
    disconnect,
    sendMouse,
    sendControllerStateNow,
    sendControllerEdge,
  };
}
