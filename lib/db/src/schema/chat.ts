import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const messageStatusEnum = pgEnum("message_status", [
  "SENT",
  "DELIVERED",
  "READ",
]);
export const messageTypeEnum = pgEnum("message_type", ["TEXT", "IMAGE"]);

export const conversationsTable = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user1Id: uuid("user1_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    user2Id: uuid("user2_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    lastMessage: text("last_message"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    unreadCount1: integer("unread_count_1").notNull().default(0),
    unreadCount2: integer("unread_count_2").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("conversations_users_idx").on(table.user1Id, table.user2Id),
    index("conversations_last_msg_idx").on(table.lastMessageAt),
  ],
);

export const messagesTable = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    receiverId: uuid("receiver_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    content: text("content"),
    mediaUrl: text("media_url"),
    messageType: messageTypeEnum("message_type").notNull().default("TEXT"),
    status: messageStatusEnum("status").notNull().default("SENT"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    index("messages_sender_id_idx").on(table.senderId),
  ],
);

export type Conversation = typeof conversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
