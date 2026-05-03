import { Router } from "express";
import { db, conversationsTable, messagesTable, usersTable, collegesTable } from "@workspace/db";
import { eq, and, or, lt, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { mapPublicProfile } from "./users.js";
import { z } from "zod";

const router = Router();

async function formatConversation(conv: typeof conversationsTable.$inferSelect, currentUserId: string) {
  const otherUserId = conv.user1Id === currentUserId ? conv.user2Id : conv.user1Id;
  const unreadCount = conv.user1Id === currentUserId ? conv.unreadCount1 : conv.unreadCount2;

  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, otherUserId)).limit(1);
  const [col] = u ? await db.select().from(collegesTable).where(eq(collegesTable.id, u.collegeId)).limit(1) : [null];

  return {
    id: conv.id,
    otherUser: u ? mapPublicProfile(u, col ?? null) : null,
    lastMessage: conv.lastMessage ?? null,
    lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
    unreadCount,
    createdAt: conv.createdAt.toISOString(),
  };
}

router.get("/chat/conversations", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const convs = await db.select().from(conversationsTable)
    .where(or(eq(conversationsTable.user1Id, userId), eq(conversationsTable.user2Id, userId)))
    .orderBy(desc(conversationsTable.lastMessageAt));

  const formatted = await Promise.all(convs.map(c => formatConversation(c, userId)));
  res.json({ conversations: formatted });
});

router.post("/chat/start", requireAuth, async (req, res) => {
  const parsed = z.object({ userId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "VALIDATION_ERROR", message: "userId is required" }); return; }

  const otherUserId = parsed.data.userId;
  const myId = req.userId!;

  if (otherUserId === myId) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Cannot start conversation with yourself" }); return;
  }

  const [existing] = await db.select().from(conversationsTable)
    .where(or(
      and(eq(conversationsTable.user1Id, myId), eq(conversationsTable.user2Id, otherUserId)),
      and(eq(conversationsTable.user1Id, otherUserId), eq(conversationsTable.user2Id, myId)),
    )).limit(1);

  if (existing) {
    res.json(await formatConversation(existing, myId));
    return;
  }

  const [conv] = await db.insert(conversationsTable).values({ user1Id: myId, user2Id: otherUserId }).returning();
  res.json(await formatConversation(conv, myId));
});

router.get("/chat/:conversationId/messages", requireAuth, async (req, res) => {
  const { conversationId } = req.params;
  const cursor = req.query["cursor"] as string | undefined;
  const limit = 30;

  const [conv] = await db.select().from(conversationsTable)
    .where(and(
      eq(conversationsTable.id, conversationId!),
      or(eq(conversationsTable.user1Id, req.userId!), eq(conversationsTable.user2Id, req.userId!)),
    )).limit(1);

  if (!conv) { res.status(404).json({ error: "NOT_FOUND", message: "Conversation not found" }); return; }

  const messages = await db.select().from(messagesTable)
    .where(and(
      eq(messagesTable.conversationId, conversationId!),
      cursor ? lt(messagesTable.createdAt, new Date(cursor)) : undefined,
    ))
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit + 1);

  const hasMore = messages.length > limit;
  const items = messages.slice(0, limit);

  const formatted = items.map(m => ({
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    receiverId: m.receiverId,
    content: m.content ?? null,
    mediaUrl: m.mediaUrl ?? null,
    messageType: m.messageType,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
  }));

  await db.update(conversationsTable)
    .set(conv.user1Id === req.userId! ? { unreadCount1: 0 } : { unreadCount2: 0 })
    .where(eq(conversationsTable.id, conversationId!));

  res.json({ messages: formatted, nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null });
});

router.post("/chat/:conversationId/messages", requireAuth, async (req, res) => {
  const { conversationId } = req.params;
  const parsed = z.object({
    content: z.string().optional(),
    mediaUrl: z.string().optional(),
    messageType: z.enum(["TEXT", "IMAGE"]),
  }).safeParse(req.body);

  if (!parsed.success) { res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message }); return; }

  const [conv] = await db.select().from(conversationsTable)
    .where(and(
      eq(conversationsTable.id, conversationId!),
      or(eq(conversationsTable.user1Id, req.userId!), eq(conversationsTable.user2Id, req.userId!)),
    )).limit(1);

  if (!conv) { res.status(404).json({ error: "NOT_FOUND", message: "Conversation not found" }); return; }

  const receiverId = conv.user1Id === req.userId! ? conv.user2Id : conv.user1Id;
  const { content, mediaUrl, messageType } = parsed.data;

  const [msg] = await db.insert(messagesTable).values({
    conversationId: conversationId!,
    senderId: req.userId!,
    receiverId,
    content,
    mediaUrl,
    messageType,
    status: "SENT",
  }).returning();

  const unreadField = conv.user1Id === req.userId! ? { unreadCount2: conv.unreadCount2 + 1 } : { unreadCount1: conv.unreadCount1 + 1 };
  await db.update(conversationsTable).set({
    lastMessage: content ?? "Media",
    lastMessageAt: new Date(),
    updatedAt: new Date(),
    ...unreadField,
  }).where(eq(conversationsTable.id, conversationId!));

  res.status(201).json({
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    receiverId: msg.receiverId,
    content: msg.content ?? null,
    mediaUrl: msg.mediaUrl ?? null,
    messageType: msg.messageType,
    status: msg.status,
    createdAt: msg.createdAt.toISOString(),
  });
});

export default router;
