import {
  boolean,
  index,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { conversationsTable } from "./chat";

export const swipeActionEnum = pgEnum("swipe_action", ["LIKE", "PASS"]);

export const swipesTable = pgTable(
  "swipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromUserId: uuid("from_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    toUserId: uuid("to_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    action: swipeActionEnum("action").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("swipes_from_to_unique").on(table.fromUserId, table.toUserId),
    index("swipes_from_user_idx").on(table.fromUserId),
    index("swipes_to_user_idx").on(table.toUserId),
  ],
);

export const matchesTable = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user1Id: uuid("user1_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    user2Id: uuid("user2_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    compatibilityScore: numeric("compatibility_score").notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    conversationId: uuid("conversation_id").references(
      () => conversationsTable.id,
    ),
    matchedAt: timestamp("matched_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("matches_users_unique").on(table.user1Id, table.user2Id),
    index("matches_user1_idx").on(table.user1Id),
    index("matches_user2_idx").on(table.user2Id),
  ],
);

export type Swipe = typeof swipesTable.$inferSelect;
export type Match = typeof matchesTable.$inferSelect;
