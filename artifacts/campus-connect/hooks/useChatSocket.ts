import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@clerk/expo";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string | null;
  mediaUrl: string | null;
  messageType: string;
  status: string;
  createdAt: string;
}

interface WsEvent {
  type: "new_message" | "typing" | "ping" | "pong";
  conversationId?: string;
  message?: ChatMessage;
}

export function useChatSocket(
  conversationId: string | null,
  onNewMessage: (msg: ChatMessage) => void
) {
  const { getToken, isSignedIn } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;

  const connect = useCallback(async () => {
    if (!isSignedIn || !conversationId) return;

    const domain = process.env["EXPO_PUBLIC_DOMAIN"];
    if (!domain) return;

    const token = await getToken();
    if (!token) return;

    const url = `wss://${domain}/api/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as WsEvent;
        if (
          data.type === "new_message" &&
          data.conversationId === conversationId &&
          data.message
        ) {
          onNewMessageRef.current(data.message);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = (event) => {
      if (event.code !== 1000 && event.code !== 1001) {
        reconnectTimer.current = setTimeout(() => void connect(), 3000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [isSignedIn, conversationId, getToken]);

  useEffect(() => {
    void connect();

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close(1000, "Component unmounted");
        wsRef.current = null;
      }
    };
  }, [connect]);
}
