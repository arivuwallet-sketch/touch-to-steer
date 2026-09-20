import { useCallback, useEffect, useRef, useState } from "react";
import type { ControllerState } from "@/lib/controller-types";

export type BridgeStatus = "idle" | "connecting" | "connected" | "error";

export type BridgeTelemetry = {
  rpm?: number;
  rpmMax?: number;
  gear?: number;
  speed?: number;
  /** -1..1 force-feedback request from a compatible PC/game bridge. */
  ffb?: number;
};

const clampRate = (hz: number) => Math.max(60, Math.min(240, Math.round(hz)));
const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/**
 * Low-latency state transport:
 * - target rate is capped at 240 Hz (~4.17 ms cadence)
 * - self-scheduling avoids interval drift
 * - only the newest controller state is sent
 * - browser/transport buffering is bounded so stale input is not accumulated
 */
export function useBridge(
  stateRef: React.MutableRefObject<ControllerState>,
  rateHz: number,
  outputMode: "xinput" | "ds4" = "xinput",
) {
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [latency, setLatency] = useState<number | null>(null);
  const [packets, setPackets] = useState(0);
  const [telemetry, setTelemetry] = useState<BridgeTelemetry>({});
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const packetCounterRef = useRef(0);
  const lastStatsPaintRef = useRef(0);
  const lastLatencyPaintRef = useRef(0);

  const clearLoop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const disconnect = useCallback(() => {
    clearLoop();
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
  }, [clearLoop]);

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
        setStatus("connected");
        try {
          ws.send(JSON.stringify({
            type: "hello",
            client: "mobile-rig",
            version: 3,
            transport: "websocket",
            rateHz: clampRate(rateHz),
            output: outputMode,
          }));
        } catch {
          /* socket may close immediately */
        }

        let nextDue = nowMs();

        const pump = () => {
          if (wsRef.current !== ws || ws.readyState !== WebSocket.OPEN) return;

          const packet = {
            type: "state",
            t: Date.now(),
            seq: ++packetCounterRef.current,
            ...stateRef.current,
          };

          // Do not build a queue of stale controller packets. A controller is
          // interested in the newest state, not every missed intermediate frame.
          if (ws.bufferedAmount < 32_768) {
            try {
              ws.send(JSON.stringify(packet));
              const t = nowMs();
              if (t - lastStatsPaintRef.current >= 250) {
                lastStatsPaintRef.current = t;
                setPackets(packetCounterRef.current);
              }
            } catch {
              /* ignore a send racing socket close */
            }
          }

          const period = 1000 / clampRate(rateHz);
          const currentTime = nowMs();
          nextDue += period;
          if (nextDue < currentTime - period * 2) nextDue = currentTime + period;
          timerRef.current = setTimeout(pump, Math.max(0, nextDue - currentTime));
        };

        pump();
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data));

          if (msg.type === "ack" && typeof msg.t === "number") {
            const value = Math.max(0, Math.round(Date.now() - msg.t));
            const t = nowMs();
            if (t - lastLatencyPaintRef.current >= 200) {
              lastLatencyPaintRef.current = t;
              setLatency(value);
            }
            return;
          }

          if (msg.type === "telemetry") {
            setTelemetry({
              rpm: typeof msg.rpm === "number" ? msg.rpm : undefined,
              rpmMax: typeof msg.rpmMax === "number" ? msg.rpmMax : undefined,
              gear: typeof msg.gear === "number" ? msg.gear : undefined,
              speed: typeof msg.speed === "number" ? msg.speed : undefined,
              ffb: typeof msg.ffb === "number" ? Math.max(-1, Math.min(1, msg.ffb)) : undefined,
            });
            return;
          }

          if (msg.type === "ffb" && typeof msg.value === "number") {
            setTelemetry((prev) => ({
              ...prev,
              ffb: Math.max(-1, Math.min(1, msg.value)),
            }));
          }
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onerror = () => setStatus("error");
      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
          clearLoop();
          setStatus((s) => (s === "error" ? "error" : "idle"));
        }
      };
    },
    [clearLoop, disconnect, outputMode, rateHz, stateRef],
  );

  useEffect(() => () => disconnect(), [disconnect]);

  return { status, latency, packets, telemetry, connect, disconnect };
}
