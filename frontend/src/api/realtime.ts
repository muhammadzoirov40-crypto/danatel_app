/**
 * 🔌 WebSocket-и зинда (realtime): огоҳиномаҳо аз сервер БЕ refresh.
 *
 * Мисол: админ дархости пур карданро тасдиқ/рад/бозгирӣ кард →
 * мизоҷи дар модали «Пур кардани баланс» фавран рӯйхат ва баланси
 * навро мегирад (асинхронӣ, бе ягон калидаи нав).
 *
 * • ҳангоми кушодани модал пайваст мешавад, ҳангоми баста → тоза мешавад;
 * • агар канда шавад → backoff то 15s (буғумҳои мобилӣ/тағйири WiFi);
 * • бе токен → ҳеҷ кор намекунад;
 * • `ping`-и сервер → `pong` (канда нашудани proxy/NAT).
 */
import { getToken } from "./client";

export interface RealtimeMsg {
  type: string;
  [key: string]: unknown;
}

/**
 * Пайваст мешавад → баргардонии `cleanup` (ҳатман баргардонед:
 * он socket-ро мебарад ва reconnect-ро бекор мекунад).
 */
export function openRealtime(onEvent: (msg: RealtimeMsg) => void): () => void {
  const token = getToken() ?? "";
  if (!token || typeof WebSocket === "undefined") return () => {};

  let ws: WebSocket | null = null;
  let closed = false;
  let delay = 1000;
  let retryId: number | undefined;

  function schedule() {
    if (closed) return;
    window.clearTimeout(retryId);
    retryId = window.setTimeout(connect, delay);
    delay = Math.min(delay * 2, 15000);
  }

  function connect() {
    if (closed) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    try {
      ws = new WebSocket(
        `${proto}://${window.location.host}/api/ws?token=${encodeURIComponent(token)}`,
      );
    } catch {
      schedule();
      return;
    }
    ws.onmessage = (ev) => {
      let msg: RealtimeMsg;
      try {
        msg = JSON.parse(String(ev.data)) as RealtimeMsg;
      } catch {
        return; // нодуруст — нодида
      }
      if (msg.type === "topup_updated") {
        onEvent(msg);
      } else if (
        msg.type === "ping" &&
        ws &&
        ws.readyState === WebSocket.OPEN
      ) {
        ws.send('{"type":"pong"}');
      }
    };
    ws.onopen = () => {
      delay = 1000; // пайваст шуд → буғум аз сифат
    };
    ws.onclose = () => {
      ws = null;
      schedule();
    };
    ws.onerror = () => {
      try {
        ws?.close();
      } catch {
        /* onclose баъдан меояд → schedule */
      }
    };
  }

  connect();

  return () => {
    closed = true;
    window.clearTimeout(retryId);
    try {
      ws?.close();
    } catch {
      /* аллакай баста */
    }
    ws = null;
  };
}
