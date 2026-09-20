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

/**
 * Streams the controller state to the PC bridge over a WebSocket.
 * The state lives in a ref so touch updates never re-render at 60Hz.
 *
 * A compatible bridge may also send:
 *   { type:"telemetry", rpm, rpmMax, gear, speed, ffb }
 *   { type:"ffb", value:-1..1 }
 * These messages are optional; the controller remains fully functional without them.
 */
export function useBridge(stateRef: React.MutableRefObject<ControllerState>, rateHz: number) {
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [latency, setLatency] = useState<number | null>(null);
  const [packets, setPackets] = useState(0);
  const [telemetry, setTelemetry] = useState<BridgeTelemetry>({});
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const disconnect = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("idle");
    setLatency(null);
    setTelemetry({});
  }, []);

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
      wsRef.current = ws;
      setStatus("connecting");

      ws.onopen = () => {
        setStatus("connected");
        ws.send(JSON.stringify({ type: "hello", client: "mobile-rig", version: 2 }));
        timerRef.current = setInterval(
          () => {
            if (ws.readyState !== WebSocket.OPEN) return;
            ws.send(JSON.stringify({ type: "state", t: Date.now(), ...stateRef.current }));
            setPackets((p) => p + 1);
          },
          Math.max(8, Math.round(1000 / rateHz)),
        );
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data));
          if (msg.type === "ack" && typeof msg.t === "number") {
            setLatency(Date.now() - msg.t);
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
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setStatus((s) => (s === "error" ? "error" : "idle"));
      };
    },
    [disconnect, rateHz, stateRef],
  );

  useEffect(() => () => disconnect(), [disconnect]);

  return { status, latency, packets, telemetry, connect, disconnect };
}
