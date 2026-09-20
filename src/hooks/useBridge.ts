import { useCallback, useEffect, useRef, useState } from "react";
import type { ControllerState } from "@/lib/controller-types";

export type BridgeStatus = "idle" | "connecting" | "connected" | "error";

/**
 * Streams the controller state to the PC bridge over a WebSocket.
 * The state lives in a ref so touch updates never re-render at 60Hz.
 */
export function useBridge(stateRef: React.MutableRefObject<ControllerState>, rateHz: number) {
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [latency, setLatency] = useState<number | null>(null);
  const [packets, setPackets] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const disconnect = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("idle");
    setLatency(null);
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
        ws.send(JSON.stringify({ type: "hello", client: "mobile-rig", version: 1 }));
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
          if (msg.type === "ack" && typeof msg.t === "number") setLatency(Date.now() - msg.t);
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

  return { status, latency, packets, connect, disconnect };
}
