import type { IncomingMessage } from "http";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";
import { verifyAccessToken } from "./auth.js";
import { logger } from "./logger.js";

export interface WsMessage {
  type: "new_message" | "typing" | "read" | "ping" | "pong";
  conversationId?: string;
  message?: {
    id: string;
    conversationId: string;
    senderId: string;
    receiverId: string;
    content: string | null;
    mediaUrl: string | null;
    messageType: string;
    status: string;
    createdAt: string;
  };
}

interface AuthedSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

const userSockets = new Map<string, AuthedSocket>();

export const wss = new WebSocketServer({ noServer: true });

function authenticate(request: IncomingMessage): string | null {
  try {
    const url = new URL(request.url ?? "", `http://localhost`);
    const token = url.searchParams.get("token");
    if (!token) return null;
    const payload = verifyAccessToken(token);
    return payload.userId;
  } catch {
    return null;
  }
}

wss.on("connection", (ws: AuthedSocket, request: IncomingMessage) => {
  const userId = authenticate(request);

  if (!userId) {
    ws.close(1008, "Unauthorized");
    return;
  }

  ws.userId = userId;
  ws.isAlive = true;

  const existing = userSockets.get(userId);
  if (existing && existing.readyState === existing.OPEN) {
    existing.close(1000, "New connection opened");
  }
  userSockets.set(userId, ws);
  logger.info({ userId }, "WebSocket connected");

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString()) as WsMessage;
      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on("close", () => {
    if (userSockets.get(userId) === ws) {
      userSockets.delete(userId);
    }
    logger.info({ userId }, "WebSocket disconnected");
  });

  ws.on("error", (err) => {
    logger.error({ userId, err }, "WebSocket error");
  });

  ws.send(JSON.stringify({ type: "pong" }));
});

const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((client) => {
    const socket = client as AuthedSocket;
    if (socket.isAlive === false) {
      socket.terminate();
      return;
    }
    socket.isAlive = false;
    socket.ping();
  });
}, 30000);

wss.on("close", () => clearInterval(heartbeatInterval));

export function broadcastToConversation(
  user1Id: string,
  user2Id: string,
  payload: WsMessage
): void {
  const data = JSON.stringify(payload);
  for (const uid of [user1Id, user2Id]) {
    const socket = userSockets.get(uid);
    if (socket && socket.readyState === socket.OPEN) {
      socket.send(data);
    }
  }
}
